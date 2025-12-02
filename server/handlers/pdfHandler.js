const puppeteer = require("puppeteer");
const handlebars = require("handlebars");
const moment = require("moment");

// Register Helpers
handlebars.registerHelper("formatDate", (date) => moment(date).format("DD MMM YYYY, h:mm A"));
handlebars.registerHelper("formatCurrency", (amount) => `₹${amount}`);
handlebars.registerHelper("eq", function (a, b) {
    return a === b;
});

let browser = null;

const getBrowser = async () => {
    // Check if browser instance exists and is actually connected.
    // If it crashed or closed, we need to launch a new one.
    if (!browser || !browser.isConnected()) {
        console.log("🚀 Launching new Puppeteer browser instance...");

        browser = await puppeteer.launch({
            // 'headless: "new"' is the modern standard for Puppeteer
            headless: "new",
            // Standard args for running in containerized/server environments
            args: ["--no-sandbox", "--disable-setuid-sandbox"] 
        });
    }
    return browser;
};

const generatePdf = async (templateHtml, data, layoutConfig = {}) => {
    try {
        // 1. Compile HTML
        const template = handlebars.compile(templateHtml);
        const finalHtml = template(data);

        // 2. Get Browser Instance
        const browserInstance = await getBrowser();
        const page = await browserInstance.newPage();

        // 3. Set Content
        await page.setContent(finalHtml, { waitUntil: "networkidle0" });

        // 4. Generate PDF (Returns Uint8Array in Puppeteer v22+)
        const pdfUint8Array = await page.pdf({
            format: layoutConfig.pageSize || "A4",
            landscape: layoutConfig.orientation === "landscape",
            printBackground: true, 
            margin: {
                top: (layoutConfig.margins?.top || 10) + "mm",
                bottom: (layoutConfig.margins?.bottom || 10) + "mm",
                left: (layoutConfig.margins?.left || 10) + "mm",
                right: (layoutConfig.margins?.right || 10) + "mm",
            }
        });

        await page.close();

        // --- CRITICAL FIX: Convert Uint8Array to Node Buffer ---
        return Buffer.from(pdfUint8Array);

    } catch (err) {
        console.error("PDF Gen Error:", err);
        // If the browser crashed, nullify it so it restarts next time
        if (browser) {
            try { await browser.close(); } catch (e) {}
            browser = null;
        }
        throw new Error("Failed to generate PDF");
    }
};

module.exports = { generatePdf };