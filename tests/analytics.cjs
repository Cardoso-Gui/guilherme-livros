const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve("."),
  base = "http://books.test",
  api = "https://xheqlilvylkoxefepbmn.supabase.co";
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};
const files = fs
  .readdirSync(root)
  .filter(
    (f) =>
      f.endsWith(".html") &&
      fs.readFileSync(f, "utf8").includes("amazon-click.js"),
  );
async function setup(browser, width = 390) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
  });
  await context.route("**/*", (route) => route.abort());
  await context.route(base + "/**", async (route) => {
    const file = path.join(root, new URL(route.request().url()).pathname);
    if (file.endsWith("analytics-config.js"))
      return route.fulfill({
        contentType: "text/javascript",
        body: fs
          .readFileSync(file, "utf8")
          .replace(/collectAnonKey:\s*['"][^'"]*['"]/, "collectAnonKey: 'test-public-anon'"),
      });
    await route.fulfill({ path: file });
  });
  await context.route("https://www.amazon.com.br/**", (route) =>
    route.fulfill({ body: "Amazon navigation test", contentType: "text/html" }),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page, errors };
}
(async () => {
  fs.mkdirSync("test-results/analytics", { recursive: true });
  const browser = await chromium.launch(
    process.env.TEST_CHANNEL ? { channel: process.env.TEST_CHANNEL } : {},
  );
  const results = [];
  try {
    for (const width of [390, 1440]) {
      const { context, page, errors } = await setup(browser, width);
      let events = [],
        failure = false;
      await context.addInitScript(() => {
        window.__tracking = [];
        const original = window.fetch;
        window.fetch = (url, options) => {
          if (String(url).includes("/functions/v1/amazon-click"))
            window.__tracking.push({
              url,
              method: options.method,
              body: options.body,
              credentials: options.credentials,
              referrerPolicy: options.referrerPolicy,
              keepalive: options.keepalive,
              headers: options.headers,
            });
          return original(url, options);
        };
      });
      await context.route(api + "/**", async (route) => {
        if (route.request().method() === "OPTIONS")
          return route.fulfill({ status: 204, headers: cors });
        if (!route.request().url().endsWith("/functions/v1/amazon-click"))
          throw Error("Unexpected public API access");
        events.push(JSON.parse(route.request().postData()));
        if (failure) return route.abort();
        return route.fulfill({ status: 204, headers: cors });
      });
      let covered = 0;
      for (const file of files) {
        await page.goto(base + "/" + file);
        const links = page.locator('a[href^="https://www.amazon.com.br/dp/"]');
        for (let i = 0; i < (await links.count()); i++) {
          const link = links.nth(i);
          assert(await link.getAttribute("data-amazon-book"));
          assert.equal(await link.getAttribute("target"), "_blank");
          // Hidden full-news links are represented by their modal copies after initialization.
          if (!(await link.isVisible())) continue;
          const before = events.length;
          const popupPromise = page.waitForEvent("popup");
          await link.click();
          const popup = await popupPromise;
          await page.waitForFunction(
            (n) => window.__tracking.length > n,
            (await page.evaluate(() => window.__tracking.length)) - 1,
          );
          await popup.waitForLoadState();
          assert(popup.url().startsWith("https://www.amazon.com.br/dp/"));
          await popup.close();
          await page.waitForTimeout(50);
          assert.equal(events.length, before + 1);
          covered++;
        }
        if (file === "novidades.html") {
          for (const opener of await page.locator(".news-open").all()) {
            await opener.click();
            for (const newsLink of await page
              .locator('.news-dialog a[href^="https://www.amazon.com.br/dp/"]')
              .all()) {
              assert(await newsLink.getAttribute("data-amazon-book"));
              const before = events.length,
                popupPromise = context.waitForEvent("page");
              await newsLink.click();
              const popup = await popupPromise;
              await popup.waitForLoadState();
              assert(popup.url().startsWith("https://www.amazon.com.br/dp/"));
              await popup.close();
              await page.waitForTimeout(50);
              assert.equal(events.length, before + 1);
              covered++;
            }
            await page.locator(".news-dialog-close").click();
            await page.waitForFunction(
              () => !document.querySelector(".news-dialog").open,
            );
          }
        }
      }
      assert.equal(
        covered,
        17,
        "Every original Amazon link must be exercised, including full-news modals",
      );
      await page.goto(base + "/noah.html");
      const link = page.locator("a[data-amazon-book]").first();
      for (const action of ["keyboard", "middle", "failure", "repeat"]) {
        console.log("Tracking activation", width, action);
        const before = events.length;
        failure = action === "failure";
        const popupPromise = context.waitForEvent("page", { timeout: 10000 });
        if (action === "keyboard") {
          await link.focus();
          await page.keyboard.press("Enter");
        } else
          await link.click({ button: action === "middle" ? "middle" : "left" });
        const popup = await popupPromise;
        await popup.waitForLoadState();
        await popup.close();
        await page.waitForTimeout(100);
        assert.equal(
          events.length,
          before + 1,
          action + " should produce one request without blocking navigation",
        );
      }
      const captured = await page.evaluate(() => window.__tracking);
      for (const event of captured) {
        assert.deepEqual(Object.keys(JSON.parse(event.body)), ["book_slug"]);
        assert.equal(event.credentials, "omit");
        assert.equal(event.referrerPolicy, "no-referrer");
        assert.equal(event.keepalive, true);
      }
      assert.equal(await page.evaluate(() => localStorage.length), 0);
      assert.equal((await context.cookies([base, api])).length, 0);
      const before = events.length;
      await link.dispatchEvent("click", { button: 0 });
      await page.waitForTimeout(50);
      assert.equal(events.length, before, "synthetic clicks ignored");
      assert.deepEqual(errors, []);
      results.push({ width, publicLinksClicked: covered, tracking: "passed" });
      await context.close();
    }
    for (const width of [390, 1440]) {
      const { context, page, errors } = await setup(browser, width);
      let owner = true,
        mode = "data",
        queries = 0,
        logouts = 0;
      const day = (date) =>
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(date);
      const now = day(new Date()),
        previous = day(new Date(Date.now() - 86400000));
      const rows = [
        { book_slug: "noah", day: now, clicks: 4 },
        { book_slug: "labirinto-verde", day: now, clicks: 2 },
        { book_slug: "o-quinto-herdeiro", day: previous, clicks: 3 },
      ];
      const token =
        "eyJhbGciOiJIUzI1NiJ9." +
        Buffer.from(
          JSON.stringify({
            sub: "fixture-owner",
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        ).toString("base64url") +
        ".fixture";
      await context.route(api + "/**", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (req.method() === "OPTIONS")
          return route.fulfill({ status: 204, headers: cors });
        const json = (data, status = 200) =>
          route.fulfill({
            status,
            headers: cors,
            contentType: "application/json",
            body: JSON.stringify(data),
          });
        if (url.pathname === "/auth/v1/token")
          return json({
            access_token: token,
            refresh_token: "fixture-refresh",
            token_type: "bearer",
            expires_in: 3600,
            user: { id: "fixture-owner", email: "test@example.test" },
          });
        if (url.pathname === "/auth/v1/logout") {
          logouts++;
          assert.equal(url.searchParams.get("scope"), "local");
          return route.fulfill({ status: 204, headers: cors });
        }
        if (url.pathname === "/rest/v1/rpc/analytics_is_owner")
          return json(owner);
        if (url.pathname === "/rest/v1/amazon_click_daily") {
          queries++;
          assert(req.headers().authorization.startsWith("Bearer "));
          if (mode === "unauthorized") return json({ message: "denied" }, 403);
          if (mode === "error") return json({ message: "offline" }, 500);
          if (mode === "slow") {
            await new Promise((resolve) => setTimeout(resolve, 700));
          }
          return json(mode === "empty" ? [] : rows);
        }
        throw Error("Unexpected API request " + url.pathname);
      });
      const login = async () => {
        await page.locator("#email").fill("test@example.test");
        await page.locator("#password").fill("fixture-password");
        await page.locator("#login-submit").click();
      };
      await page.goto(base + "/painel.html");
      assert(await page.locator("#dashboard").isHidden());
      assert.equal(queries, 0);
      await page.screenshot({
        path: `test-results/analytics/login-${width}.png`,
        fullPage: true,
      });
      owner = false;
      await login();
      await page.waitForFunction(() =>
        document
          .querySelector("#status")
          .textContent.includes("não tem acesso"),
      );
      assert.equal(queries, 0);
      assert(await page.locator("#dashboard").isHidden());
      owner = true;
      await login();
      await page.waitForFunction(
        () => document.querySelector("#total-today").textContent === "6",
      );
      assert.equal(await page.locator("#total-week").textContent(), "9");
      assert.equal(await page.locator("#total-month").textContent(), "9");
      await page.locator("#period").selectOption("7");
      await page.locator("#range-form button").click();
      await page.waitForFunction(
        () => document.querySelector("#daily-rows").children.length === 7,
      );
      await page.locator("#period").selectOption("custom");
      await page.locator("#date-from").fill(previous);
      await page.locator("#date-to").fill(previous);
      await page.locator("#range-form button").click();
      await page.waitForFunction(() =>
        document
          .querySelector("#range-label")
          .textContent.endsWith("3 cliques"),
      );
      assert.equal(await page.locator("#total-today").textContent(), "6");
      await page.locator("#period").selectOption("30");
      await page.locator("#range-form button").click();
      await page.waitForFunction(
        () => document.querySelector("#daily-rows").children.length === 30,
      );
      await page.evaluate(() =>
        Promise.all([...document.images].map((im) => im.decode())),
      );
      await page.screenshot({
        path: `test-results/analytics/dashboard-${width}.png`,
        fullPage: true,
      });
      mode = "empty";
      await page.locator("#refresh").click();
      await page.waitForFunction(
        () => document.querySelector("#total-today").textContent === "0",
      );
      assert(await page.locator("#empty").isVisible());
      mode = "error";
      await page.locator("#refresh").click();
      await page.waitForFunction(
        () => !document.querySelector("#retry").hidden,
      );
      assert.equal(await page.locator("#total-today").textContent(), "—");
      assert.equal(await page.locator("#books article").count(), 0);
      mode = "data";
      await page.locator("#retry").click();
      await page.waitForFunction(
        () => document.querySelector("#total-today").textContent === "6",
      );
      mode = "slow";
      await page.locator("#refresh").click();
      await page.locator("#logout").click();
      await page.waitForTimeout(900);
      assert(await page.locator("#dashboard").isHidden());
      assert.equal(await page.locator("#books article").count(), 0);
      assert(logouts > 0);
      mode = "unauthorized";
      await login();
      await page.waitForFunction(() =>
        document
          .querySelector("#status")
          .textContent.includes("sessão expirou"),
      );
      assert(await page.locator("#dashboard").isHidden());
      assert.equal(await page.evaluate(() => localStorage.length), 0);
      assert.equal(await page.evaluate(() => sessionStorage.length), 0);
      assert.deepEqual(errors, []);
      results.push({ width, dashboard: "passed", queries, logouts });
      await context.close();
    }
    fs.writeFileSync(
      "test-results/analytics/results.json",
      JSON.stringify(results, null, 2),
    );
    console.log(JSON.stringify(results));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
