const { chromium } = require('playwright');
const fs = require('node:fs');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve('.');
const files = fs.readdirSync(root).filter(x => x.endsWith('.html') && fs.readFileSync(x, 'utf8').includes('footer-expanded'));
(async () => {
 const browser = await chromium.launch({channel: process.env.TEST_CHANNEL || undefined});
 const results = [];
 fs.mkdirSync('test-results/footer-panel', {recursive:true});
 for (const width of [390, 768, 1440]) {
  const context = await browser.newContext({viewport:{width,height:900}});
  let baseline = false;
  await context.route('**/*', async route => {
   const url = new URL(route.request().url());
   if (url.origin !== 'http://footer.test') return route.abort();
   const file = decodeURIComponent(url.pathname.slice(1));
   if (!file || file.includes('..')) return route.abort();
   const body = baseline && (file.endsWith('.html') || file === 'styles.css')
    ? cp.execFileSync('git', ['show', process.env.FOOTER_BASE_SHA+':'+file]) : fs.readFileSync(path.join(root,file));
   await route.fulfill({body,contentType:({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'})[path.extname(file)] || 'application/octet-stream'});
  });
  const page = await context.newPage();
  const layout = () => page.evaluate(() => [...document.querySelectorAll('main,.footer-identity,.footer-nav,.footer-reading,.footer-support,.footer-bottom small')].map(x => {const r=x.getBoundingClientRect();return {text:x.textContent,x:r.x,y:r.y,w:r.width,h:r.height}}));
  for (const file of files) {
   let before;
   if (process.env.FOOTER_BASE_SHA) {
    baseline = true; await page.goto('http://footer.test/'+file); await page.evaluate(()=>document.fonts.ready); before = await layout();
   }
   baseline = false; await page.goto('http://footer.test/'+file); await page.evaluate(()=>document.fonts.ready);
   if (before) assert.deepEqual(await layout(),before, file+' unchanged content/layout');
   const link = page.getByRole('link',{name:'Painel privado',exact:true});
   assert.equal(await link.count(),1); assert.equal(await link.getAttribute('href'),'./painel.html');
   assert.equal(await link.getAttribute('title'),'Painel privado');
   const box=await link.boundingBox(); assert.ok(box.width>=44 && box.height>=44);
   await page.locator('.back-top').focus(); await page.keyboard.press('Tab'); assert.ok(await link.evaluate(x=>x===document.activeElement));
   assert.equal(await link.evaluate(x=>getComputedStyle(x).outlineStyle),'solid');
   assert.equal(await link.locator('span').evaluate(x=>getComputedStyle(x).visibility),'visible');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(file==='index.html') await page.locator('footer').screenshot({path:`test-results/footer-panel/footer-${width}.png`});
   await page.keyboard.press('Enter'); await page.waitForURL('**/painel.html');
   assert.ok(await page.locator('input[type=password]').isVisible());
   assert.equal(await page.locator('.footer-panel-link').count(),0);
  }
  results.push({width,pages:files.length,status:'passed'}); await context.close();
 }
 await browser.close(); fs.writeFileSync('test-results/footer-panel/results.json',JSON.stringify(results,null,2)); console.log(results);
})().catch(error=>{console.error(error);process.exit(1)});
