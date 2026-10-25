// Compare captures from the same machine/browser. Report raster noise separately.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { PNG } = require("pngjs");
const [before, after] = process.argv.slice(2);
assert(
  before && after,
  "Usage: node tests/compare-renderings.cjs before-directory after-directory",
);
function layout(dir) {
  const data = JSON.parse(fs.readFileSync(`${dir}/layout.json`));
  // Structural textContent includes inline script/style source, not just rendered text.
  for (const nodes of Object.values(data))
    for (const node of nodes) {
      if (node.tag === "A" && node.text === "Surpreenda-me ↗") {
        assert(
          [
            "./noah-capitulo-1.html",
            "./labirinto-verde-capitulo-1.html",
            "./o-quinto-herdeiro-capitulo-1.html",
          ].includes(node.href),
        );
        node.href = "random-valid-chapter";
      }
      if (
        !["H1", "H2", "H3", "P", "A", "BUTTON", "INPUT", "SELECT"].includes(
          node.tag,
        )
      )
        delete node.text;
    }
  return data;
}
assert(
  JSON.stringify(layout(after)) === JSON.stringify(layout(before)),
  "Computed layout, text, links or styles differ",
);
const results = [];
for (const file of fs.readdirSync(before).filter((f) => f.endsWith(".png"))) {
  const a = PNG.sync.read(fs.readFileSync(`${before}/${file}`));
  const b = PNG.sync.read(fs.readFileSync(`${after}/${file}`));
  assert.equal(a.width, b.width, file + ": width");
  assert.equal(a.height, b.height, file + ": height");
  let changed = 0;
  for (let i = 0; i < a.data.length; i += 4)
    if (
      a.data[i] !== b.data[i] ||
      a.data[i + 1] !== b.data[i + 1] ||
      a.data[i + 2] !== b.data[i + 2] ||
      a.data[i + 3] !== b.data[i + 3]
    )
      changed++;
  results.push({
    file,
    changedPixels: changed,
    totalPixels: a.width * a.height,
  });
}
console.log(
  JSON.stringify({ layout: "exact match", images: results }, null, 2),
);
