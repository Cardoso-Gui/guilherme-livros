const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PNG } = require('pngjs');
const files = fs.readdirSync('.').filter(name => name.endsWith('.html'));
const expected = new Map([
  ['./favicon.ico?v=gc-20261025', ['icon', '16x16 32x32 48x48', 'image/vnd.microsoft.icon']],
  ['./assets/favicon-32.png?v=gc-20261025', ['icon', '32x32', 'image/png']],
  ['./assets/favicon-16.png?v=gc-20261025', ['icon', '16x16', 'image/png']],
  ['./assets/apple-touch-icon.png?v=gc-20261025', ['apple-touch-icon', '180x180']],
]);
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const head = html.match(/<head>[\s\S]*?<\/head>/i)[0];
  const links = [...head.matchAll(/<link\b[^>]*>/g)].map(([tag]) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([,key,value])=>[key,value]))).filter(link=>['icon','apple-touch-icon'].includes(link.rel));
  assert.equal(links.length, expected.size, file);
  for (const [href, [rel, sizes, type]] of expected) {
    const link = links.find(link=>link.href===href);
    assert.ok(link, file+': '+href); assert.equal(link.rel,rel); assert.equal(link.sizes,sizes);
    if (type) assert.equal(link.type,type);
    const url = new URL(href, 'https://cardoso-gui.github.io/guilherme-livros/'+file);
    assert.ok(url.pathname.startsWith('/guilherme-livros/'));
    assert.ok(fs.existsSync(href.split('?')[0]));
  }
}
for (const [name,size] of [['favicon-16.png',16],['favicon-32.png',32],['apple-touch-icon.png',180]]) {
  const png = PNG.sync.read(fs.readFileSync('assets/'+name));
  assert.equal(png.width,size); assert.equal(png.height,size);
  assert.ok(png.data.some((value,index)=>index%4!==3 && value<100));
  for(let i=3;i<png.data.length;i+=4) assert.equal(png.data[i],255);
}
const ico=fs.readFileSync('favicon.ico');
assert.equal(ico.readUInt16LE(2),1); assert.equal(ico.readUInt16LE(4),3);
[16,32,48].forEach((size,n)=>{
 const entry=6+n*16, length=ico.readUInt32LE(entry+8), offset=ico.readUInt32LE(entry+12);
 assert.equal(ico[entry],size); assert.equal(ico[entry+1],size);
 const png=PNG.sync.read(ico.subarray(offset,offset+length)); assert.equal(png.width,size); assert.equal(png.height,size);
});
console.log(`Favicon references and assets passed on ${files.length} pages, including painel.html.`);
