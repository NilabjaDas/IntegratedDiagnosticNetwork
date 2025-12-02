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
            name: patient.firstName || "" + " " + patient.lastName || "",
            age: patient.age + " " + patient.ageUnit || "N/A",
            gender: patient.gender || "",
            displayId: patient.displayId || patient.uhid || "",
            phone: patient.mobile || "",
            email : patient.email || ""
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
        },
        page_info: `Page <span class="pageNumber"></span> of <span class="totalPages"></span>`,
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
    // Destructure new config properties (with defaults for safety)
    const { 
        columns, 
        showHead = true, 
        striped = false, 
        density = "normal",
        // Allow passing explicit style overrides from the Template Config
        fontSize = "12px",
        rowPadding = null, // If null, calculate from density
        borderColor = "#ddd"
    } = tableStructure;
    
    // 1. Calculate Padding (Vertical Spacing)
    let paddingVal = "10px"; // Default
    if (rowPadding) {
        paddingVal = rowPadding; // Use exact value if provided (e.g. "2mm")
    } else {
        // Fallback to density presets
        if (density === "compact") paddingVal = "5px";
        if (density === "spacious") paddingVal = "15px";
    }

    // 2. Build Header
    let thead = "";
    if (showHead) {
        let ths = "";
        columns.forEach(col => {
            if (col.visible) {
                ths += `<th style="text-align: ${col.align}; width: ${col.width}; padding: ${paddingVal} 5px; border-bottom: 2px solid ${borderColor}; vertical-align: bottom; font-weight: bold;">${col.label}</th>`;
            }
        });
        thead = `<thead style="color: ${accentColor}; display: table-header-group;">
                    <tr style="page-break-inside: avoid;">${ths}</tr>
                 </thead>`;
    }

    // 3. Build Body
    let tbodyRows = "";
    rows.forEach((row, i) => {
        const bg = striped && i % 2 !== 0 ? "#f9f9f9" : "transparent";
        const style = row.status === "Cancelled" ? "text-decoration: line-through; color: #ff4d4f;" : "";

        let tds = "";
        columns.forEach(col => {
            if (col.visible) {
                const val = row[col.dataKey] || "-";
                tds += `<td style="text-align: ${col.align}; padding: ${paddingVal} 5px; border-bottom: 1px solid ${borderColor}; vertical-align: top; ${style}">${val}</td>`;
            }
        });
        tbodyRows += `<tr style="background-color: ${bg}; page-break-inside: avoid;">${tds}</tr>`;
    });

    // 4. Return Table 
    // UPDATED: margin: 0 0 10px 0 (Top 0, Right 0, Bottom 10px, Left 0)
    return `<table style="width: 100%; border-collapse: collapse; font-size: ${fontSize}; margin: 0 0 10px 0; padding: 0;">
        ${thead}
        <tbody>${tbodyRows}</tbody>
    </table>`;
};


module.exports = { generateInvoicePayload, buildDynamicTableHtml };