/**
 * Inspect CasaRetail Public Invoice Reference
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const URL = "https://dashboard.casaretail.in/invoice?billToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJnZW5lcmF0ZWRCaWxsSWQiOiJDTV8wMDA2ODRfMjZfMTc4Nzk2MTYwMDAwMF8xMDdfQ0JNTF8wODUiLCJjdXN0b21lck1vYmlsZU5vIjoiODQ4NDgwMzU4MCIsImludm9pY2VUeXBlIjoiSU4iLCJ0ZW5hbnQiOiJtdWZ0aSIsImJ1c2luZXNzVW5pdElkIjoxMDcsIm9yaWdpbmFsSW52b2ljZVR5cGUiOiJJTiIsImlhdCI6MTc4ODI0MDYxNH0.xTX1iYIiSKoNwxtaclfwYhEiqO92tZwZjiTHV7Eo10Q&utm_source=CASA&utm_medium=whatsapp&utm_content=DR+-+Zone+wise+-+NORTH%7CWEST+-+Jun+5%2C+2026+-+JB&utm_campaignid=7b72326d-1265-440b-a575-e6f8a9b632b4";

async function inspectReference() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const page = await context.newPage();

  console.log("Navigating to CasaRetail reference...");
  await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  const screenshotPath = path.resolve("qa/audit-screenshots/casaretail_reference_mobile.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Saved screenshot to ${screenshotPath}`);

  // Also desktop view
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(1000);
  const desktopScreenshot = path.resolve("qa/audit-screenshots/casaretail_reference_desktop.png");
  await page.screenshot({ path: desktopScreenshot, fullPage: true });

  const bodyText = await page.evaluate(() => document.body.innerText);
  const html = await page.content();

  fs.writeFileSync("qa/audit-screenshots/casaretail_reference_text.txt", bodyText, "utf8");
  fs.writeFileSync("qa/audit-screenshots/casaretail_reference_dom.html", html, "utf8");

  console.log("Extracted reference text length:", bodyText.length);
  console.log("\n--- TEXT PREVIEW ---\n", bodyText.slice(0, 1000));

  await browser.close();
}

inspectReference().catch(console.error);
