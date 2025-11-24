const express = require("express");
const router = express.Router();
const puppeteer = require("puppeteer");
const ExcelJS = require("exceljs");
const moment = require("moment");
const Order = require("../models/Order");
const Patient = require("../models/Patient");
const { authenticateUser } = require("../middleware/auth");

// Helper: Generate HTML for PDF (You should move this to a separate template file)
const generateReportHTML = (order, patient) => {
  return `
    <html>
      <head>
        <style>
          body { font-family: Helvetica, sans-serif; padding: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .patient-info { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .abnormal { color: red; font-weight: bold; }
          .footer { position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Pathology Report</h1>
          <p>Order ID: ${order.displayId}</p>
        </div>
        
        <div class="patient-info">
          <div>
            <strong>Patient:</strong> ${patient.firstName} ${patient.lastName}<br>
            <strong>Age/Gender:</strong> ${patient.age} / ${patient.gender}
          </div>
          <div>
            <strong>Date:</strong> ${moment(order.createdAt).format("DD-MMM-YYYY")}<br>
            <strong>Ref By:</strong> ${order.referringDoctor || "Self"}
          </div>
        </div>

        <h3>Test Results</h3>
        ${(order.items || []).filter(item => item.itemType === 'Test').map(test => `
          <h4>${test.name}</h4>
          <table class="table">
            <thead><tr><th>Parameter</th><th>Result</th><th>Unit</th><th>Ref Range</th></tr></thead>
            <tbody>
              ${(test.results || []).map(res => `
                <tr>
                  <td>${res.parameterName}</td>
                  <td class="${res.flag === 'High' || res.flag === 'Low' ? 'abnormal' : ''}">${res.value}</td>
                  <td>${res.unit}</td>
                  <td>${res.refRange || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `).join('')}
        
        <div class="footer">Generated via LIMS on ${moment().format('LLL')}</div>
      </body>
    </html>
  `;
};

// 1. Generate PDF Report (Returns Blob)
router.get("/download-pdf/:orderId", authenticateUser, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Fetch Data
    const order = await Order.findOne({ orderId, institutionId: req.user.institutionId });
    if (!order) return res.status(404).json({ message: "Order not found" });
    
    const patient = await Patient.findById(order.patientId);

    // Generate HTML
    const htmlContent = generateReportHTML(order, patient);

    // Launch Puppeteer
    const browser = await puppeteer.launch({ 
        headless: "new", 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required for some cloud environments
    });
    const page = await browser.newPage();
    
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    
    const pdfBuffer = await page.pdf({ 
      format: "A4", 
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm" }
    });

    await browser.close();

    // Send Blob Response
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=Report-${order.displayId}.pdf`,
      "Content-Length": pdfBuffer.length,
    });
    
    res.send(pdfBuffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "PDF Generation Failed", error: err.message });
  }
});


// 2. Generate Excel MIS Report (Returns Blob)
router.get("/export-excel", authenticateUser, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Filter orders
    const query = { 
      institutionId: req.user.institutionId,
      createdAt: {
        $gte: moment(startDate).startOf('day').toDate(),
        $lte: moment(endDate).endOf('day').toDate()
      }
    };
    
    const orders = await Order.find(query).populate("patientId", "firstName lastName mobile");

    // Create Workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");

    // Define Columns
    worksheet.columns = [
      { header: "Date", key: "date", width: 15 },
      { header: "Order ID", key: "displayId", width: 15 },
      { header: "Patient Name", key: "patient", width: 25 },
      { header: "Mobile", key: "mobile", width: 15 },
      { header: "Doctor", key: "doctor", width: 20 },
      { header: "Total Amount", key: "total", width: 15 },
      { header: "Payment Status", key: "status", width: 15 },
    ];

    // Add Rows
    orders.forEach(order => {
      worksheet.addRow({
        date: moment(order.createdAt).format("DD-MM-YYYY"),
        displayId: order.displayId,
        patient: order.patientId ? `${order.patientId.firstName} ${order.patientId.lastName}` : "N/A",
        mobile: order.patientId ? order.patientId.mobile : "",
        doctor: order.referringDoctor,
        total: order.netAmount,
        status: order.paymentStatus
      });
    });

    // Style Header
    worksheet.getRow(1).font = { bold: true };

    // Buffer Response
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Sales_Report_${startDate}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Excel Export Failed", error: err.message });
  }
});

module.exports = router;