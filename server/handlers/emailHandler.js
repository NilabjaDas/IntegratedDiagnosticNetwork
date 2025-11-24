// emailHandler.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: "smtp.sendgrid.net",
  port: 587,
  auth: {
    user: "apikey",
    pass: process.env.SENDGRID_API_KEY,
  },
});

async function sendEmailReport({ pdfBuffer, subject, primaryRecipients, ccRecipients, brandName, brandLogo, brandAddress,reportDate }) {
  const mailOptions = {
    from: '"GuestHub Daily Reports" <guesthubreports@techfloater.com>',
    to: primaryRecipients.join(", "),
    cc: ccRecipients.join(", "),
    subject: "IMPORTANT: " + subject,
    text: "Please find attached the report.",
    html: `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; font-size: 14px; }
            .header { text-align: center; margin-bottom: 20px; }
            .header img { max-width: 150px; }
            .header h2 { margin: 10px 0 0; }
            .header p { margin: 4px 0 0; font-size: 12px; }
            .content { margin: 20px; }
            .content p { line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${brandLogo}" alt="${brandName}" />
            <h2>${brandName}</h2>
            <p>${brandAddress}</p>
          </div>
          <div class="content">
            <p>Dear Team,</p>
            <p>Please find attached the report for <strong>${brandName}</strong>. This report provides detailed insights into check-in statistics, scanning issues, document types, and Aadhaar verification statuses.</p>
         <p>Thank you for your time and cooperation.</p>
<p>Best regards,<br>
GuestHub Automated Reporting System<br>
Please do not reply to this email.</p>

          </div>
        </body>
      </html>
    `,
    attachments: [
      {
        filename: `GuestHub Report - ${brandName} | ${reportDate}.pdf`,
        content: pdfBuffer,
      },
    ],
    headers: {
        'X-Priority': '1 (Highest)',
        'X-MSMail-Priority': 'High',
        'Importance': 'High'
      }
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Report email sent");
    return info;
  } catch (error) {
    console.error("Error sending report email:", error);
    throw error;
  }
}

module.exports = { sendEmailReport };
