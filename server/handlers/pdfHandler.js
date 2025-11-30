const puppeteer = require("puppeteer");
const handlebars = require("handlebars");
const moment = require("moment");
const fs = require("fs");

// Register Helpers
handlebars.registerHelper("formatDate", (date) => moment(date).format("DD MMM YYYY, h:mm A"));
handlebars.registerHelper("formatCurrency", (amount) => `₹${amount}`);
handlebars.registerHelper("eq", function (a, b) {
    return a === b;
});

let browser = null;

const getBrowser = async () => {
    if (!browser) {
        const possiblePaths = [
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
            "/usr/bin/google-chrome", 
            "/usr/bin/chromium-browser"
        ];

        const chromePath = possiblePaths.find(path => fs.existsSync(path));

        if (!chromePath) {
            console.warn("⚠️ Could not find local Chrome. Trying default Puppeteer bundle...");
        } else {
            console.log(`✅ Using Local Chrome at: ${chromePath}`);
        }

        browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: "new",
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

        // 2. Launch Browser
        const browserInstance = await getBrowser();
        const page = await browserInstance.newPage();

        // 3. Set Content
        await page.setContent(finalHtml, { waitUntil: "networkidle0" });

        // 4. Generate PDF (Returns Uint8Array in Puppeteer v24+)
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
        throw new Error("Failed to generate PDF");
    }
};

module.exports = { generatePdf };