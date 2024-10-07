const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    let browser;  // Declare the browser variable outside the try block so it can be accessed in the finally block.
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

        try {
            // Create a new page
            const page = await browser.newPage();
            
            // Set the viewport size explicitly
            await page.setViewport({ width: 1920, height: 1080 });

            // Navigate to Google Sunroof webpage
            await page.goto('https://sunroof.withgoogle.com/');

            // Wait for the input field and type the address
            const addressInputSelector = 'input[type="text"]';
            await page.waitForSelector(addressInputSelector);
            await page.type(addressInputSelector, '8442 Olympic Blvd, Pico Rivera, CA 90660, USA');
            
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

            // Extract text content based on the provided selectors
            const extractText = async (selector) => {
                try {
                    await page.waitForSelector(selector);
                    return await page.$eval(selector, element => element.textContent.trim());
                } catch (err) {
                    console.error(`Error extracting text from ${selector}: ${err.message}`);
                    return null;
                }
            };

            // Extract texts
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
                    await new Promise(resolve => setTimeout(resolve, 10000)); 
                } catch (err) {
                    console.error('Error during wait:', err.message);
                }
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

            if (mapDimensions) {
                // Adjust the edges to crop out unwanted areas
                const cropLeft = 160;   // Adjust this value as needed
                const cropRight = 50;  // Adjust this value as needed
                const cropTop = 0;     // Adjust this value as needed
                const cropBottom = 25; // Adjust this value as needed

                await page.screenshot({
                    path: 'sunroof.png',
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

        } catch (error) {
            console.error('Error during page interaction:', error.message);
        }
    } finally {
        // Check if the browser was successfully launched before closing
        if (browser) {
            await browser.close();
        }
    }
})();
