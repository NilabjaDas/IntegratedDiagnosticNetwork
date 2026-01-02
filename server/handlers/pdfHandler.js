const puppeteer = require("puppeteer");
const handlebars = require("handlebars");
const moment = require("moment");

// --- 1. HELPERS ---
handlebars.registerHelper("formatDate", (date) => moment(date).format("DD MMM YYYY, h:mm A"));
handlebars.registerHelper("formatCurrency", (amount) => `₹${Number(amount || 0).toFixed(2)}`);

let browser = null;

const getBrowser = async () => {
    if (!browser || !browser.isConnected()) {
        browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
        });
    }
    return browser;
};

// --- 2. MAIN GENERATION FUNCTION ---
const generatePdf = async (bodyHtml, data, options = {}) => {
    let page = null;
    try {
        const browser = await getBrowser();
        page = await browser.newPage();

        // A. COMPILE CONTENT
        const compile = (html) => {
            if (!html) return "";
            try { return handlebars.compile(html)(data); } catch (e) { return html; }
        };

        const headerHtml = compile(options.headerHtml);
        const footerHtml = compile(options.footerHtml);
        const cssStyles = options.headerStyles || ''; 
        
        const docTitle = data.order?.displayId 
            ? `Invoice_${data.order.displayId}` 
            : 'Document';
        // B. PREPARE THE RAW PAGE
        const initialHtml = `
            <!DOCTYPE html>
            <html>
            <head>
            <title>${docTitle}</title> <style>
                <style>
                    @page { size: ${options.pageSize || 'A4'} ${options.orientation || 'portrait'}; margin: 0; }
                    body { margin: 0; padding: 0; font-family: sans-serif; -webkit-print-color-adjust: exact; }
                    
                    /* Hidden Source Container */
                    #source-container { position: absolute; top: -10000px; width: 100%; visibility: hidden; }
                    
                    /* Page Sheet */
                    .sheet {
                        position: relative;
                        overflow: hidden;
                        page-break-after: always;
                        background: white;
                    }
                    
                    /* Helper class for dynamic page numbers */
                    .footer-content { width: 100%; height: 100%; position: relative; }
                </style>
                ${cssStyles}
            </head>
            <body>
                <div id="source-container">${bodyHtml}</div>
                <div id="header-template" style="display:none;">${headerHtml}</div>
                <div id="footer-template" style="display:none;">${footerHtml}</div>
                <div id="pages-output"></div>
            </body>
            </html>
        `;

        await page.setContent(initialHtml, { waitUntil: "networkidle0" });

        // C. EXECUTE PAGINATION INSIDE BROWSER
        await page.evaluate((options) => {
            const pageSize = options.pageSize || 'A4';
            const orientation = options.orientation || 'portrait';
            
            const mmToPx = (mm) => (mm * 96) / 25.4;
            
            const sizes = {
                'A4': { w: 210, h: 297 },
                'A5': { w: 148, h: 210 },
                'Letter': { w: 215.9, h: 279.4 },
                'Legal': { w: 215.9, h: 355.6 }
            };
            const standard = sizes[pageSize] || sizes['A4'];
            const widthMm = orientation === 'landscape' ? standard.h : standard.w;
            const heightMm = orientation === 'landscape' ? standard.w : standard.h;
            
            const pageWidthPx = mmToPx(widthMm);
            const pageHeightPx = mmToPx(heightMm);

            // Process Margins
            const margins = options.margins || {};
            const mt = mmToPx(margins.top || 0);
            const mr = mmToPx(margins.right || 0);
            const mb = mmToPx(margins.bottom || 0);
            const ml = mmToPx(margins.left || 0);

            const usableWidthPx = pageWidthPx - ml - mr;

            // 1. Measure Header/Footer
            const sourceContainer = document.getElementById('source-container');
            const outputContainer = document.getElementById('pages-output');
            const headerTpl = document.getElementById('header-template').innerHTML;
            const footerTpl = document.getElementById('footer-template').innerHTML;

            const measureDiv = document.createElement('div');
            measureDiv.style.width = `${usableWidthPx}px`;
            measureDiv.style.visibility = 'hidden';
            measureDiv.style.position = 'absolute';
            measureDiv.style.overflow = 'hidden'; 
            document.body.appendChild(measureDiv);

            measureDiv.innerHTML = headerTpl;
            const headerHeight = measureDiv.getBoundingClientRect().height;

            measureDiv.innerHTML = footerTpl;
            const footerHeight = measureDiv.getBoundingClientRect().height;
            
            document.body.removeChild(measureDiv);


            // 2. Calculate Content Area
            // INCREASED BUFFER: 15px to ensure no overlap
            const buffer = 15; 
            const contentTop = mt + headerHeight + buffer;
            const contentHeight = pageHeightPx - contentTop - mb - footerHeight - buffer;

            // 3. Extract Content
            const sourceTable = sourceContainer.querySelector('table');
            const rows = sourceTable ? Array.from(sourceTable.querySelectorAll('tbody tr')) : [];
            const summaryDiv = sourceTable ? sourceTable.nextElementSibling : null;

            if (!sourceTable) return; 

            // 4. Pagination Loop
            let currentRowIndex = 0;
            let pageIndex = 1;
            const totalRows = rows.length;
            const pages = []; // Store page elements to update page numbers later

            const createPage = () => {
                const sheet = document.createElement('div');
                sheet.className = 'sheet';
                sheet.style.width = `${pageWidthPx}px`;
                sheet.style.height = `${pageHeightPx}px`;

                // Header
                const header = document.createElement('div');
                header.style.position = 'absolute';
                header.style.top = `${mt}px`;
                header.style.left = `${ml}px`;
                header.style.width = `${usableWidthPx}px`;
                header.style.height = `${headerHeight}px`;
                header.innerHTML = headerTpl;
                sheet.appendChild(header);

                // Footer
                const footer = document.createElement('div');
                footer.className = 'footer-container'; // Tag for easier finding later
                footer.style.position = 'absolute';
                footer.style.bottom = `${mb}px`;
                footer.style.left = `${ml}px`;
                footer.style.width = `${usableWidthPx}px`;
                footer.style.height = `${footerHeight}px`;
                // Store raw template; we replace {{{page_info}}} later
                footer.innerHTML = footerTpl; 
                sheet.appendChild(footer);

                // Content Box
                const contentBox = document.createElement('div');
                contentBox.style.position = 'absolute';
                contentBox.style.top = `${contentTop}px`;
                contentBox.style.left = `${ml}px`;
                contentBox.style.width = `${usableWidthPx}px`;
                contentBox.style.height = `${contentHeight}px`;
                
                sheet.appendChild(contentBox);
                outputContainer.appendChild(sheet);
                
                pages.push(footer); // Save reference to footer
                return { sheet, contentBox };
            };

            const tableTemplate = sourceTable.cloneNode(true);
            tableTemplate.querySelector('tbody').innerHTML = ''; 

            let currentPage = createPage();
            let currentTable = tableTemplate.cloneNode(true);
            let currentTbody = currentTable.querySelector('tbody');
            currentPage.contentBox.appendChild(currentTable);

            let currentHeight = 0;

            // Fill Rows
            while (currentRowIndex < totalRows) {
                const row = rows[currentRowIndex];
                currentTbody.appendChild(row);
                const rowHeight = row.offsetHeight;
                
                if ((currentHeight + rowHeight) > contentHeight) {
                    currentTbody.removeChild(row);
                    pageIndex++;
                    currentPage = createPage();
                    currentTable = tableTemplate.cloneNode(true);
                    currentTbody = currentTable.querySelector('tbody');
                    currentPage.contentBox.appendChild(currentTable);
                    currentTbody.appendChild(row);
                    currentHeight = row.offsetHeight;
                } else {
                    currentHeight += rowHeight;
                }
                currentRowIndex++;
            }

            // Handle Summary
            if (summaryDiv) {
                const summaryClone = summaryDiv.cloneNode(true);
                currentPage.contentBox.appendChild(summaryClone);
                const summaryH = summaryClone.offsetHeight;

                if ((currentHeight + summaryH) > contentHeight) {
                    currentPage.contentBox.removeChild(summaryClone);
                    pageIndex++;
                    currentPage = createPage();
                    currentPage.contentBox.appendChild(summaryClone);
                }
            }

            // 5. UPDATE PAGE NUMBERS
            // Now that we know total 'pageIndex', we loop back and replace the placeholder
            const totalPages = pageIndex;
            pages.forEach((footerDiv, i) => {
                const currentPageNum = i + 1;
                const pageInfoText = `Page ${currentPageNum} of ${totalPages}`;
                
                // Replace the handlebars placeholder {{{page_info}}}
                // Use a regex to be safe if it's slightly different
                footerDiv.innerHTML = footerDiv.innerHTML.replace(/{{{\s*page_info\s*}}}/g, pageInfoText);
                
                // FALLBACK: If placeholder is missing, append it manually
                if (!footerDiv.innerHTML.includes(pageInfoText) && !footerTpl.includes('page_info')) {
                     const pageNumEl = document.createElement('div');
                     pageNumEl.style.cssText = "position: absolute; bottom: 0px; right: 0px; font-size: 10px;";
                     pageNumEl.innerText = pageInfoText;
                     footerDiv.appendChild(pageNumEl);
                }
            });

        }, options);

        
        const pdfUint8Array = await page.pdf({
            format: options.pageSize || 'A4',
            landscape: options.orientation === 'landscape',
            printBackground: true,
            displayHeaderFooter: false, 
            margin: { top: 0, bottom: 0, left: 0, right: 0 }
        });

        await page.close();
        return Buffer.from(pdfUint8Array);

    } catch (err) {
        console.error("❌ PDF ERROR:", err);
        if (page) await page.close().catch(() => {});
        throw err;
    }
};

module.exports = { generatePdf };