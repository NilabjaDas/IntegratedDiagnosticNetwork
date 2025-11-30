const express = require("express");
const router = express.Router();
const Institution = require("../models/Institutions");
const OrderSchema = require("../models/Order");
const PatientSchema = require("../models/Patient");
const getModel = require("../middleware/getModelsHandler");
const { verifyToken } = require("../middleware/verifyToken");
const { generatePdf } = require("../handlers/pdfHandler");
const mongoose = require("mongoose");
const puppeteer = require("puppeteer");
const fs = require("fs");

let browser = null;

const getBrowser = async () => {
    if (!browser) {
        // 1. Define potential paths for Chrome on Windows
        const possiblePaths = [
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
            // Add your specific path if different
        ];

        // 2. Find the valid path
        const chromePath = possiblePaths.find(path => fs.existsSync(path));

        if (!chromePath) {
            console.warn("⚠️ Could not find local Chrome. Trying default Puppeteer bundle...");
        } else {
            console.log(`✅ Using Local Chrome at: ${chromePath}`);
        }

        // 3. Launch with executablePath
        browser = await puppeteer.launch({
            executablePath: chromePath, // <--- THIS IS THE FIX
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });
    }
    return browser;
};
// --- Tenant Middleware (Reused) ---
const getTenantContext = async (req, res, next) => {
    /* ... Same as your orders.js middleware ... */
    try {
        const institutionId = req.user.institutionId;
        const institution = await Institution.findOne({ institutionId });
        if (!institution) return res.status(404).json({ message: "Institution not found" });

        const tenantDb = mongoose.connection.useDb(institution.dbName, { useCache: true });
        req.TenantOrder = getModel(tenantDb, "Order", OrderSchema);
        req.institution = institution; // Attach full institution for templates
        
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

        // 2. Manual Populate Patient (Cross-DB)
        // (Assuming you have the Patient Model imported or logic from orders.js)
        // For brevity, fetching patient:
        const Patient = require("../models/Patient");
        const patient = await Patient.findById(order.patientId);
        const orderData = order.toObject();
        orderData.patient = patient ? patient.toObject() : {};

        // 3. Get Template
        const templates = req.institution.printTemplates || [];
        const billTemplate = templates.find(t => t.isDefault && t.type === "BILL") || templates[0];

        // 4. Construct Full HTML (Header + Body + Footer)
        // We construct a full HTML page because Puppeteer needs a complete document
        const { content } = billTemplate;
        
        const fullHtml = `
            <html>
            <head>
                <style>
                    body { font-family: ${content.fontFamily || 'Roboto'}; font-size: 12px; }
                    .header { border-bottom: 2px solid ${content.accentColor}; margin-bottom: 20px; display: flex; justify-content: space-between; }
                    .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    .table th { background: ${content.accentColor}; color: white; padding: 8px; text-align: left; }
                    .table td { border-bottom: 1px solid #eee; padding: 8px; }
                    .totals { float: right; width: 200px; margin-top: 20px; }
                    .footer { margin-top: 50px; border-top: 1px solid #eee; text-align: center; font-size: 10px; color: #888; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        ${content.showLogo ? `<img src="${req.institution.institutionLogoUrl}" height="50" />` : ''}
                        ${content.headerHtml}
                    </div>
                    <div style="text-align: right;">
                        <h1>INVOICE</h1>
                        <p>#{{displayId}}</p>
                        <p>{{formatDate createdAt}}</p>
                    </div>
                </div>

                <div class="patient-info">
                    <strong>Bill To:</strong><br/>
                    {{patient.firstName}} {{patient.lastName}}<br/>
                    {{patient.mobile}}
                </div>

                <table class="table">
                    <thead>
                        <tr><th>Service</th><th style="text-align:right">Price</th></tr>
                    </thead>
                    <tbody>
                        {{#each items}}
                        <tr>
                            <td>{{this.name}}</td>
                            <td style="text-align:right">{{formatCurrency this.price}}</td>
                        </tr>
                        {{/each}}
                    </tbody>
                </table>

                <div class="totals">
                    <p>Total: {{formatCurrency financials.totalAmount}}</p>
                    <p>Discount: -{{formatCurrency financials.discountAmount}}</p>
                    <h3>Net: {{formatCurrency financials.netAmount}}</h3>
                    <p style="color: green">Paid: {{formatCurrency financials.paidAmount}}</p>
                    <p style="color: red">Due: {{formatCurrency financials.dueAmount}}</p>
                </div>

                <div class="footer">
                    ${content.footerHtml}
                </div>
            </body>
            </html>
        `;

        // 5. Generate
        const pdfBuffer = await generatePdf(fullHtml, orderData, billTemplate);

        // 6. Send Response
        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename=invoice_${order.displayId}.pdf`,
            "Content-Length": pdfBuffer.length
        });
        res.send(pdfBuffer);

    } catch (err) {
        console.error(err);
        res.status(500).send("Error generating PDF");
    }
});


router.get("/", async (req, res) => {
  try {
    console.log("--- Starting PDF Test ---");

    // 1. Launch Browser (Minimal Config)
 const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    console.log("1. Browser Launched");

    const page = await browser.newPage();
    console.log("2. Page Created");

    // 2. Simple Content
    const htmlContent = `
      <html>
        <head>
            <style>body { font-family: sans-serif; padding: 50px; text-align: center; }</style>
        </head>
        <body>
            <h1>PDF Generation Working!</h1>
            <p>If you can read this, Puppeteer is correctly configured.</p>
            <div style="margin-top: 50px; padding: 20px; background: #f0f0f0;">
                Generated at: ${new Date().toLocaleString()}
            </div>
        </body>
      </html>
    `;

    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    console.log("3. Content Set");

    // 3. Generate Buffer
    const pdfBuffer = await page.pdf({ format: "A4",  printBackground: true,
      displayHeaderFooter: true,
 });
    console.log("4. PDF Buffer Generated. Size:", pdfBuffer.length);

    await browser.close();
    console.log("5. Browser Closed");

    // 4. Send Response
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="test.pdf"',
      "Content-Length": pdfBuffer.length
    });

    res.send(pdfBuffer);
  } catch (err) {
    console.error("PDF Test FAILED:", err);
    res.status(500).json({ 
        message: "PDF Generation Failed", 
        error: err.message,
        stack: err.stack 
    });
  }
});

module.exports = router;