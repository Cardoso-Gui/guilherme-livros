const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const root = path.resolve(process.env.TEST_ROOT || ".");
const output = process.env.TEST_OUTPUT || "test-results/current";
const readers = ["noah", "labirinto-verde", "o-quinto-herdeiro"];
const support = [
  "biblioteca",
  "cadastro",
  "carrinho",
  "email-recuperacao",
  "entrar",
  "ler",
  "minha-conta",
  "recuperar-senha",
];
const pages = [
  "index",
  "descubra",
  "novidades",
  ...readers,
  ...readers.map((x) => x + "-capitulo-1"),
  ...support,
];
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};
const server = http.createServer((req, res) => {
  const file = path.resolve(
    root,
    "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
  );
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (error, data) => {
    res.writeHead(error ? 404 : 200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
    });
    res.end(error ? "Not found" : data);
  });
});
(async () => {
  fs.mkdirSync(output, { recursive: true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base =
    process.env.TEST_BASE_URL || `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch(
    process.env.TEST_CHANNEL ? { channel: process.env.TEST_CHANNEL } : {},
  );
  const errors = [],
    results = [],
    snapshots = {};
  try {
    for (const width of [390, 768, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => {
        if (response.url().startsWith(base) && response.status() >= 400)
          errors.push(response.url() + ": " + response.status());
      });
      const visit = async (name) => {
        await page.goto(`${base}/${name}.html`);
        await page.evaluate(() => document.fonts.ready);
      };
      const capture = async (name) => {
        // Stabilize lazy images and pointer-driven transitions before measuring.
        await page.mouse.move(0, 0);
        await page.evaluate(async () => {
          await Promise.all(
            [...document.images].map(async (image) => {
              image.loading = "eager";
              await image.decode();
            }),
          );
        });
        await page.waitForTimeout(350);
        snapshots[`${width}/${name}`] = await page.evaluate(() =>
          [
            ...document.querySelectorAll(
              "body,header,nav,main,article,section,footer,h1,h2,h3,p,a,button,input,select,dialog",
            ),
          ]
            .filter((el) => !el.closest("script,style"))
            .map((el) => {
              const r = el.getBoundingClientRect(),
                s = getComputedStyle(el);
              return {
                tag: el.tagName,
                id: el.id,
                class: el.className,
                text: el.textContent.trim(),
                href: el.getAttribute("href"),
                hidden: el.hidden,
                box: [r.x, r.y, r.width, r.height],
                style: Object.fromEntries(
                  [
                    "display",
                    "position",
                    "color",
                    "backgroundColor",
                    "fontFamily",
                    "fontSize",
                    "lineHeight",
                    "padding",
                    "margin",
                    "border",
                    "textAlign",
                    "visibility",
                  ].map((k) => [k, s[k]]),
                ),
              };
            }),
        );
        await page.screenshot({
          path: `${output}/${name}-${width}.png`,
          fullPage: true,
          animations: "disabled",
        });
      };
      for (const name of pages) {
        await visit(name);
        await capture(name);
        for (const link of await page.locator("header.main-header nav a").all())
          await link.click({ trial: true });
        assert(
          await page
            .locator("header.main-header")
            .evaluate((el) => el.getBoundingClientRect().height < 200),
        );
        if (support.includes(name))
          assert((await page.locator('a[href^="mailto:"]').count()) > 0);
      }
      await visit("descubra");
      const allCards = await page
        .locator(".book-card")
        .evaluateAll((nodes) => nodes.map((n) => ({ ...n.dataset })));
      const visibleTitles = () =>
        page
          .locator(".book-card:not([hidden])")
          .evaluateAll((nodes) => nodes.map((n) => n.dataset.title));
      for (const card of allCards) {
        await page.locator("[name=search]").fill(card.title);
        assert((await visibleTitles()).includes(card.title));
      }
      await page.locator("[name=search]").fill("zzzz-no-book");
      assert.equal((await visibleTitles()).length, 0);
      await page.locator("#catalog-empty button").click();
      assert.equal((await visibleTitles()).length, allCards.length);
      for (const field of ["theme", "saga", "year"]) {
        const value = allCards[0][field].split("|")[0];
        await page.locator(`[name=${field}]`).selectOption(value);
        assert.deepEqual(
          new Set(await visibleTitles()),
          new Set(
            allCards
              .filter((c) => c[field].split("|").includes(value))
              .map((c) => c.title),
          ),
        );
        await page.locator("#catalog-filters button").click();
      }
      for (const order of ["az", "za", "newest", "oldest", "featured"]) {
        await page.locator("[name=order]").selectOption(order);
        const expected = allCards.slice();
        if (order === "az" || order === "za")
          expected.sort(
            (a, b) =>
              a.title.localeCompare(b.title, "pt-BR") *
              (order === "az" ? 1 : -1),
          );
        if (order === "newest" || order === "oldest")
          expected.sort((a, b) =>
            !Number(a.year) || !Number(b.year)
              ? !Number(a.year) === !Number(b.year)
                ? 0
                : !Number(a.year)
                  ? 1
                  : -1
              : (Number(a.year) - Number(b.year)) *
                (order === "newest" ? -1 : 1),
          );
        assert.deepEqual(
          await visibleTitles(),
          expected.map((c) => c.title),
        );
      }
      // No synopsis triggers exist in the current catalog. Preserve that baseline.
      assert.equal(
        await page.locator(".book-card details,.synopsis-open").count(),
        0,
      );
      const covers = page.locator("[data-cover-zoom]");
      if (await covers.count()) {
        for (let repeat = 0; repeat < 2; repeat++) {
          await covers.first().click();
          assert(await page.locator(".cover-dialog").evaluate((el) => el.open));
          await page.keyboard.press("Escape");
          await page.waitForFunction(
            () => !document.querySelector(".cover-dialog").open,
          );
        }
      }
      await visit("novidades");
      const newsCount = await page
        .locator(".news-updates .news-grid article")
        .count();
      assert.equal(
        await page.locator(".news-updates .news-grid article:visible").count(),
        Math.min(15, newsCount),
      );
      if (newsCount > 15) {
        await page
          .getByRole("button", { name: "Página 2", exact: true })
          .click();
        assert.equal(
          await page
            .locator(".news-updates .news-grid article:visible")
            .count(),
          Math.min(15, newsCount - 15),
        );
        await page
          .getByRole("button", { name: "Página 1", exact: true })
          .click();
      }
      for (const topic of ["Literatura", "Atualizações", "Todos"]) {
        const button = page
          .locator(".news-topics")
          .getByRole("button", { name: topic, exact: true });
        await button.click();
        await button.click();
        assert.equal(await button.getAttribute("aria-pressed"), "true");
        if (topic === "Literatura")
          for (const sub of [
            "Lançamentos",
            "Próximas histórias",
            "Toda a literatura",
          ]) {
            await page
              .locator(".news-literature")
              .getByRole("button", { name: sub, exact: true })
              .click();
            if (sub !== "Toda a literatura")
              assert(
                (
                  await page
                    .locator(".news-updates article:visible .news-category")
                    .allTextContents()
                ).every((x) => x.trim() === sub),
              );
          }
      }
      for (const order of ["oldest", "newest"]) {
        await page.locator("#news-order").selectOption(order);
        const dates = await page
          .locator(".news-updates article:visible time")
          .evaluateAll((nodes) => nodes.map((n) => Date.parse(n.dateTime)));
        assert.deepEqual(
          dates,
          dates.slice().sort((a, b) => (a - b) * (order === "oldest" ? 1 : -1)),
        );
      }
      for (let repeat = 0; repeat < 2; repeat++) {
        const open = page.locator(".news-open:visible").first();
        await open.click();
        assert(await page.locator(".news-dialog").evaluate((el) => el.open));
        if (!repeat) await capture("news-modal");
        if (repeat) await page.keyboard.press("Escape");
        else await page.locator(".news-dialog-close").click();
        await page.waitForFunction(
          () => !document.querySelector(".news-dialog").open,
        );
        await page.waitForFunction(() => document.body.style.overflow === "");
      }
      for (const book of readers) {
        await visit(book + "-capitulo-1");
        assert.equal(await page.locator("#font-value").textContent(), "18 px");
        for (let i = 0; i < 3; i++) await page.locator("#font-larger").click();
        assert.equal(await page.locator("#font-value").textContent(), "24 px");
        assert(await page.locator("#font-larger").isDisabled());
        await page.locator("#reader-theme-toggle").click();
        await page.reload();
        assert.equal(await page.locator("#font-value").textContent(), "24 px");
        assert.equal(
          await page.locator("html").getAttribute("data-reader-theme"),
          "dark",
        );
        assert.equal(
          await page.evaluate(
            (key) => localStorage.getItem(key),
            "reader-font:" + book + "-preview-v2",
          ),
          "24",
        );
        await capture(book + "-dark");
        for (let i = 0; i < 4; i++) await page.locator("#font-smaller").click();
        assert.equal(await page.locator("#font-value").textContent(), "16 px");
        assert(await page.locator("#font-smaller").isDisabled());
        // Dispatch at reading position so Playwright does not scroll the toolbar into view.
        await page.evaluate(() => window.scrollTo(0, 1000));
        const anchor = await page
          .locator("#capitulo p")
          .evaluateAll((ps) =>
            ps.findIndex((p) => p.getBoundingClientRect().bottom > 140),
          );
        const before = await page
          .locator("#capitulo p")
          .nth(anchor)
          .evaluate((p) => p.getBoundingClientRect().top);
        await page.locator("#font-larger").dispatchEvent("click");
        const after = await page
          .locator("#capitulo p")
          .nth(anchor)
          .evaluate((p) => p.getBoundingClientRect().top);
        assert(Math.abs(after - before) <= 1, "reader scroll anchor changed");
      }
      await visit("descubra");
      for (const name of ["index", "novidades", "descubra"]) {
        await page
          .locator(`header.main-header nav a[href="./${name}.html"]`)
          .click();
        await page.waitForURL(`**/${name}.html`);
      }
      await page.goBack();
      assert(page.url().endsWith("/novidades.html"));
      await page.goForward();
      assert(page.url().endsWith("/descubra.html"));
      results.push({ width, pages: pages.length, status: "passed" });
      await context.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(`${output}/layout.json`, JSON.stringify(snapshots));
    fs.writeFileSync(
      `${output}/results.json`,
      JSON.stringify({ browser: browser.version(), results, errors }, null, 2),
    );
    console.log(JSON.stringify(results));
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
