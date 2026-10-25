// The current site has fewer than 15 updates. Exercise pagination with test-only copies.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch(
    process.env.TEST_CHANNEL ? { channel: process.env.TEST_CHANNEL } : {},
  );
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const source = fs.readFileSync("novidades.html", "utf8");
      // Serve the real markup without execution; add fixture cards before running the real filter code.
      await page.setContent(
        source
          .replace(/<script\b[\s\S]*?<\/script>/g, "")
          .replace(/<link\b[^>]*>/g, ""),
      );
      await page.evaluate(() => {
        const grid = document.querySelector(".news-updates .news-grid");
        const sample = grid.firstElementChild.cloneNode(true);
        grid.replaceChildren();
        for (let i = 0; i < 31; i++) {
          const card = sample.cloneNode(true);
          card.querySelector("time").dateTime =
            `2026-10-${String(i + 1).padStart(2, "0")}`;
          card.querySelector("h3").textContent = "Fixture " + i;
          grid.append(card);
        }
      });
      await page.addScriptTag({ path: "assets/js/news-filters.js" });
      const visible = page.locator(".news-updates article:not([hidden])");
      assert.equal(await visible.count(), 15);
      await page.getByRole("button", { name: "Página 2", exact: true }).click();
      assert.equal(await visible.count(), 15);
      await page.getByRole("button", { name: "Página 3", exact: true }).click();
      assert.equal(await visible.count(), 1);
      assert(
        await page
          .getByRole("button", { name: "Próxima →", exact: true })
          .isDisabled(),
      );
      await page.getByRole("button", { name: "Página 3", exact: true }).click();
      assert.equal(await visible.count(), 1);
      await page.locator("#news-order").selectOption("oldest");
      assert.equal(await visible.count(), 15);
      assert.equal(
        await visible.first().locator("h3").textContent(),
        "Fixture 0",
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Página 1", exact: true })
          .getAttribute("aria-current"),
        "page",
      );
      assert(
        await page
          .getByRole("button", { name: "← Anterior", exact: true })
          .isDisabled(),
      );
      await page.close();
    }
    console.log(
      "Pagination fixture: 31 updates, three pages, boundaries, repeated clicks and order reset passed at 390/1440px.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
