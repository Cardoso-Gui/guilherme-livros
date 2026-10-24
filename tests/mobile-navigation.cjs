const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8765';
(async () => {
  fs.mkdirSync('test-results', { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  for (const width of [390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    for (const file of ['index.html', 'descubra.html', 'novidades.html', 'labirinto-verde.html', 'noah.html', 'o-quinto-herdeiro.html']) {
      await page.goto(base + '/' + file);
      const header = page.locator('header.main-header');
      const nav = header.locator('nav');
      const bounds = await header.boundingBox();
      assert(bounds.height < 200, file + ': oversized header ' + bounds.height);
      for (const link of await nav.locator('a').all()) {
        await assert.doesNotReject(() => link.click({ trial: true }));
        const box = await link.boundingBox();
        const style = await link.evaluate(el => {
          const p = getComputedStyle(el.parentElement);
          return { opacity: p.opacity, visibility: p.visibility, pointerEvents: p.pointerEvents };
        });
        assert.equal(style.opacity, '1');
        assert.equal(style.visibility, 'visible');
        assert.notEqual(style.pointerEvents, 'none');
        assert(box.x >= 0 && box.x + box.width <= width + 1, file + ': nav outside viewport');
        assert(box.y >= bounds.y && box.y + box.height <= bounds.y + bounds.height + 1);
      }
      if (file === 'index.html') {
        assert.equal(await page.locator('#labirinto-featured-title').count(), 1);
        assert.equal(await page.locator('section.home-upcoming').count(), 0);
        const book = page.locator('article[aria-labelledby="labirinto-featured-title"]');
        assert.equal(await book.locator('a[href="./labirinto-verde-capitulo-1.html"]').count(), 1);
        assert.equal(await book.locator('a[href="https://www.amazon.com.br/dp/B0HN2QSW7V"]').count(), 1);
      }
      if (width === 390) await page.screenshot({ path: 'test-results/' + file + '-' + width + '.png' });
      results.push({ file, width, headerHeight: bounds.height, status: 'passed' });
    }
    await page.goto(base + '/descubra.html');
    for (const destination of ['index.html', 'novidades.html', 'descubra.html']) {
      await page.locator('header.main-header nav a[href="./' + destination + '"]').click();
      await page.waitForURL('**/' + destination);
    }
    await page.goBack();
    assert(page.url().endsWith('/novidades.html'));
    await page.goForward();
    assert(page.url().endsWith('/descubra.html'));
    await page.close();
  }
  fs.writeFileSync('test-results/results.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
