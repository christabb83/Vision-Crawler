import dotenv from 'dotenv';
dotenv.config();

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

puppeteer.use(StealthPlugin());

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const timeout = 8000;

// Globs for identifying team pages
const globs = [
    "/about*", "/about-us*", "/aboutus*", "/who-we-are*", "/about-the-team*", "/our-story*",
    "/team*", "/our-team*", "/meet-the-team*", "/leadership*", "/management*", "/executives*",
    "/staff*", "/board*", "/partners*", "/contact*", "/contact-us*", "/get-in-touch*",
    "/reach-us*", "/contact-information*", "/connect*", "/people*", "/our-people*",
    "/staff-directory*", "/directory*", "/personnel*", "/company*", "/company-info*",
    "/corporate*", "/mission*", "/values*"
];

async function image_to_base64(image_file) {
    return new Promise((resolve, reject) => {
        fs.readFile(image_file, (err, data) => {
            if (err) {
                console.error('Error reading the file:', err);
                reject(err);
            } else {
                const base64Data = data.toString('base64');
                resolve(base64Data);
            }
        });
    });
}

async function find_team_page(page) {
    const links = await page.$$eval('a', anchors => anchors.map(a => a.href));

    const potentialTeamPages = [];

    for (let link of links) {
        for (let glob of globs) {
            if (link.includes(glob.replace('*', ''))) {
                potentialTeamPages.push(link);
            }
        }
    }

    if (potentialTeamPages.length > 0) {
        // Prefer links that contain '/team' in them as a fallback
        const teamLink = potentialTeamPages.find(link => link.includes('/team'));
        if (teamLink) return teamLink;

        // If no '/team' link found, return the first match
        return potentialTeamPages[0];
    }

    return null;
}

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1200, deviceScaleFactor: 1.75 });

    const url = process.argv[2];  // Get URL from command line argument
    if (!url) {
        console.error("No URL provided.");
        process.exit(1);
    }

    console.log("Crawling " + url);
    await page.goto(url, { waitUntil: "load" });  // Wait for the entire page to load

    const teamPageUrl = await find_team_page(page);
    if (teamPageUrl) {
        console.log("Found team page at " + teamPageUrl);
        await page.goto(teamPageUrl, { waitUntil: "load" });

        // Take a screenshot of the full page for analysis
        const screenshotPath = path.join(__dirname, 'screenshot.jpg');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        await new Promise(resolve => setTimeout(resolve, 1000)); // Ensure file is fully written

        const base64_image = await image_to_base64(screenshotPath);

        // Build payload similar to Python example
        const payload = {
            model: "gpt-4o",  // Use the appropriate model
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Extract the names, titles, emails, and LinkedIn profiles of the team members from this image."
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64_image}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 1500
        };

        // Make the API call
        const response = await openai.chat.completions.create(payload);

        const extractedData = response.choices[0].message.content;

        console.log("Extracted Data:");
        console.log(extractedData);
    } else {
        console.log("No team page found.");
    }

    await browser.close();
})();