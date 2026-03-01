const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const moment = require("moment");
const { v4: uuidv4 } = require("uuid");
const handlebars = require("handlebars");
const Institution = require("../models/Institutions");
const Patient = require("../models/Patient"); 
const TestAvailabilitySchema = require("../models/TestAvailability");
// Schemas
const OrderSchema = require("../models/Order");
const TestSchema = require("../models/Test");
const PackageSchema = require("../models/Package");
const UserSchema = require("../models/User");
const DailyCounterSchema = require("../models/DailyCounter");
const Doctor = require("../models/Doctor");
const QueueTokenSchema = require("../models/QueueToken");
const getModel = require("../middleware/getModelsHandler");
const { verifyToken } = require("../middleware/verifyToken");
const { generateInvoicePayload, buildDynamicTableHtml } = require("../handlers/invoiceHelpers");
const TemplateSchema = require("../models/Template");
const { generatePdf } = require("../handlers/pdfHandler");
const { sendToBrand,sendToClient } = require("../sseManager");
const { calculateInitialETA } = require("../handlers/schedulingLogic");

// --- HELPER: Merge Patient Info ---
const mergePatientsWithOrders = async (orders) => {
    const isArray = Array.isArray(orders);
    const orderList = isArray ? orders : [orders];
    const patientIds = [...new Set(orderList.map(o => o.patientId).filter(id => id))];
    const patients = await Patient.find({ _id: { $in: patientIds } });
    const patientMap = {};
    patients.forEach(p => { patientMap[p._id.toString()] = p; });

    const merged = orderList.map(order => {
        const orderObj = order.toObject ? order.toObject() : order;
        orderObj.patientId = patientMap[orderObj.patientId.toString()] || null;
        return orderObj;
    });
    return isArray ? merged : merged[0];
};

// --- HELPER: Calculate Items & Total (Refactored) ---
const calculateOrderItems = async (items, req) => {
    console.log(items)
    const orderItems = [];
    let calculatedTotal = 0;
    
    // We need the Doctor model for the lookup
    const Doctor = require('../models/Doctor'); 

    for (let item of items) {
        if (item.type === 'Test') {
            const test = await req.TenantTest.findById(item._id);
            if (test) {
                orderItems.push({ itemId: test._id, name: test.name, price: test.price, itemType: 'Test' });
                calculatedTotal += test.price;
            }
        } else if (item.type === 'Package') {
            const pkg = await req.TenantPackage.findById(item._id);
            if (pkg) {
                orderItems.push({ itemId: pkg._id, name: pkg.name, price: pkg.offerPrice, itemType: 'Package' });
                calculatedTotal += pkg.offerPrice;
            }
        } 
        // --- NEW: Handle Doctor Consultations ---
        else if (item.type === 'Consultation') {
            // Find doctor ensuring tenant isolation
            const doctor = await Doctor.findOne({ _id: item._id, institutionId: req.user.institutionId });
            if (doctor) {
                orderItems.push({ 
                    itemId: doctor._id, 
                    name: `Consultation: Dr. ${doctor.personalInfo.firstName} ${doctor.personalInfo.lastName}`, 
                    price: item.isFollowUp ? doctor.fees.followUpConsultation : doctor.fees.newConsultation, 
                    itemType: 'Consultation',
                    shiftName: item.shiftName
                });
                calculatedTotal += item.isFollowUp ? doctor.fees.followUpConsultation : doctor.fees.newConsultation;
            }
        }
    }

    return { orderItems, calculatedTotal };
};

// --- MIDDLEWARE ---
const getTenantContext = async (req, res, next) => {
  try {
    const institutionId = req.user.institutionId;
    if (!institutionId) return res.status(400).json({ message: "Institution ID missing." });

    const institution = await Institution.findOne({ institutionId });
    if (!institution) return res.status(404).json({ message: "Institution not found." });

    const tenantDb = mongoose.connection.useDb(institution.dbName, { useCache: true });
    req.TenantOrder = getModel(tenantDb, "Order", OrderSchema);
    req.TenantTest = getModel(tenantDb, "Test", TestSchema);
    req.TenantPackage = getModel(tenantDb, "Package", PackageSchema);
    req.TenantTemplate = getModel(tenantDb, "Template", TemplateSchema);
    req.TenantUser = getModel(tenantDb, "User", UserSchema);
    req.TenantAvailability = getModel(tenantDb, "TestAvailability", TestAvailabilitySchema);
    req.TenantDailyCounter = getModel(tenantDb, "DailyCounter", DailyCounterSchema);
    req.TenantQueueToken = getModel(tenantDb, "QueueToken", QueueTokenSchema);
    next();
  } catch (err) {
    res.status(500).json({ message: "Database Connection Error" });
  }
};

router.use(verifyToken, getTenantContext);


// Helper function to validate discount
const validateDiscount = async (userModel, userId, totalAmount, discountAmount) => {
    if (discountAmount <= 0) return true; // No discount, no problem

    const user = await userModel.findOne({ userId });
    if (!user) throw new Error("User not found for validation");

    // Bypass check for Super/Master Admins if you have that flag, 
    // otherwise strictly follow maxDiscountPercent
    
    const requestedPercent = (discountAmount / totalAmount) * 100;
    const allowedPercent = user.settings?.maxDiscountPercent || 0;

    if (requestedPercent > allowedPercent) {
        throw new Error(`Access Denied: You are only authorized to give up to ${allowedPercent}% discount. (Requested: ${requestedPercent.toFixed(1)}%)`);
    }
    
    return user.fullName; // Return name for logging
};

// 1. CREATE ORDER
router.post("/", async (req, res) => {
  try {
    const { 
        items, discountAmount = 0, discountReason, discountOverrideCode, 
        initialPayment, notes, scheduleDate, walkin, patientId, 
        patientName, age, gender, updatedPatientData,
        appointment
    } = req.body;
    
    const instId = req.user.institutionId;
    const brandCode = req.user.brand;
    let finalPatientId = null;
    let finalPatientDetails = {};

    // --- 1. FETCH INSTITUTION SETTINGS ---
    const institution = await Institution.findOne({ institutionId: instId }).select("+settings.discountOverrideCode");
    const { orderFormat = "ORD-{YYMMDD}-{SEQ}", departmentOrderFormats = [] } = institution.settings || {};

    const generateFormattedId = (formatStr, sequence) => {
        return formatStr
            .replace('{YYMMDD}', moment().format("YYMMDD"))
            .replace('{YYYYMMDD}', moment().format("YYYYMMDD"))
            .replace('{SEQ}', String(sequence).padStart(3, '0'));
    };

    // --- 2. PATIENT RESOLUTION ---
    if (walkin) {
        if (!patientName || !age || !gender) return res.status(400).json({ message: "Name, Age, and Gender required." });
        finalPatientId = null;
        finalPatientDetails = { name: patientName, age: Number(age), gender, mobile: "" };
    } else {
        if (!patientId) return res.status(400).json({ message: "Patient ID is required." });
        const patient = await Patient.findById(patientId);
        if (!patient) return res.status(404).json({ message: "Patient not found." });

        if (updatedPatientData) {
            if (age) patient.age = Number(age);
            if (gender) patient.gender = gender;
            await patient.save();
        }

        finalPatientId = patient._id;
        finalPatientDetails = {
            name: `${patient.firstName} ${patient.lastName || ''}`.trim(),
            age: patient.age, gender: patient.gender, mobile: patient.mobile
        };

        if(!patient.enrolledInstitutions.includes(instId)){
            patient.enrolledInstitutions.push(instId);
            await patient.save();
        }
    }

    const finalAppointmentDate = scheduleDate ? scheduleDate : moment().format("YYYY-MM-DD");
    const dateKey = finalAppointmentDate;

  // --- 2.5 STRICT DOCTOR AVAILABILITY VALIDATION ---
    if (appointment && appointment.doctorId) {
        const { doctorId, shiftName } = appointment;
        const doctor = await Doctor.findOne({ _id: doctorId, institutionId: instId });
        
        if (!doctor) return res.status(404).json({ message: "Doctor not found." });
        if (!shiftName) return res.status(400).json({ message: "A specific shift must be selected for the consultation." });

        const targetDateStr = moment(dateKey).format("YYYY-MM-DD");
        const dayOfWeek = moment(dateKey).day();
        const dateObj = moment(targetDateStr);
        const weekOfMonth = Math.ceil(dateObj.date() / 7);

        let availableShifts = [];

        // A. GET REGULAR SCHEDULE
        const daySchedule = doctor.schedule?.find(s => s.dayOfWeek === dayOfWeek);
        if (daySchedule && daySchedule.isAvailable) {
            availableShifts = daySchedule.shifts.filter(shift => {
                if (shift.repeatWeeks && shift.repeatWeeks.length > 0) {
                    return shift.repeatWeeks.includes(weekOfMonth);
                }
                return true;
            });
        }

        // B. APPLY LEAVES
        const plannedLeave = doctor.leaves?.find(l => targetDateStr >= l.startDate && targetDateStr <= l.endDate);
        if (plannedLeave) {
            if (!plannedLeave.shiftNames || plannedLeave.shiftNames.length === 0) {
                availableShifts = [];
            } else {
                availableShifts = availableShifts.filter(s => !plannedLeave.shiftNames.includes(s.shiftName));
            }
        }

        // C. APPLY DAILY CANCELLATIONS (Overrides)
        const override = doctor.dailyOverrides?.find(o => o.date === targetDateStr);
        if (override && override.isCancelled) {
            if (!override.shiftNames || override.shiftNames.length === 0) {
                availableShifts = [];
            } else {
                availableShifts = availableShifts.filter(s => !override.shiftNames.includes(s.shiftName));
            }
        }

        // D. ADD SPECIAL SHIFTS (Overrides everything else)
        const specialShiftsForDay = doctor.specialShifts?.filter(s => s.date === targetDateStr) || [];
        specialShiftsForDay.forEach(specialShift => {
            const existingIndex = availableShifts.findIndex(s => s.shiftName === specialShift.shiftName);
            if (existingIndex > -1) {
                availableShifts[existingIndex] = specialShift; 
            } else {
                availableShifts.push(specialShift);
            }
        });

        // E. FINAL VALIDATION - Does the requested shift actually exist today?
        const targetShift = availableShifts.find(s => s.shiftName === shiftName);

        if (!targetShift) {
            return res.status(400).json({ message: `Cannot book: Doctor is not available for the '${shiftName}' shift on this date.` });
        }

        // F. Check Token Capacity (Block overbooking if disabled)
        if (!doctor.consultationRules?.allowOverbooking) {
            const existingTokensCount = await req.TenantQueueToken.countDocuments({
                doctorId: doctor._id,
                date: targetDateStr,
                shiftName: shiftName,
                status: { $nin: ['CANCELLED', 'DOC_UNVAILABLE'] }
            });
            
            // We use targetShift.maxTokens so it correctly references special shift limits too!
            if (existingTokensCount >= targetShift.maxTokens) {
                return res.status(400).json({ message: `Cannot book: The ${shiftName} shift has reached its maximum patient limit.` });
            }
        }
    }

    // --- 3. CALCULATE ITEMS & LIMITS ---
    const { orderItems, calculatedTotal } = await calculateOrderItems(items, req);
    if (orderItems.length === 0) return res.status(400).json({ message: "No valid items." });

    const itemIds = orderItems.map(i => i.itemId);
    const dbTests = await req.TenantTest.find({ _id: { $in: itemIds } });

    for (const dbTest of dbTests) {
        if (dbTest.dailyLimit !== null && dbTest.dailyLimit !== undefined && dbTest.dailyLimit > 0) {
            let availability = await req.TenantAvailability.findOne({ testId: dbTest._id.toString(), date: dateKey });
            if (availability) {
                if (availability.count >= dbTest.dailyLimit) {
                    return res.status(400).json({ message: `Capacity Full: ${dbTest.name} limit reached for ${dateKey}.` });
                }
                availability.count += 1;
                await availability.save();
            } else {
                await req.TenantAvailability.create({
                    testId: dbTest._id.toString(), date: dateKey, count: 1, dailyLimit: dbTest.dailyLimit
                });
            }
        }
    }

    // --- 4. DISCOUNT VALIDATION ---
    let authorizerName = null;
    let isOverridden = false;
    if (discountAmount > 0) {
        try {
            authorizerName = await validateDiscount(req.TenantUser, req.user.userId, calculatedTotal, discountAmount);
        } catch (limitError) {
            if (discountOverrideCode) {
                if (institution.settings?.discountOverrideCode === discountOverrideCode) {
                    isOverridden = true;
                    authorizerName = `System Override (by ${req.user.username})`;
                } else {
                    return res.status(403).json({ message: "Invalid Override Code" });
                }
            } else {
                return res.status(403).json({ message: limitError.message, requiresOverride: true });
            }
        }
    }

    // --- 5. GENERATE MASTER INVOICE ID ---
    const masterCounter = await req.TenantDailyCounter.findOneAndUpdate(
        { institutionId: instId, date: dateKey, department: 'MASTER_INVOICE' },
        { $inc: { sequence_value: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    const displayId = generateFormattedId(orderFormat, masterCounter.sequence_value);

    // --- 6. FINANCIALS ---
    let financials = {
        totalAmount: calculatedTotal, discountAmount, discountReason, 
        discountAuthorizedBy: authorizerName, discountOverriden: isOverridden,
        netAmount: calculatedTotal - discountAmount, paidAmount: 0,
        dueAmount: calculatedTotal - discountAmount, status: "Pending"
    };

    let transactions = [];
    if (initialPayment && initialPayment.amount > 0) {
        transactions.push({
            paymentMode: initialPayment.mode, amount: Number(initialPayment.amount),
            transactionId: initialPayment.transactionId, notes: initialPayment.notes,
            recordedBy: req.user.userId, date: new Date()
        });
        financials.paidAmount = Number(initialPayment.amount);
        financials.dueAmount = financials.netAmount - financials.paidAmount;
        financials.status = financials.dueAmount <= 0 ? "Paid" : "PartiallyPaid";
    }

    // --- 7. DEPARTMENT & SMART QUEUE GROUPING ---
    const QueueGroupings = {}; 

    for (const item of orderItems) {
        if (item.itemType === 'Test' || item.itemType === 'Package') {
            let dept = "Other";
            if (item.itemType === 'Test') {
                const testDef = await req.TenantTest.findById(item.itemId);
                dept = testDef?.department || "Other";
            }
            
            if (!QueueGroupings[dept]) {
                QueueGroupings[dept] = { department: dept, prefix: null, items: [] };
            }
            QueueGroupings[dept].items.push({ testId: item.itemId, name: item.name });

        } else if (item.itemType === 'Consultation') {
            const doctor = await Doctor.findById(item.itemId);
            if (doctor) {
                // Ensure shiftKey respects the globally passed appointment shift or falls back
                const shiftKey = appointment?.shiftName || item.shiftName || "OPD";
                const doctorQueueId = `${doctor._id}_${shiftKey}`;
                
                if (!QueueGroupings[doctorQueueId]) {
                    const fName = doctor.personalInfo.firstName.toUpperCase().substring(0, 1);
                    const lName = doctor.personalInfo.lastName.toUpperCase().substring(0, 3);
                    
                    QueueGroupings[doctorQueueId] = {
                        department: "Consultation",
                        doctorId: doctor._id.toString(),
                        doctorObj: doctor, // <--- Needed for ETA Math!
                        shiftName: shiftKey, 
                        prefix: `DR${fName}${lName}`, 
                        items: []
                    };
                }
                QueueGroupings[doctorQueueId].items.push({ testId: doctor._id.toString(), name: item.name });
            }
        }
    }

    const departmentOrders = [];
    const generatedTokens = [];
    const defaultPrefixes = { "Pathology": "PAT", "Radiology": "RAD", "Cardiology": "CAR", "Consultation": "DOC", "Other": "OTH" };

    for (const [groupId, groupData] of Object.entries(QueueGroupings)) {
        const { department, doctorId, doctorObj, shiftName, prefix, items: groupItems } = groupData;
        
        // A. Generate Master Department Order ID
        const deptFormatObj = departmentOrderFormats.find(d => d.department === department);
        const deptFormatString = deptFormatObj ? deptFormatObj.format : orderFormat; 
        
        const deptOrderCounter = await req.TenantDailyCounter.findOneAndUpdate(
            { institutionId: instId, date: dateKey, department: `${department}_ORDER` },
            { $inc: { sequence_value: 1 } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        const deptOrderId = generateFormattedId(deptFormatString, deptOrderCounter.sequence_value);
        
        if (!departmentOrders.some(d => d.department === department)) {
             departmentOrders.push({ department: department, orderId: deptOrderId });
        }

        // B. Generate Physical Queue Token
        const counterKey = doctorId ? `DOC_${doctorId}_${shiftName}` : department;
        
        const queueCounter = await req.TenantDailyCounter.findOneAndUpdate(
            { institutionId: instId, date: dateKey, department: counterKey },
            { $inc: { sequence_value: 1 } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        
        const seq = queueCounter.sequence_value;
        const finalPrefix = prefix || defaultPrefixes[department] || "GEN";
        const tokenStr = `${finalPrefix}-${String(seq).padStart(3, '0')}`; 

        // --- CALCULATE ETA FOR DOCTORS ---
        let etaData = { etaFormatted: null, etaDate: null, isOverbooked: false };
        if (doctorId && doctorObj && typeof calculateInitialETA === 'function') {
            const calc = calculateInitialETA(doctorObj, dateKey, shiftName, seq);
            if (calc && calc !== "CANCELLED") {
                etaData = calc;
            }
        }

        // C. Create Queue Entry
        const newToken = new req.TenantQueueToken({
            institutionId: instId,
            date: dateKey,
            department: department,
            doctorId: doctorId || null,
            shiftName: shiftName || null,
            tokenNumber: tokenStr,
            departmentOrderId: deptOrderId, 
            sequence: seq,
            orderId: null, 
            patientId: finalPatientId,
            patientDetails: finalPatientDetails,
            tests: groupItems,
            status: 'WAITING',
            paymentStatus: financials.status,
            estimatedStartTime: etaData.etaDate,
            estimatedTimeFormatted: etaData.etaFormatted,
            isOverbooked: etaData.isOverbooked
        });
        generatedTokens.push(newToken);
    }

    // --- 8. CREATE MASTER ORDER ---
    const newOrder = new req.TenantOrder({
      institutionId: instId,
      orderId: uuidv4(),
      displayId,
      departmentOrders, 
      patientId: finalPatientId, 
      isWalkIn: !!walkin,        
      patientDetails: finalPatientDetails, 
      // --- NEW: INJECT APPOINTMENT DATA ---
      appointment: { 
          doctorId: appointment?.doctorId || null,
          date: finalAppointmentDate, 
          shiftName: appointment?.shiftName || null,
          isFollowUp: appointment?.isFollowUp || false,
          status: "Scheduled" 
      },
      items: orderItems,
      financials,
      transactions,
      notes
    });

    await newOrder.save();

    for (const token of generatedTokens) {
        token.orderId = newOrder._id;
        await token.save();
        sendToBrand(brandCode, { type: 'NEW_TOKEN', token: token }, 'tests_queue_updated');
    }

    sendToBrand(brandCode, { type: 'REFRESH_AVAILABILITY', date: dateKey }, 'tests_availability_updated');
    
    res.status(201).json({ order: newOrder, tokens: generatedTokens });

  } catch (err) {
    console.error("Order Error:", err);
    res.status(500).json({ message: err.message });
  }
});


// 2. LIST ORDERS
router.get("/", async (req, res) => {
  try {
    const { search, startDate, endDate } = req.query;
    let query = {};

    // 1. Date Filtering
    if (startDate && endDate) {
        query.createdAt = {
            $gte: moment(startDate).startOf('day').toDate(),
            $lte: moment(endDate).endOf('day').toDate()
        };
    }

    // 2. Search Logic (Upgraded)
    if (search) {
        query.$or = [
            { displayId: { $regex: search, $options: 'i' } },
            // Walk-in Name Search (Mobile search removed as per requirement)
            { "patientDetails.name": { $regex: search, $options: 'i' } }
        ];
    }

    // 3. Fetch Orders (Tenant Specific)
    const orders = await req.TenantOrder.find(query)
                                        .sort({ createdAt: -1 })
                                        .limit(50);

    // 4. Resolve Patient Data (Hybrid Approach)
    
    // A. Collect IDs for "Registered" patients only
    const registeredPatientIds = orders
        .filter(o => !o.isWalkIn && o.patientId)
        .map(o => o.patientId);

    // B. Fetch Registered Patients from Global DB
    const registeredPatients = await Patient.find({ _id: { $in: registeredPatientIds } });
    
    // Create Lookup Map
    const patientMap = {};
    registeredPatients.forEach(p => {
        patientMap[p._id.toString()] = p;
    });

    // C. Merge Logic
    const mergedOrders = orders.map(order => {
        const orderObj = order.toObject();

        if (order.isWalkIn) {
            // --- SCENARIO 1: WALK-IN (Use Snapshot Data) ---
            orderObj.patient = {
                _id: "WALK-IN",
                firstName: order.patientDetails?.name || "Walk-in Patient",
                lastName: "", 
                age: order.patientDetails?.age,
                gender: order.patientDetails?.gender,
                mobile: "N/A", // Fixed for Walk-in
                isWalkIn: true
            };
        } else {
            // --- SCENARIO 2: REGISTERED (Use Linked DB Record) ---
            const p = patientMap[order.patientId?.toString()];
            
            if (p) {
                orderObj.patient = {
                    _id: p._id,
                    firstName: p.firstName,
                    lastName: p.lastName,
                    age: p.age,
                    gender: p.gender,
                    mobile: p.mobile,
                    uhid: p.uhid,
                    isWalkIn: false
                };
            } else {
                // Fallback for deleted/missing patients
                orderObj.patient = {
                    firstName: "Unknown",
                    lastName: "Patient",
                    mobile: "N/A",
                    isUnknown: true
                };
            }
        }
        return orderObj;
    });

    res.json(mergedOrders);
  } catch (err) {
    console.error("Fetch Orders Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// 3. GET SINGLE ORDER
router.get("/:id", async (req, res) => {
  try {
    const order = await req.TenantOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Convert Mongoose document to plain object so we can attach custom properties
    const orderObj = order.toObject();

    if (order.isWalkIn) {
        // --- SCENARIO 1: WALK-IN ---
        orderObj.patient = {
            _id: "WALK-IN",
            firstName: order.patientDetails?.name || "Walk-in Patient",
            lastName: "", 
            age: order.patientDetails?.age,
            gender: order.patientDetails?.gender,
            mobile: order.patientDetails?.mobile || "N/A", 
            isWalkIn: true
        };
    } else {
        // --- SCENARIO 2: REGISTERED ---
        if (order.patientId) {
            const Patient = require("../models/Patient");
            const p = await Patient.findById(order.patientId);
            
            if (p) {
                orderObj.patient = {
                    _id: p._id,
                    firstName: p.firstName,
                    lastName: p.lastName,
                    age: p.age,
                    gender: p.gender,
                    mobile: p.mobile,
                    uhid: p.uhid,
                    isWalkIn: false
                };
            } else {
                orderObj.patient = { firstName: "Unknown", lastName: "Patient", mobile: "N/A", isUnknown: true };
            }
        } else {
             orderObj.patient = { firstName: "Unknown", lastName: "Patient" };
        }
    }

    // --- NEW: FETCH ALL LIVE QUEUE TOKENS ---
    const tokens = await req.TenantQueueToken.find({ orderId: order._id });
    orderObj.queueTokens = tokens;

    // --- NEW: DYNAMICALLY FETCH DOCTOR SHIFT TIMINGS ---
    if (orderObj.appointment && orderObj.appointment.doctorId) {
        const Doctor = require("../models/Doctor");
        const doc = await Doctor.findById(orderObj.appointment.doctorId);
        
        if (doc) {
            orderObj.appointment.doctorName = `Dr. ${doc.personalInfo.firstName} ${doc.personalInfo.lastName}`;
            
            if (orderObj.appointment.shiftName) {
                const dayIndex = moment(orderObj.appointment.date).day();
                const daySch = doc.schedule?.find(s => s.dayOfWeek === dayIndex);
                const shift = daySch?.shifts?.find(s => s.shiftName === orderObj.appointment.shiftName);
                
                if (shift) {
                    orderObj.appointment.shiftTime = `${moment(shift.startTime, "HH:mm").format("hh:mm A")} - ${moment(shift.endTime, "HH:mm").format("hh:mm A")}`;
                } else {
                     orderObj.appointment.shiftTime = "Time Not Available";
                }
            }
        }
    }

    res.json(orderObj);
  } catch (err) {
    console.error("Get Order Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 4. MODIFY ORDER (Add/Remove Items)
// ==========================================
router.put("/:id/items", async (req, res) => {
    try {
        const { items, discountAmount } = req.body; 
        const order = await req.TenantOrder.findById(req.params.id);
        
        if (!order) return res.status(404).json({ message: "Order not found" });
        if (order.cancellation.isCancelled) return res.status(400).json({ message: "Cannot modify cancelled order." });

        // 1. Calculate New Items Structure
        const { orderItems, calculatedTotal } = await calculateOrderItems(items, req);

        // -------------------------------------------------------------
        // --- NEW SECTION: CAPACITY DELTA CHECK ---
        // -------------------------------------------------------------
        // We need to verify if we need to Reserve or Release slots
        
        // A. Identify what changed
        const oldItemIds = order.items.map(i => i.itemId.toString());
        const newItemIds = orderItems.map(i => i.itemId.toString());

        const addedIds = newItemIds.filter(id => !oldItemIds.includes(id));
        const removedIds = oldItemIds.filter(id => !newItemIds.includes(id));
           const orderDate = order.appointment?.date || new Date();
            const dateKey = moment(orderDate).format("YYYY-MM-DD");
        // Only proceed if there are changes and the order has a date
        if ((addedIds.length > 0 || removedIds.length > 0)) {        

            // B. Handle REMOVED Items (Release Slots)
            if (removedIds.length > 0) {
                const removedTests = await req.TenantTest.find({ _id: { $in: removedIds } });
                for (const test of removedTests) {
                    if (test.dailyLimit !== null && test.dailyLimit > 0) {
                        await req.TenantAvailability.findOneAndUpdate(
                            { testId: test._id.toString(), date: dateKey },
                            { $inc: { count: -1 } }
                        );
                    }
                }
            }

            // C. Handle ADDED Items (Reserve Slots)
            if (addedIds.length > 0) {
                const addedTests = await req.TenantTest.find({ _id: { $in: addedIds } });
                for (const test of addedTests) {
                    if (test.dailyLimit !== null && test.dailyLimit > 0) {
                        
                        // Check Availability
                        const availability = await req.TenantAvailability.findOne({
                            testId: test._id.toString(),
                            date: dateKey
                        });

                        if (availability && availability.count >= test.dailyLimit) {
                            return res.status(400).json({ 
                                message: `Cannot add ${test.name}: Daily limit reached for ${dateKey}.` 
                            });
                        }

                        // Reserve Slot
                        await req.TenantAvailability.findOneAndUpdate(
                            { testId: test._id.toString(), date: dateKey },
                            { 
                                $inc: { count: 1 },
                                $setOnInsert: { dailyLimit: test.dailyLimit }
                            },
                            { upsert: true }
                        );
                    }
                }
            }
        }
        // -------------------------------------------------------------

        // Update Items in Order
        order.items = orderItems;

        // Recalculate Financials
        order.financials.totalAmount = calculatedTotal;
        
        const currentDiscount = discountAmount !== undefined ? discountAmount : order.financials.discountAmount;
        if (currentDiscount > 0) {
            try {
                // Re-validate discount if total changed or discount changed
                const authName = await validateDiscount(req.TenantUser, req.user.userId, calculatedTotal, currentDiscount);
                order.financials.discountAuthorizedBy = `${authName} (${req.user.userId})`;
            } catch (e) {
                return res.status(403).json({ message: e.message });
            }
        }
        if(discountAmount !== undefined) order.financials.discountAmount = discountAmount;
        
        order.financials.netAmount = order.financials.totalAmount - order.financials.discountAmount;
        order.financials.dueAmount = order.financials.netAmount - order.financials.paidAmount;
        
        // Status Update
        if (order.financials.dueAmount <= 0) order.financials.status = "Paid";
        else if (order.financials.paidAmount > 0) order.financials.status = "PartiallyPaid";
        else order.financials.status = "Pending";

        await order.save();
        // Trigger refresh on cancel
        sendToBrand(req.user.institutionId, { type: 'REFRESH_AVAILABILITY', date: dateKey }, 'tests_availability_updated');
        res.json(order);

    } catch(err) {
        console.error("Modify Order Error:", err);
        res.status(500).json({ message: err.message });
    }
});
// ==========================================
// 5. CANCEL ORDER
// ==========================================
router.put("/:id/cancel", async (req, res) => {
    try {
        const { reason } = req.body;
        const order = await req.TenantOrder.findById(req.params.id);
        
        if (!order) return res.status(404).json({ message: "Order not found" });
        if (order.cancellation.isCancelled) return res.status(400).json({ message: "Order is already cancelled." });
        
        const dateKey = moment(order?.appointment?.date).format("YYYY-MM-DD");
        
        // 1. Release Capacity Slots
        if (order.appointment?.date) {
            // Find item IDs
            const itemIds = order.items.map(i => i.itemId);
            const dbTests = await req.TenantTest.find({ _id: { $in: itemIds } });

            for (const dbTest of dbTests) {
                if (dbTest.dailyLimit !== null && dbTest.dailyLimit > 0) {
                    // Decrement count
                    await req.TenantAvailability.findOneAndUpdate(
                        { testId: dbTest._id.toString(), date: dateKey },
                        { $inc: { count: -1 } }
                    );
                }
            }
        }

        // 2. Set Cancellation Details
        order.cancellation = {
            isCancelled: true,
            reason: reason || "No reason provided",
            cancelledBy: req.user.userId,
            date: new Date()
        };
        order.financials.status = "Cancelled";
        order.isReportDeliveryBlocked = true;
        if (order.items && order.items.length > 0) {
            order.items.forEach(item => item.status = "Cancelled");
        }
        if (order.appointment) {
            order.appointment.status = "Cancelled";
        }

        await order.save();

        // 3. --- FIX: CANCEL ALL ASSOCIATED QUEUE TOKENS ---
        
        // A. Cancel standard waiting/hold tokens
        await req.TenantQueueToken.updateMany(
            { 
                orderId: order._id, 
                status: { $in: ['WAITING', 'HOLD'] } 
            },
            { 
                $set: { 
                    status: 'CANCELLED', 
                    notes: `Master Order Cancelled: ${reason || "No reason provided"}` 
                } 
            }
        );

        // B. Override tokens that were previously suspended due to Doctor Absence
        await req.TenantQueueToken.updateMany(
            { 
                orderId: order._id, 
                status: 'DOC_UNVAILABLE' 
            },
            { 
                $set: { 
                    status: 'CANCELLED', 
                    notes: `Master Order Cancelled: ${reason || "No reason provided"} (Note: Previously pending due to Doctor Absence)` 
                } 
            }
        );

        // 4. Trigger SSE to refresh displays and capacity
        sendToBrand(req.user.institutionId, { type: 'REFRESH_AVAILABILITY', date: dateKey }, 'tests_availability_updated');
        
        // Broadcast token update so TV displays and dashboards instantly reflect the changes
        sendToBrand(req.user.institutionId, { type: 'TOKENS_UPDATED' }, 'tests_queue_updated');

        res.json(order);

    } catch(err) {
        console.error("Cancellation Error:", err);
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 6. GENERAL UPDATE (Notes, etc.)
// ==========================================
router.put("/:id", async (req, res) => {
    try {
        const { notes } = req.body;
        const updatedOrder = await req.TenantOrder.findByIdAndUpdate(
            req.params.id,
            { $set: { notes: notes } },
            { new: true }
        );
        res.json(updatedOrder);
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});


// ---------------------------------------------------------
// ROUTE: PRINT BILL PDF
// ---------------------------------------------------------
router.get("/print-bill/:orderId", async (req, res) => {
    try {
        // 1. Fetch Data
        const order = await req.TenantOrder.findById(req.params.orderId);
        if (!order) return res.status(404).json({ message: "Order not found" });

        const patient = await Patient.findById(order.patientId);
        if (!patient) return res.status(404).json({ message: "Patient not found" });

        // 2. Fetch Template
        let template = await req.TenantTemplate.findOne({
            institutionId: req.user.institutionId,
            category: "PRINT",
            "printDetails.type": "BILL",
            isDefault: true
        });

        if (!template) {
            template = await req.TenantTemplate.findOne({
                institutionId: req.user.institutionId,
                category: "PRINT",
                "printDetails.type": "BILL"
            });
        }

        if (!template) return res.status(400).json({ message: "No Billing Template found." });

        const pd = template.printDetails;
        const config = pd.content;

        // 3. Prepare Payload
        const { variables, tableRows } = generateInvoicePayload(order, patient, req.institution);

        // --- RESILIENT COMPILER HELPER ---
        const getNestedValue = (obj, path) => {
            // Helper to safely access deep properties
            return path.split('.').reduce((acc, part) => acc && acc[part], obj);
        };

        const resilientCompile = (templateString, data) => {
            if (!templateString) return "";

            // STEP 1: PRE-PROCESSING (The Fix)
            // Scan for tags that resolve to Objects (e.g., {{patient}}) and replace them with ""
            // This prevents Handlebars from printing "[object Object]" later.
            // Note: The regex excludes tags starting with #, /, or ^ (blocks/helpers).
            const sanitizedTemplate = templateString.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, variablePath) => {
                const value = getNestedValue(data, variablePath);
                
                // If the value is an Object (and not null), wipe the tag out.
                if (typeof value === 'object' && value !== null) {
                    return ""; 
                }
                
                // Otherwise, keep the tag intact for Handlebars to process
                return match;
            });

            // STEP 2: COMPILE
            try {
                // STRATEGY A: Standard Handlebars
                // Now safe because objects are already removed from the string.
                return handlebars.compile(sanitizedTemplate)(data);

            } catch (err) {
                console.warn("[Template Warning] Syntax error detected. Switching to Manual Replacement mode.");
                
                // STRATEGY B: Manual Regex Replacement (Fallback for broken syntax)
                return sanitizedTemplate.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, variablePath) => {
                    const value = getNestedValue(data, variablePath);
                    // Return valid values, else return original text
                    return (value !== undefined && value !== null) ? value : match; 
                });
            }
        };
        // 4. Compile Content Strings
        const compiledHeader = resilientCompile(config.headerHtml, variables);
        const compiledFooter = resilientCompile(config.footerHtml, variables);

        // 5. Build Body Content (Table Only)
        const dynamicTableHtml = buildDynamicTableHtml(config.tableStructure, tableRows, config.accentColor);

        const summaryHtml = `
            <div style="page-break-inside: avoid; margin-top: 10px; display: flex; justify-content: flex-end;">
                <div style="width: 250px; font-size: 12px; font-family: '${config.fontFamily}', sans-serif;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Sub Total:</span> <span>₹${variables.financials.subTotal}</span>
                    </div>
                    ${config.tableStructure.summarySettings.showDiscount && Number(variables.financials.discount) > 0 ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: red;">
                        <span>Discount:</span> <span>- ₹${variables.financials.discount}</span>
                    </div>` : ''}
                    <div style="border-top: 1px solid #ddd; margin: 5px 0;"></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: bold;">
                        <span>Net Amount:</span> <span>₹${variables.financials.netAmount}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Paid:</span> <span>₹${variables.financials.paidAmount}</span>
                    </div>
                     ${config.tableStructure.summarySettings.showDues ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: bold; color: ${Number(variables.financials.dueAmount) > 0 ? 'red' : 'green'};">
                        <span>Balance Due:</span> <span>₹${variables.financials.dueAmount}</span>
                    </div>` : ''}
                     ${config.tableStructure.summarySettings.wordsAmount ? `
                    <div style="margin-top: 10px; font-size: 10px; font-style: italic; color: #666; text-align: right;">
                        (${variables.financials.amountInWords})
                    </div>` : ''}
                </div>
            </div>
        `;

        // 6. Common CSS (Injected into Header, Footer, and Body separately)
       // 6. Common CSS (Injected into Header, Footer, and Body separately)
const cssStyles = `
    <style>
        /* 1. IMPORT FONTS: Must be the very first line in <style> */
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Merriweather:wght@400;700&family=Roboto+Mono:wght@400;700&display=swap');

        /* 2. BASE STYLES */
        html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; width: 100%; }
        
        /* Apply the dynamic font family (Roboto) */
        body { 
            font-family: '${config.fontFamily}', sans-serif; 
            font-size: 12px; 
            color: #000; 
        }
        
        /* 3. QUILL EDITOR SPECIFIC CLASS MAPPINGS */
        /* These are required because the HTML stores the style as a class name */
        .ql-font-serif { 
            font-family: 'Merriweather', 'Georgia', serif; 
        }
        
        .ql-font-monospace { 
            font-family: 'Roboto Mono', 'Courier New', monospace; 
        }

        /* 4. QUILL ALIGNMENT HELPERS */
        .ql-align-center { text-align: center; }
        .ql-align-right { text-align: right; }
        .ql-align-justify { text-align: justify; }
        
        /* 5. GENERAL TAGS */
        p { margin: 0; padding: 1px 0; line-height: 1.2; white-space: pre-wrap; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th, td { padding: 5px; border-bottom: 1px solid #eee; text-align: left; }
    </style>
`;
        // 7. Assemble Body HTML (NO Header/Footer)
        // We only put the table here. Header/Footer are handled via options.
        const bodyHtml = `
            <html>
            <head>${cssStyles}</head>
            <body>
                <div class="page-content" style="padding: 0;">
                    ${dynamicTableHtml}
                    ${summaryHtml}
                </div>
            </body>
            </html>
        `;

        // 8. Generate PDF
        // We pass the compiled header/footer as raw HTML strings. 
        // The handler will measure them and inject them into the PDF engine.
        const rawPdf = await generatePdf(bodyHtml, variables, {
            pageSize: pd.pageSize,
            orientation: pd.orientation,
            margins: pd.margins, // User's desired edge margins (left/right)
            
            // Pass the CONTENT for measurement and rendering
            headerHtml: compiledHeader, 
            footerHtml: compiledFooter,
            
            // Pass the styles so the measurement is accurate
            headerStyles: cssStyles 
        });

        const finalBuffer = Buffer.from(rawPdf);

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="Bill-${order.displayId}.pdf"`,
            "Content-Length": finalBuffer.length,
        });

        res.send(finalBuffer);

    } catch (err) {
        console.error("Print Bill Error:", err);
        res.status(500).json({ message: "Failed to generate Bill PDF", error: err.message });
    }
});
module.exports = router;