// index.js

const express = require('express');
const cors = require('cors'); // Import CORS
const app = express();
const port = 80; // You can change this to any port you prefer  
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

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
            headless: false,
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

        // Click the button to expand the Google Maps window
        const expandMapButtonSelector = 'body > div.view-wrap > address-view > div.main-content-wrapper > div > div > section.section.section-map > sun-map > div > div > div.gm-style > div:nth-child(8) > button';
        await page.waitForSelector(expandMapButtonSelector); // Wait for the expand button to appear
        const expandMapButton = await page.$(expandMapButtonSelector);

        if (expandMapButton) {
            await expandMapButton.click(); // Click the button to expand Google Maps

            try {
                await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5-second delay to allow expansion
            } catch (err) {
                console.error('Error during wait:', err.message);
            }
        } else {
            throw new Error("Expand Google Maps button not found");
        }

        // **MODIFIED CODE STARTS HERE**
        // Take a simple screenshot of the entire page after expanding the map
        const screenshotBase64 = await page.screenshot({
            encoding: 'base64', // Set encoding to 'base64' to get a Base64 string
            fullPage: true      // Capture the full scrollable page
        });

        // **DEBUGGING:** Log the length of the Base64 string to verify it's being generated
        console.log(`Screenshot Base64 Length: ${screenshotBase64.length}`);
        // **MODIFIED CODE ENDS HERE**

        // **OPTIONAL:** If you still want to save the screenshot to a file, you can do so separately
        /*
        // Ensure the screenshots directory exists
        const screenshotsDir = path.join(__dirname, 'screenshots');
        if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir);
        }

        // Generate a unique filename
        const timestamp = Date.now();
        const screenshotPath = path.join(screenshotsDir, `sunroof_${timestamp}.png`);

        // Save the screenshot to a file
        await page.screenshot({
            path: screenshotPath, // Save the screenshot to a file
            fullPage: true        // Capture the full scrollable page
        });
        */

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

    } catch (error) {
        console.error('Error during processing:', error.message);
        if (browser) {
            await browser.close();
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start the server
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});
