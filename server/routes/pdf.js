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
        if (!institution) return res.status(404).json({ message: "Institution not found" });

        const tenantDb = mongoose.connection.useDb(institution.dbName, { useCache: true });
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
        const billTemplate = templates.find(t => t.isDefault && t.type === "BILL") || templates[0];

        if (!billTemplate) return res.status(500).send("No billing template configured");

        // 4. Construct HTML
        const { content } = billTemplate;
        
        const fullHtml = `
            <html>
            <head>
                <style>
                    body { font-family: ${content.fontFamily || 'Roboto'}, sans-serif; font-size: 12px; padding: 0; margin: 0; }
                    .header { border-bottom: 2px solid ${content.accentColor}; margin-bottom: 20px; display: flex; justify-content: space-between; padding-bottom: 10px; }
                    .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    .table th { background: ${content.accentColor}; color: white; padding: 8px; text-align: left; }
                    .table td { border-bottom: 1px solid #eee; padding: 8px; }
                    .totals { float: right; width: 200px; margin-top: 20px; text-align: right; }
                    .footer { position: fixed; bottom: 0; left: 0; width: 100%; text-align: center; font-size: 10px; color: #888; padding: 10px; border-top: 1px solid #eee; background: white; }
                    h1 { margin: 0; color: ${content.accentColor}; }
                    .page-content { padding: 20px; }
                </style>
            </head>
            <body>
                <div class="page-content">
                    <div class="header">
                        <div>
                            ${content.showLogo && req.institution.institutionLogoUrl ? `<img src="${req.institution.institutionLogoUrl}" height="50" style="margin-bottom: 10px;" />` : ''}
                            <div style="font-size: 14px;">${content.headerHtml || ''}</div>
                        </div>
                        <div style="text-align: right;">
                            <h1>INVOICE</h1>
                            <p><strong>#{{displayId}}</strong></p>
                            <p>{{formatDate createdAt}}</p>
                        </div>
                    </div>

                    <div class="patient-info">
                        <strong>Bill To:</strong><br/>
                        <span style="font-size: 1.1em">{{patient.firstName}} {{patient.lastName}}</span><br/>
                        Mobile: {{patient.mobile}}<br/>
                        Age/Sex: {{patient.age}} / {{patient.gender}}
                    </div>

                    <table class="table">
                        <thead>
                            <tr><th>Service</th><th style="text-align:right">Price</th></tr>
                        </thead>
                        <tbody>
                            {{#each items}}
                            <tr>
                                <td>{{this.name}} {{#if (eq this.itemType "Package")}}<small>(Pkg)</small>{{/if}}</td>
                                <td style="text-align:right">{{formatCurrency this.price}}</td>
                            </tr>
                            {{/each}}
                        </tbody>
                    </table>

                    <div class="totals">
                        <p>Total: {{formatCurrency financials.totalAmount}}</p>
                        {{#if financials.discountAmount}}
                            <p style="color: red">Discount: -{{formatCurrency financials.discountAmount}}</p>
                        {{/if}}
                        <h3>Net: {{formatCurrency financials.netAmount}}</h3>
                        <p style="color: green; font-weight: bold;">Paid: {{formatCurrency financials.paidAmount}}</p>
                        {{#if financials.dueAmount}}
                            <p style="color: #cf1322; font-weight: bold;">Due: {{formatCurrency financials.dueAmount}}</p>
                        {{/if}}
                    </div>
                </div>

                <div class="footer">
                    ${content.footerHtml || ''}
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
            "Content-Length": finalBuffer.length
        });
        
        res.send(finalBuffer);

    } catch (err) {
        console.error("PDF Route Error:", err);
        res.status(500).send("Error generating PDF");
    }
});

module.exports = router;