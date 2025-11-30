const puppeteer = require("puppeteer");
const handlebars = require("handlebars");
const moment = require("moment");

// Register Helpers for Handlebars (Data formatting)
handlebars.registerHelper("formatDate", (date) => moment(date).format("DD MMM YYYY, h:mm A"));
handlebars.registerHelper("formatCurrency", (amount) => `₹${amount}`);

let browser = null;

const getBrowser = async () => {
    if (!browser) {
        browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    }
    return browser;
};

const generatePdf = async (templateHtml, data, layoutConfig = {}) => {
    try {
        // 1. Compile HTML with Data
        const template = handlebars.compile(templateHtml);
        const finalHtml = template(data);

        // 2. Launch Browser Page
        const browserInstance = await getBrowser();
        const page = await browserInstance.newPage();

        // 3. Set Content
        await page.setContent(finalHtml, { waitUntil: "networkidle0" });

        // 4. Generate PDF
        const pdfBuffer = await page.pdf({
            format: layoutConfig.pageSize || "A4",
            landscape: layoutConfig.orientation === "landscape",
            printBackground: true, // Ensures background colors (headers) print
            margin: {
                top: (layoutConfig.margins?.top || 10) + "mm",
                bottom: (layoutConfig.margins?.bottom || 10) + "mm",
                left: (layoutConfig.margins?.left || 10) + "mm",
                right: (layoutConfig.margins?.right || 10) + "mm",
            }
        });

        await page.close();
        return pdfBuffer;

    } catch (err) {
        console.error("PDF Gen Error:", err);
        throw new Error("Failed to generate PDF");
    }
};

module.exports = { generatePdf };