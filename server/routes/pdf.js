const express = require("express");
const router = express.Router();
const Institution = require("../models/Institutions");
const OrderSchema = require("../models/Order");
const PatientSchema = require("../models/Patient");
const getModel = require("../middleware/getModelsHandler");
const { verifyToken } = require("../middleware/verifyToken");
const { generatePdf } = require("../handlers/pdfHandler");
const mongoose = require("mongoose");

// --- Tenant Middleware ---
const getTenantContext = async (req, res, next) => {
  try {
    const institutionId = req.user.institutionId;
    const institution = await Institution.findOne({ institutionId });
    if (!institution)
      return res.status(404).json({ message: "Institution not found" });

    const tenantDb = mongoose.connection.useDb(institution.dbName, {
      useCache: true,
    });
    req.TenantOrder = getModel(tenantDb, "Order", OrderSchema);
    req.institution = institution;

    next();
  } catch (err) {
    res.status(500).json({ message: "DB Error" });
  }
};

router.use(verifyToken, getTenantContext);

// GENERATE BILL PDF
router.get("/bill/:orderId", async (req, res) => {
  try {
    // 1. Fetch Order
    const order = await req.TenantOrder.findById(req.params.orderId);
    if (!order) return res.status(404).send("Order not found");

    // 2. Manual Populate Patient
    const Patient = require("../models/Patient");
    const patient = await Patient.findById(order.patientId);
    const orderData = order.toObject();
    orderData.patient = patient ? patient.toObject() : {};

    // 3. Get Template
    const templates = req.institution.printTemplates || [];
    const billTemplate =
      templates.find((t) => t.isDefault && t.type === "BILL") || templates[0];

    if (!billTemplate)
      return res.status(500).send("No billing template configured");

    // 4. Construct HTML
    const { content } = billTemplate;


    const fullHtml = `
    <html>
    <body style="position: relative;">

        <div class="page-content" style="position: relative; z-index: 1;">
           </div>
    </body>
    </html>
`;

    // 5. Generate
    const rawPdf = await generatePdf(fullHtml, orderData, billTemplate);

    // --- CRITICAL FIX: Ensure Buffer ---
    const finalBuffer = Buffer.from(rawPdf);

    // 6. Send Response
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Bill-${order.displayId}.pdf"`,
      "Content-Length": finalBuffer.length,
    });

    res.send(finalBuffer);
  } catch (err) {
    console.error("PDF Route Error:", err);
    res.status(500).send("Error generating PDF");
  }
});

module.exports = router;
