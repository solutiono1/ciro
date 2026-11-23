import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function overflows(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}

test("the public pages hold together at both sizes", async () => {
  const vite = await createServer({
    root: webRoot,
    configFile: path.join(webRoot, "vite.config.js"),
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0, fs: { allow: [path.resolve(webRoot, "..")] } },
  });
  await vite.listen();
  const bound = vite.httpServer.address();
  const origin = `http://127.0.0.1:${bound.port}`;
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(20_000);
  try {
    await page.goto(`${origin}/#/`);
    await page.getByRole("heading", { name: "An invoice that will not pay the wrong name." }).waitFor();
    await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
    assert.equal(await page.locator(".step-icon").count(), 3);
    assert.equal(await overflows(page), false);

    const faq = page.locator(".faq-item").nth(1);
    await faq.locator("summary").click();
    assert.equal(await faq.getAttribute("open"), "");

    // The why-section photos cycle with one progress dot per image.
    assert.equal(await page.locator(".slide-dot").count(), 5);

    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await overflows(page), false);
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "Docs" }).click();
    await page.getByRole("heading", { name: "Build on Ciro" }).waitFor();
    assert.equal(await page.getByRole("button", { name: /Add Aevum to wallet/ }).count(), 1);
    assert.equal(await page.getByRole("button", { name: /Get 1,000 tUSD8/ }).count(), 1);
    assert.equal(await overflows(page), false);

    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await overflows(page), false);
  } finally {
    await browser.close();
    await vite.close();
  }
});
