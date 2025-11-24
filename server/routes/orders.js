const express = require("express");
const router = express.Router();
const moment = require("moment");
const { v4: uuidv4 } = require("uuid");

// Models
const Order = require("../models/Order");
const Test = require("../models/Test");
const Package = require("../models/Package");
const Patient = require("../models/Patient");

// Middleware
const { authenticateUser } = require("../middleware/auth");

// ==========================================
// 1. CREATE ORDER (Booking)
// ==========================================
router.post("/", authenticateUser, async (req, res) => {
  try {
    const { 
      patientId, 
      referringDoctor, 
      items, // Array of { type: 'test'|'package', id: '...' }
      discount = 0, 
      paymentMode 
    } = req.body;
    
    const instId = req.user.institutionId;

    // Validate Patient
    const patient = await Patient.findOne({ _id: patientId, institutionId: instId });
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    // Arrays to hold our final data
    let orderItems = []; // This goes into DB
    let totalAmount = 0;

    // ---------------------------------------------------------
    // CORE LOGIC: Loop through items (Tests or Packages)
    // ---------------------------------------------------------
    for (const item of items) {
      
      // === SCENARIO A: It is a Single Test ===
      if (item.type === 'test') {
        const test = await Test.findOne({ _id: item.id, institutionId: instId });
        
        if (test) {
          // 1. Financials: Add full test price
          totalAmount += test.price;

          // 2. Worklist: Add test parameters for the technician
          orderItems.push({
            itemType: "Test",
            itemId: test._id,
            name: test.name,
            price: test.price,
            financials: { institutionShare: test.price, doctorShare: 0 },

            // Legacy/Extra fields for reports
            status: "Pending",
            results: test.department === 'Pathology' 
              ? test.parameters.map(p => ({ 
                  parameterName: p.name, 
                  unit: p.unit, 
                  refRange: p.bioRefRange?.General?.text || "-"
                })) 
              : []
          });
        }
      } 
      
      // === SCENARIO B: It is a Package (Bundle) ===
      else if (item.type === 'package') {
        // Fetch package and populate the tests inside it
        const pkg = await Package.findOne({ _id: item.id, institutionId: instId })
                                 .populate('tests');
        
        if (pkg) {
          // 1. Financials: Add PACKAGE price
          totalAmount += pkg.offerPrice;

          // 2. Worklist: Unfold package -> Tests
          // Logic: We add the Package as an Item? Or the Tests?
          // To keep reporting simple, let's add individual Tests as items, but with price 0

          if (pkg.tests && pkg.tests.length > 0) {
            pkg.tests.forEach(test => {
              orderItems.push({
                itemType: "Test", // Tech treats it as a test
                itemId: test._id,
                name: `${test.name} (Pkg: ${pkg.name})`,
                price: 0, // Bundled
                financials: { institutionShare: 0, doctorShare: 0 },
                
                status: "Pending",
                results: test.department === 'Pathology' 
                  ? test.parameters.map(p => ({ 
                      parameterName: p.name, 
                      unit: p.unit,
                      refRange: p.bioRefRange?.General?.text || "-" 
                    })) 
                  : []
              });
            });
          }
        }
      }
    }

    if (orderItems.length === 0) {
      return res.status(400).json({ message: "No valid tests or packages selected." });
    }

    // ---------------------------------------------------------
    // GENERATE IDs
    // ---------------------------------------------------------
    // Format: YYMMDD-001 (Daily incremental)
    const startOfDay = moment().startOf('day').toDate();
    const count = await Order.countDocuments({ 
      institutionId: instId, 
      createdAt: { $gte: startOfDay } 
    });
    
    const dateStr = moment().format("YYMMDD");
    const displayId = `${dateStr}-${String(count + 1).padStart(3, '0')}`;

    // ---------------------------------------------------------
    // CALCULATE FINAL BILL
    // ---------------------------------------------------------
    const netAmount = totalAmount - discount;

    // ---------------------------------------------------------
    // SAVE ORDER
    // ---------------------------------------------------------
    const newOrder = new Order({
      institutionId: instId,
      orderId: uuidv4(),
      displayId: displayId,
      patientId: patientId,
      
      // Note: referringDoctor field was in route but maybe not in schema?
      // Schema has 'appointment.doctorId'. If this is an external ref doc, we might need a field for it.
      // Checking Order.js: It has 'appointment.doctorId'.
      // If 'referringDoctor' is just a string name, we might need to add it to schema or put it in notes.
      // For now, let's map it if it exists or ignore.

      items: orderItems,
      
      totalAmount,
      netAmount, // Discount handled in frontend or separate logic needed
      paymentStatus: "Pending"
    });

    await newOrder.save();

    res.status(201).json({ message: "Order created successfully", order: newOrder });

  } catch (err) {
    console.error("Order Create Error:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});


// ==========================================
// 2. ENTER RESULTS (Technician / Doctor)
// ==========================================
router.put("/:orderId/results", authenticateUser, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { testId, results, reportText, status } = req.body; 
    // results is an Array: [{ parameterName: 'Hb', value: '12.5' }]

    const order = await Order.findOne({ 
      _id: orderId, 
      institutionId: req.user.institutionId 
    });

    if (!order) return res.status(404).json({ message: "Order not found" });

    // Find the specific test row within the order
    // We use .id() if it's a subdocument array with _id, or .find() manual
    const testItem = order.items.find(t => (t.itemId && t.itemId.toString() === testId) || t._id.toString() === testId);

    if (!testItem) return res.status(404).json({ message: "Test not found in order" });

    // Update PATHOLOGY Results
    if (results && Array.isArray(results)) {
      results.forEach(inputRes => {
        // Find the parameter inside the test item
        const param = testItem.results.find(p => p.parameterName === inputRes.parameterName);
        if (param) {
          param.value = inputRes.value;
          // You can add logic here to auto-set 'High'/'Low' flag based on ranges
          if (inputRes.flag) param.flag = inputRes.flag;
        }
      });
    }

    // Update RADIOLOGY Report (Text based)
    if (reportText) {
      testItem.reportText = reportText;
    }

    // Update Status (e.g. from 'Pending' -> 'Authorized')
    if (status) {
      testItem.status = status;
      if (status === 'Authorized') {
        testItem.approvedBy = req.user.userId; // Sign off
        testItem.approvedAt = new Date();
      }
    }

    await order.save();
    res.json({ message: "Results updated", order });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// 3. GET SINGLE ORDER (For View/Print)
// ==========================================
router.get("/:id", authenticateUser, async (req, res) => {
  try {
    const order = await Order.findOne({ 
      _id: req.params.id, 
      institutionId: req.user.institutionId 
    })
    .populate("patientId"); // Get full patient details

    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// 4. LIST ORDERS (Dashboard)
// ==========================================
router.get("/", authenticateUser, async (req, res) => {
  try {
    const { fromDate, toDate, search } = req.query;
    const instId = req.user.institutionId;

    let query = { institutionId: instId };

    // Date Filter
    if (fromDate && toDate) {
      query.createdAt = {
        $gte: moment(fromDate).startOf('day').toDate(),
        $lte: moment(toDate).endOf('day').toDate()
      };
    } else {
      // Default to today if no date provided? Or last 7 days?
      // query.createdAt = { $gte: moment().startOf('day').toDate() };
    }

    // Text Search (Display ID or Patient Name requires aggregation lookup or separate index)
    // For simplicity, let's search DisplayID or simple exact match
    if (search) {
      query.$or = [
        { displayId: { $regex: search, $options: 'i' } },
        { referringDoctor: { $regex: search, $options: 'i' } }
      ];
    }

    const orders = await Order.find(query)
      .populate("patientId", "firstName lastName mobile")
      .sort({ createdAt: -1 })
      .limit(50); // Pagination recommended for prod

    res.json(orders);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;