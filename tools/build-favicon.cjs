// Deterministic area resampling of the existing author artwork; no new identity.
const fs = require('node:fs');
const { PNG } = require('pngjs');
const source = PNG.sync.read(fs.readFileSync('assets/logo-gc.png'));
let left = source.width, top = source.height, right = 0, bottom = 0;
for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
  if (source.data[(y * source.width + x) * 4 + 3] > 16) {
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
  }
}
const side = Math.max(right - left, bottom - top) / 0.9;
const startX = (left + right - side) / 2, startY = (top + bottom - side) / 2;
function raster(size) {
  const out = new PNG({ width: size, height: size });
  const scale = side / size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const x0 = startX + x * scale, y0 = startY + y * scale;
    const channels = [0, 0, 0];
    for (let sy = Math.floor(y0); sy < Math.ceil(y0 + scale); sy++) {
      for (let sx = Math.floor(x0); sx < Math.ceil(x0 + scale); sx++) {
        const weight = Math.max(0, Math.min(sx + 1, x0 + scale) - Math.max(sx, x0)) * Math.max(0, Math.min(sy + 1, y0 + scale) - Math.max(sy, y0));
        const inside = sx >= 0 && sy >= 0 && sx < source.width && sy < source.height;
        const i = (sy * source.width + sx) * 4;
        const alpha = inside ? source.data[i + 3] / 255 : 0;
        for (let c = 0; c < 3; c++) channels[c] += weight * (alpha * (inside ? source.data[i + c] : 0) + (1 - alpha) * 255);
      }
    }
    const i = (y * size + x) * 4;
    for (let c = 0; c < 3; c++) out.data[i + c] = Math.round(channels[c] / (scale * scale));
    out.data[i + 3] = 255;
  }
  return PNG.sync.write(out);
}
const sizes = [16, 32, 48];
const images = sizes.map(raster);
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2); directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
sizes.forEach((size, n) => {
  const entry = 6 + n * 16;
  directory[entry] = directory[entry + 1] = size;
  directory.writeUInt16LE(1, entry + 4); directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(images[n].length, entry + 8); directory.writeUInt32LE(offset, entry + 12);
  offset += images[n].length;
});
fs.writeFileSync('favicon.ico', Buffer.concat([directory, ...images]));
fs.writeFileSync('assets/favicon-16.png', images[0]);
fs.writeFileSync('assets/favicon-32.png', images[1]);
fs.writeFileSync('assets/apple-touch-icon.png', raster(180));
