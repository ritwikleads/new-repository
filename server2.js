// index.js

const express = require('express');
const cors = require('cors');
const app = express();
const fs = require('fs');
const puppeteer = require('puppeteer');
const https = require('https');
const http = require('http');

// SSL/TLS options
const options = {
  key: fs.readFileSync('C:\\ssl\\rtsmedia.in-key.pem'),
  cert: fs.readFileSync('C:\\ssl\\rtsmedia.in-crt.pem'),
  ca: fs.readFileSync('C:\\ssl\\rtsmedia.in-chain.pem') // Include the chain if required
};

// Set the HTTPS port
const port = 443; // HTTPS default port

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
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate to Google Sunroof webpage
    await page.goto('https://sunroof.withgoogle.com/', { waitUntil: 'networkidle2' });

    // Wait for the input field
    const addressInputSelector = 'input[type="text"]';
    await page.waitForSelector(addressInputSelector);

    // Type the first two characters of the address
    await page.type(addressInputSelector, address.substring(0, 2), { delay: 100 });

    // Paste the rest of the address
    // Since we cannot interact with the clipboard directly, we'll set the value directly using page.evaluate
    await page.evaluate((selector, address) => {
      const input = document.querySelector(selector);
      const currentValue = input.value;
      input.value = currentValue + address.substring(2);
    }, addressInputSelector, address);

    // Click the "Check Roof" button once
    const checkRoofButtonSelector = 'button.btn.btn-fill-orange';
    await page.waitForSelector(checkRoofButtonSelector);
    await page.click(checkRoofButtonSelector);

    // Wait for navigation to complete
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // Function to extract text content based on the provided selector
    const extractText = async (selector) => {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        return await page.$eval(selector, (element) => element.textContent.trim());
      } catch (err) {
        console.error(`Error extracting text from ${selector}: ${err.message}`);
        return null;
      }
    };

    // Extract texts using appropriate selectors
    const text1 = await extractText(
      'div.panel-fact-text.md-body:nth-of-type(1)'
    );
    const text2 = await extractText(
      'div.panel-fact-caption.md-caption:nth-of-type(1)'
    );
    const text3 = await extractText(
      'div.panel-fact-text.md-body:nth-of-type(2)'
    );
    const text4 = await extractText(
      'div.panel-fact-caption.md-caption:nth-of-type(2)'
    );
    const text5 = await extractText(
      'div.panel-estimate-savings.pt-display-1'
    );
    const text6 = await extractText(
      'div.panel-estimate-caption.md-caption'
    );

    console.log('Text 1: ', text1);
    console.log('Text 2: ', text2);
    console.log('Text 3: ', text3);
    console.log('Text 4: ', text4);
    console.log('Text 5: ', text5);
    console.log('Text 6: ', text6);

    // Click the button to expand the Google Maps window
    const expandMapButtonSelector = 'button[aria-label="Expand the map"]';
    await page.waitForSelector(expandMapButtonSelector);
    await page.click(expandMapButtonSelector);

    // Wait briefly to ensure the map has expanded
    await page.waitForTimeout(2000);

    // Get the dimensions of the map area
    const mapDimensions = await page.evaluate(() => {
      const mapElement = document.querySelector('div.gm-style');
      if (!mapElement) return null;
      const rect = mapElement.getBoundingClientRect();
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      };
    });

    let screenshotBase64_2 = null;

    if (mapDimensions) {
      // Adjust the edges to crop out unwanted areas
      const cropLeft = 160;
      const cropRight = 50;
      const cropTop = 0;
      const cropBottom = 25;

      // Wait for the required time before taking the screenshot
      await page.waitForTimeout(2000);

      // Second Screenshot
      screenshotBase64_2 = await page.screenshot({
        encoding: 'base64',
        clip: {
          x: mapDimensions.x + cropLeft,
          y: mapDimensions.y + cropTop,
          width: mapDimensions.width - (cropLeft + cropRight),
          height: mapDimensions.height - (cropTop + cropBottom),
        },
      });

      // Debugging: Log the length of the Base64 string
      console.log(`Second Screenshot Base64 Length: ${screenshotBase64_2.length}`);
    } else {
      throw new Error('Map area not found');
    }

    // Close the browser
    await browser.close();

    // Send the extracted data and only the second screenshot back to the client
    res.json({
      success: true,
      data: {
        text1,
        text2,
        text3,
        text4,
        text5,
        text6,
      },
      screenshot: screenshotBase64_2,
    });
  } catch (error) {
    console.error('Error during processing:', error.message);
    if (browser) {
      await browser.close();
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start HTTPS server
https.createServer(options, app).listen(port, '0.0.0.0', () => {
  console.log(`HTTPS Server is running on port ${port}`);
});

// Optional: Redirect HTTP to HTTPS
http
  .createServer((req, res) => {
    res.writeHead(301, { Location: 'https://' + req.headers['host'] + req.url });
    res.end();
  })
  .listen(80, '0.0.0.0', () => {
    console.log('HTTP Server is redirecting to HTTPS');
  });
