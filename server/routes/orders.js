const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const moment = require("moment");
const { v4: uuidv4 } = require("uuid");

const Institution = require("../models/Institutions");
const Patient = require("../models/Patient"); // Master DB Import for Merging

// Schemas
const OrderSchema = require("../models/Order");
const TestSchema = require("../models/Test");
const PackageSchema = require("../models/Package");

const getModel = require("../middleware/getModelsHandler");
const { verifyToken } = require("../middleware/verifyToken");

// --- HELPER: Merge Patient Info ---
const mergePatientsWithOrders = async (orders) => {
    const patientIds = [...new Set(orders.map(o => o.patientId).filter(id => id))];
    const patients = await Patient.find({ _id: { $in: patientIds } });
    const patientMap = {};
    patients.forEach(p => { patientMap[p._id.toString()] = p; });

    return orders.map(order => {
        const orderObj = order.toObject ? order.toObject() : order;
        orderObj.patient = patientMap[orderObj.patientId.toString()] || null;
        return orderObj;
    });
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
    
    next();
  } catch (err) {
    res.status(500).json({ message: "Database Connection Error" });
  }
};

router.use(verifyToken, getTenantContext);

// 1. CREATE ORDER
router.post("/", async (req, res) => {
  try {
    const { patientId, items, paymentMode, discountAmount = 0 } = req.body;
    const instId = req.user.institutionId;

    // A. Verify Patient Exists Globally
    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ message: "Patient not found in global registry." });

    // B. Build Line Items
    let orderItems = [];
    let totalAmount = 0;

    for (const item of items) {
      if (item.type === 'Test') {
        const test = await req.TenantTest.findById(item._id);
        if (test) {
          totalAmount += (test.price || 0);
          orderItems.push({
            itemType: "Test",
            itemId: test._id,
            name: test.name,
            price: test.price || 0,
            status: "Pending",
            results: test.parameters?.map(p => ({ name: p.name, unit: p.unit, value: "" })) || []
          });
        }
      } else if (item.type === 'Package') {
        const pkg = await req.TenantPackage.findById(item._id).populate('tests');
        if (pkg) {
          totalAmount += (pkg.offerPrice || 0);
          if (pkg.tests) {
            pkg.tests.forEach(t => {
               if(t._id) {
                   orderItems.push({
                    itemType: "Test",
                    itemId: t._id,
                    name: `${t.name} (Pkg)`,
                    price: 0,
                    parentPackageId: pkg._id,
                    status: "Pending",
                    results: t.parameters?.map(p => ({ name: p.name, unit: p.unit, value: "" })) || []
                   });
               }
            });
          }
        }
      }
    }

    if (orderItems.length === 0) return res.status(400).json({ message: "No valid items." });

    // C. Generate ID
    const startOfDay = moment().startOf('day').toDate();
    const count = await req.TenantOrder.countDocuments({ createdAt: { $gte: startOfDay } });
    const displayId = `${moment().format("YYMMDD")}-${String(count + 1).padStart(3, '0')}`;

    // D. Save Order
    const newOrder = new req.TenantOrder({
      institutionId: instId,
      orderId: uuidv4(),
      displayId,
      patientId: patient._id, 
      items: orderItems,
      
      // -- NEW FINANCIALS STRUCTURE --
      financials: {
          totalAmount,
          discountAmount,
          netAmount: totalAmount - discountAmount,
          paidAmount: 0, // Will be updated if immediate payment exists
          dueAmount: totalAmount - discountAmount
      },
      transactions: []
    });

    // E. Handle Immediate Payment (if sent with booking)
    // Expecting req.body.initialPayment = { mode: 'Cash', amount: 500, transactionId: '...' }
    if (req.body.initialPayment && req.body.initialPayment.amount > 0) {
        const { mode, amount, transactionId, notes } = req.body.initialPayment;
        
        newOrder.transactions.push({
            paymentMode: mode,
            amount: Number(amount),
            transactionId,
            notes,
            recordedBy: req.user.userId
        });

        newOrder.financials.paidAmount = Number(amount);
        newOrder.financials.dueAmount = newOrder.financials.netAmount - Number(amount);
    }

    await newOrder.save();
    
    // E. Update Patient Enrollment
    if(!patient.enrolledInstitutions.includes(instId)){
        patient.enrolledInstitutions.push(instId);
        await patient.save();
    }

    res.status(201).json(newOrder);

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

    if (startDate && endDate) {
        query.createdAt = {
            $gte: moment(startDate).startOf('day').toDate(),
            $lte: moment(endDate).endOf('day').toDate()
        };
    }
    if (search) {
        query.displayId = { $regex: search, $options: 'i' };
    }

    const orders = await req.TenantOrder.find(query).sort({ createdAt: -1 }).limit(50);
    const mergedOrders = await mergePatientsWithOrders(orders);

    res.json(mergedOrders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;