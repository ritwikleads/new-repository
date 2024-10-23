// index.js

const express = require('express');
const cors = require('cors');
const app = express();
const fs = require('fs');
const https = require('https');
const http = require('http');
const puppeteer = require('puppeteer');

// SSL/TLS options
const options = {
  key: fs.readFileSync('C:\\ssl\\rtsmedia.in-key.pem'),
  cert: fs.readFileSync('C:\\ssl\\rtsmedia.in-crt.pem'),
  ca: fs.readFileSync('C:\\ssl\\rtsmedia.in-chain.pem')
};

// HTTPS port
const port = 443;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));

app.post('/process-address', async (req, res) => {
  const { firstName, lastName, email, phone, address } = req.body;

  if (!address) {
    return res.status(400).json({ error: 'Address is required' });
  }

  let browser;
  try {
    // Launch browser in headless mode without slowMo
    browser = await puppeteer.launch({
      headless: true,
      defaultViewport: { width: 1920, height: 1080 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate to Google Sunroof webpage
    await page.goto('https://sunroof.withgoogle.com/', { waitUntil: 'domcontentloaded' });

    // Wait for the input field
    const addressInputSelector = 'input[type="text"]';
    await page.waitForSelector(addressInputSelector);

    // Focus on the input field
    await page.focus(addressInputSelector);

    // Clear any existing text (optional)
    await page.click(addressInputSelector, { clickCount: 3 });
    await page.keyboard.press('Backspace');

    // Type the address quickly with no delay
    await page.type(addressInputSelector, address, { delay: 0 });

    // Press Enter on the keyboard
    await page.keyboard.press('Enter');

    // Wait for the results to load
    try {
      const resultSelector = 'div.address-map-panel';
      await page.waitForSelector(resultSelector, { timeout: 10000 });
    } catch (err) {
      console.error('Error during navigation:', err.message);
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
    const text1 = await extractText('li:nth-child(1) > div.panel-fact-text.md-body');
    const text2 = await extractText('li:nth-child(1) > div.panel-fact-caption.md-caption');
    const text3 = await extractText('li:nth-child(2) > div.panel-fact-text.md-body');
    const text4 = await extractText('li:nth-child(2) > div.panel-fact-caption.md-caption');
    const text5 = await extractText('md-card:nth-child(3) > div.panel-estimate > div.panel-estimate-savings.pt-display-1');
    const text6 = await extractText('md-card:nth-child(3) > div.panel-estimate > div.panel-estimate-caption.md-caption');

    // Click the button to expand the Google Maps window
    const expandMapButtonSelector = 'button[aria-label="Expand map"]';
    await page.waitForSelector(expandMapButtonSelector, { timeout: 5000 });
    const expandMapButton = await page.$(expandMapButtonSelector);

    if (expandMapButton) {
      await expandMapButton.click();
      // Wait for the map to be fully expanded
      await page.waitForSelector('div.gm-style-fullscreen-control-active', { timeout: 5000 });
    } else {
      throw new Error("Expand Google Maps button not found");
    }

    // Get the dimensions of the map area
    const mapDimensions = await page.evaluate(() => {
      const mapElement = document.querySelector('div.gm-style');
      if (!mapElement) return null;
      const rect = mapElement.getBoundingClientRect();
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      };
    });

    let screenshotBase64_1 = null;
    let screenshotBase64_2 = null;

    if (mapDimensions) {
      // Adjust the edges to crop out unwanted areas
      const cropLeft = 160;
      const cropRight = 50;
      const cropTop = 0;
      const cropBottom = 25;

      // First Screenshot
      screenshotBase64_1 = await page.screenshot({
        encoding: 'base64',
        clip: {
          x: mapDimensions.x + cropLeft,
          y: mapDimensions.y + cropTop,
          width: mapDimensions.width - (cropLeft + cropRight),
          height: mapDimensions.height - (cropTop + cropBottom)
        }
      });

      // Reduced delay before taking the second screenshot
      await page.waitForTimeout(500);

      // Second Screenshot
      screenshotBase64_2 = await page.screenshot({
        encoding: 'base64',
        clip: {
          x: mapDimensions.x + cropLeft,
          y: mapDimensions.y + cropTop,
          width: mapDimensions.width - (cropLeft + cropRight),
          height: mapDimensions.height - (cropTop + cropBottom)
        }
      });
    } else {
      throw new Error("Map area not found");
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
        text6
      },
      screenshot: screenshotBase64_2
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

// Redirect HTTP to HTTPS
http.createServer((req, res) => {
  res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
  res.end();
}).listen(80, '0.0.0.0', () => {
  console.log('HTTP Server is redirecting to HTTPS');
});
