const puppeteer = require("puppeteer");
const handlebars = require("handlebars");
const moment = require("moment");

// Register Helpers
handlebars.registerHelper("formatDate", (date) => moment(date).format("DD MMM YYYY, h:mm A"));
handlebars.registerHelper("formatCurrency", (amount) => `₹${Number(amount).toFixed(2)}`);
handlebars.registerHelper("eq", function (a, b) { return a === b; });

let browser = null;

const getBrowser = async () => {
    if (!browser || !browser.isConnected()) {
        console.log("🚀 Launching new Puppeteer browser instance...");
        browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"] 
        });
    }
    return browser;
};

// --- HELPER: Measure HTML Height ---
const measureHeight = async (page, htmlContent, widthMm) => {
    const content = `
    <html>
        <body style="width: ${widthMm}mm; padding: 0; margin: 0; overflow: hidden; font-family: sans-serif;">
            <div id="wrapper" style="display: inline-block; width: 100%;">
                ${htmlContent}
            </div>
        </body>
    </html>`;

    await page.setContent(content, { waitUntil: 'domcontentloaded' });

    const heightPx = await page.evaluate(() => {
        const wrapper = document.getElementById('wrapper');
        return wrapper ? wrapper.offsetHeight : 0;
    });

    // Convert Pixels to Millimeters (approx 0.264583) + 2mm buffer
    return Math.ceil(heightPx * 0.264583); 
};

// --- HELPER: Page Size Lookup ---
const getPageDimensions = (format, orientation) => {
    const standards = {
        'A4': { width: 210, height: 297 },
        'A5': { width: 148, height: 210 },
        'Letter': { width: 215.9, height: 279.4 },
        'Legal': { width: 215.9, height: 355.6 },
        'Thermal80mm': { width: 80, height: 297 } // Approximate height
    };
    const dim = standards[format] || standards['A4'];
    return orientation === 'landscape' 
        ? { width: dim.height, height: dim.width } 
        : { width: dim.width, height: dim.height };
};

const generatePdf = async (bodyHtml, data, options = {}) => {
    try {
        const browser = await getBrowser();
        const page = await browser.newPage();

        // 1. Calculate Content Width
        const dims = getPageDimensions(options.pageSize, options.orientation);
        
        // Use user margins (default to 0 if not set, handled by fallback)
        const userTopMargin = options.margins?.top || 0;
        const userBottomMargin = options.margins?.bottom || 0;
        const leftMargin = options.margins?.left || 0;
        const rightMargin = options.margins?.right || 0;

        const contentWidth = dims.width - leftMargin - rightMargin;

        // Start with 0. We will calculate the TOTAL space required for Puppeteer's margin.
        let finalTopMargin = 0;
        let finalBottomMargin = 0;

        // 2. Measure Header Height
        if (options.headerHtml) {
            const wrappedHeader = `
                <div style="font-size: 12px; line-height: 1.2; width: ${contentWidth}mm;">
                    ${options.headerStyles || ''}
                    ${options.headerHtml}
                </div>`;
            
            const headerHeight = await measureHeight(page, wrappedHeader, contentWidth);
            
            // LOGIC FIX: The total space Puppeteer needs = (User's Blank Space) + (Header Content Height)
            finalTopMargin = userTopMargin + headerHeight;
        } else {
            finalTopMargin = userTopMargin;
        }

        // 3. Measure Footer Height
        if (options.footerHtml) {
            const wrappedFooter = `
                <div style="font-size: 12px; line-height: 1.2; width: ${contentWidth}mm;">
                    ${options.headerStyles || ''}
                    ${options.footerHtml}
                </div>`;
            
            const footerHeight = await measureHeight(page, wrappedFooter, contentWidth);
            // LOGIC FIX: Total space = (User's Blank Space) + (Footer Content Height)
            finalBottomMargin = userBottomMargin + footerHeight;
        } else {
            finalBottomMargin = userBottomMargin;
        }

        // Safety check
        if (finalTopMargin + finalBottomMargin > dims.height * 0.8) {
            console.warn("Margins too large, resetting to defaults.");
            finalTopMargin = 20; finalBottomMargin = 20;
        }
        //adjust finalTopMargin by 10%
        finalTopMargin = finalTopMargin + (finalTopMargin * 0.1)

        //adjust finalBottomMargin by 10%
        finalBottomMargin = finalBottomMargin + (finalBottomMargin * 0.1)
        // 4. Render Final PDF
        await page.setContent(bodyHtml, { waitUntil: "networkidle0" });
        const pdfUint8Array = await page.pdf({
            format: options.pageSize || "A4",
            landscape: options.orientation === "landscape",
            printBackground: true,
            margin: {
                top: `${finalTopMargin}mm`,
                bottom: `${finalBottomMargin}mm`,
                left: `${leftMargin}mm`,
                right: `${rightMargin}mm`,
            },
            displayHeaderFooter: true,
            
            // HEADER TEMPLATE
            // We apply 'padding-top' equal to the User's Top Margin.
            // This pushes the text down, leaving the top edge blank as expected.
            headerTemplate: `
                <div style="width: 100%; margin-left: ${leftMargin}mm; margin-right: ${rightMargin}mm; padding-top: ${userTopMargin}mm; font-size: 10px;">
                    ${options.headerStyles || ''}
                    ${options.headerHtml || ''}
                </div>`,
            
            // FOOTER TEMPLATE
            // We apply 'padding-bottom' (or margin-top depending on flow) to position it correctly.
            // Usually, footerTemplate aligns to the bottom of the margin box automatically.
            footerTemplate: `
                <div style="width: 100%; margin-left: ${leftMargin}mm; margin-right: ${rightMargin}mm; padding-bottom: ${userBottomMargin}mm; font-size: 10px;">
                    ${options.headerStyles || ''}
                    ${options.footerHtml || ''}
                </div>`
        });

        await page.close();
        return Buffer.from(pdfUint8Array);

    } catch (err) {
        console.error("PDF Gen Error:", err);
        if (browser) { try { await browser.close(); } catch (e) {} browser = null; }
        throw new Error("Failed to generate PDF");
    }
};

module.exports = { generatePdf };