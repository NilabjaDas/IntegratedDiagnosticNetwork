const { ToWords } = require('to-words'); // Optional: for "Five Hundred Only"
const moment = require("moment");

const toWords = new ToWords({
  localeCode: 'en-IN',
  converterOptions: { currency: true, ignoreDecimal: false, ignoreZeroCurrency: false },
});

/**
 * 1. Payload Generator: Maps DB Objects to Flat Data for Handlebars
 */
const generateInvoicePayload = (order, patient, institution) => {
    const financials = order.financials;

    // A. Flatten Variables for Header/Footer (e.g., {{patient.name}})
    const variables = {
        patient: {
            name: patient.name,
            age: patient.age || "N/A",
            gender: patient.gender || "",
            displayId: patient.displayId || patient.uhid || "",
            phone: patient.phone || ""
        },
        order: {
            displayId: order.displayId,
            date: moment(order.createdAt).format("DD/MM/YYYY"),
            time: moment(order.createdAt).format("h:mm A"),
        },
        institution: {
            name: institution.institutionName,
            address: {
                line1: institution.address.line1,
                city: institution.address.city,
                state: institution.address.state
            },
            contact: {
                phone: institution.contact.phone,
                email: institution.contact.email
            }
        },
        financials: {
            subTotal: financials.totalAmount.toFixed(2),
            discount: financials.discountAmount.toFixed(2),
            netAmount: financials.netAmount.toFixed(2),
            paidAmount: financials.paidAmount.toFixed(2),
            dueAmount: financials.dueAmount.toFixed(2),
            status: financials.status,
            amountInWords: toWords.convert(financials.netAmount)
        }
    };

    // B. Flatten Table Rows
    // We add an index and ensure numbers are formatted
    const tableRows = order.items.map((item, index) => ({
        index: index + 1,
        name: item.name,
        type: item.itemType, // Test/Package
        price: item.price.toFixed(2),
        qty: 1, 
        total: item.price.toFixed(2), // Assuming Qty 1 for Labs
        // CSS Helper for cancelled items
        status: item.status
    }));

    return { variables, tableRows };
};

/**
 * 2. HTML Table Builder: Converts Rows + Config -> HTML String
 */
const buildDynamicTableHtml = (tableStructure, rows, accentColor) => {
    const { columns, showHead, striped, density } = tableStructure;
    
    // Density Styles
    let padding = "10px";
    if (density === "compact") padding = "5px";
    if (density === "spacious") padding = "15px";

    // 1. Build Header
    let thead = "";
    if (showHead) {
        let ths = "";
        columns.forEach(col => {
            if (col.visible) {
                ths += `<th style="text-align: ${col.align}; width: ${col.width}; padding: ${padding}; border-bottom: 2px solid #ddd;">${col.label}</th>`;
            }
        });
        thead = `<thead style="color: ${accentColor};"><tr>${ths}</tr></thead>`;
    }

    // 2. Build Body
    let tbodyRows = "";
    rows.forEach((row, i) => {
        // Stripe Logic
        const bg = striped && i % 2 !== 0 ? "#f9f9f9" : "transparent";
        // Cancelled Logic
        const style = row.status === "Cancelled" ? "text-decoration: line-through; color: #ff4d4f;" : "";

        let tds = "";
        columns.forEach(col => {
            if (col.visible) {
                // Access data using the key from config (e.g. "price", "name")
                const val = row[col.dataKey] || "-";
                tds += `<td style="text-align: ${col.align}; padding: ${padding}; ${style}">${val}</td>`;
            }
        });
        tbodyRows += `<tr style="background-color: ${bg}; border-bottom: 1px solid #eee;">${tds}</tr>`;
    });

    return `<table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
        ${thead}
        <tbody>${tbodyRows}</tbody>
    </table>`;
};

module.exports = { generateInvoicePayload, buildDynamicTableHtml };