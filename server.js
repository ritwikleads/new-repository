// index.js

const express = require('express');
const cors = require('cors'); // Import CORS
const app = express();
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// **Add HTTPS and HTTP modules**
const https = require('https'); // Import HTTPS module
const http = require('http');   // Import HTTP module for redirection or local server

// **SSL/TLS options**
let sslOptions = null;

try {
    sslOptions = {
        key: fs.readFileSync('C:\\ssl\\rtsmedia.in-key.pem'),
        cert: fs.readFileSync('C:\\ssl\\rtsmedia.in-crt.pem'),
        ca: fs.readFileSync('C:\\ssl\\rtsmedia.in-chain.pem') // Include the chain if required
    };
} catch (err) {
    console.warn('SSL files not found, starting HTTP server instead of HTTPS');
}

// **Set the ports**
const httpsPort = 443; // HTTPS default port
const httpPort = 80; // HTTP default port

// Middleware to parse JSON bodies and enable CORS
app.use(cors()); // Enable CORS for all requests
app.use(express.json({ limit: '100mb' })); // Increase limit if needed

app.post('/process-address', async (req, res) => {
    const { firstName, lastName, email, phone, address } = req.body;

    if (!address) {
        return res.status(400).json({ error: 'Address is required' });
    }

    let browser;
    try {
        // Launch browser in headless mode
        browser = await puppeteer.launch({
            headless: true,
            slowMo: 50,
            defaultViewport: {
                width: 1920,
                height: 1080,
            },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // Navigate to Google Sunroof webpage
        await page.goto('https://sunroof.withgoogle.com/');

        // Wait for the input field and type the address
        const addressInputSelector = 'input[type="text"]';
        await page.waitForSelector(addressInputSelector);
        await page.type(addressInputSelector, address);

        // Wait for the "Check Roof" button and click it twice
        const checkRoofButtonSelector = 'button.btn.btn-fill-orange';
        await page.waitForSelector(checkRoofButtonSelector);
        const checkRoofButton = await page.$(checkRoofButtonSelector);

        if (checkRoofButton) {
            await checkRoofButton.click();
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second
            await checkRoofButton.click(); // Second click

            try {
                await page.waitForNavigation({ waitUntil: 'networkidle2' });
            } catch (err) {
                console.error('Error during navigation:', err.message);
            }
        } else {
            throw new Error("Check my roof button not found");
        }

        // Function to extract text content based on the provided selector
        const extractText = async (selector) => {
            try {
                await page.waitForSelector(selector, { timeout: 5000 });
                return await page.$eval(selector, element => element.textContent.trim());
            } catch (err) {
                console.error(`Error extracting text from ${selector}: ${err.message}`);
                return null;
            }
        };

        // Extract texts using appropriate selectors
        const text1 = await extractText('body > div.view-wrap > address-view > div.main-content-wrapper > div > div > section.section.section-map > div.address-map-panel > md-card:nth-child(2) > ul > li:nth-child(1) > div.panel-fact-text.md-body');
        const text2 = await extractText('body > div.view-wrap > address-view > div.main-content-wrapper > div > div > section.section.section-map > div.address-map-panel > md-card:nth-child(2) > ul > li:nth-child(1) > div.panel-fact-caption.md-caption');
        const text3 = await extractText('body > div.view-wrap > address-view > div.main-content-wrapper > div > div > section.section.section-map > div.address-map-panel > md-card:nth-child(2) > ul > li:nth-child(2) > div.panel-fact-text.md-body');
        const text4 = await extractText('body > div.view-wrap > address-view > div.main-content-wrapper > div > div > section.section.section-map > div.address-map-panel > md-card:nth-child(2) > ul > li:nth-child(2) > div.panel-fact-caption.md-caption');
        const text5 = await extractText('body > div.view-wrap > address-view > div.main-content-wrapper > div > div > section.section.section-map > div.address-map-panel > md-card:nth-child(3) > div.panel-estimate > div.panel-estimate-savings.pt-display-1');
        const text6 = await extractText('body > div.view-wrap > address-view > div.main-content-wrapper > div > div > section.section.section-map > div.address-map-panel > md-card:nth-child(3) > div.panel-estimate > div.panel-estimate-caption.md-caption');

        console.log("Text 1: ", text1);
        console.log("Text 2: ", text2);
        console.log("Text 3: ", text3);
        console.log("Text 4: ", text4);
        console.log("Text 5: ", text5);
        console.log("Text 6: ", text6);

        // Select the map element and take a screenshot
        const mapElementSelector = 'div.gm-style';

        // Wait for the map element to be present
        await page.waitForSelector(mapElementSelector);

        const mapElement = await page.$(mapElementSelector);

        if (mapElement) {
            const mapBoundingBox = await mapElement.boundingBox();

            let screenshotBase64 = null;

            if (mapBoundingBox) {
                // Adjust the edges to crop out unwanted areas if needed
                const cropLeft = 160;   // Adjust this value as needed
                const cropRight = 50;  // Adjust this value as needed
                const cropTop = 0;     // Adjust this value as needed
                const cropBottom = 25; // Adjust this value as needed

                // Capture the screenshot as a Base64-encoded string without saving to a file
                screenshotBase64 = await page.screenshot({
                    encoding: 'base64', // Set encoding to 'base64' to get a Base64 string
                    clip: {
                        x: mapBoundingBox.x + cropLeft,
                        y: mapBoundingBox.y + cropTop,
                        width: mapBoundingBox.width - (cropLeft + cropRight),
                        height: mapBoundingBox.height - (cropTop + cropBottom)
                    }
                });

                // Debugging: Log the length of the Base64 string
                console.log(`Screenshot Base64 Length: ${screenshotBase64.length}`);
            } else {
                throw new Error("Map element bounding box not found");
            }

            // Close the browser
            await browser.close();

            // Send the extracted data and screenshot back to the client
            res.json({
                success: true,
                data: {
                    text1,
                    text2,
                    text3,
                    text4,
                    text5,
                    text6
                },
                screenshot: screenshotBase64 // Ensure this is the Base64 string
            });

        } else {
            throw new Error("Map element not found");
        }

    } catch (error) {
        console.error('Error during processing:', error.message);
        if (browser) {
            await browser.close();
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// **Start server**
if (sslOptions) {
    https.createServer(sslOptions, app).listen(httpsPort, '0.0.0.0', () => {
        console.log(`HTTPS Server is running on port ${httpsPort}`);
    });

    // **Optional: Redirect HTTP to HTTPS**
    http.createServer((req, res) => {
        res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
        res.end();
    }).listen(httpPort, '0.0.0.0', () => {
        console.log('HTTP Server is redirecting to HTTPS');
    });
} else {
    // Start HTTP server for local testing
    const localPort = 3000; // Or any port you prefer
    app.listen(localPort, () => {
        console.log(`HTTP Server is running on port ${localPort}`);
    });
}
