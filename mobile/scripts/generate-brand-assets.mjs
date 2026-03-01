import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const outDir = path.resolve('/Users/ethan/Desktop/padely/mobile/assets');

function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function putPixel(img, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (img.width * y + x) * 4;
  img.data[i] = clamp(r);
  img.data[i + 1] = clamp(g);
  img.data[i + 2] = clamp(b);
  img.data[i + 3] = clamp(a);
}

function fillGradient(img, top, bottom) {
  for (let y = 0; y < img.height; y += 1) {
    const t = y / Math.max(1, img.height - 1);
    const r = lerp(top[0], bottom[0], t);
    const g = lerp(top[1], bottom[1], t);
    const b = lerp(top[2], bottom[2], t);

    for (let x = 0; x < img.width; x += 1) {
      putPixel(img, x, y, r, g, b, 255);
    }
  }
}

function fillCircle(img, cx, cy, radius, color) {
  const r2 = radius * radius;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(img.width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(img.height - 1, Math.ceil(cy + radius));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        putPixel(img, x, y, color[0], color[1], color[2], color[3] ?? 255);
      }
    }
  }
}

function fillRect(img, x, y, w, h, color) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(img.width, Math.ceil(x + w));
  const y1 = Math.min(img.height, Math.ceil(y + h));

  for (let yy = y0; yy < y1; yy += 1) {
    for (let xx = x0; xx < x1; xx += 1) {
      putPixel(img, xx, yy, color[0], color[1], color[2], color[3] ?? 255);
    }
  }
}

function drawPadelyMark(img, scale = 1) {
  const w = img.width;
  const h = img.height;
  const cx = w / 2;
  const cy = h / 2;

  const accent = [244, 211, 94, 255];
  const light = [235, 246, 252, 255];

  fillCircle(img, cx + 0.09 * w, cy - 0.18 * h, 0.26 * w * scale, [0, 209, 178, 45]);
  fillCircle(img, cx - 0.2 * w, cy + 0.23 * h, 0.3 * w * scale, [255, 255, 255, 18]);

  const px = cx - 0.19 * w * scale;
  const py = cy - 0.2 * h * scale;
  const pw = 0.32 * w * scale;
  const ph = 0.46 * h * scale;

  fillRect(img, px, py, pw * 0.32, ph, accent);
  fillRect(img, px + pw * 0.28, py, pw * 0.55, ph * 0.28, accent);
  fillRect(img, px + pw * 0.28, py + ph * 0.32, pw * 0.55, ph * 0.26, accent);
  fillRect(img, px + pw * 0.22, py + ph * 0.26, pw * 0.18, ph * 0.06, light);

  fillCircle(img, cx + 0.22 * w * scale, cy + 0.16 * h * scale, 0.12 * w * scale, light);
  fillCircle(img, cx + 0.22 * w * scale, cy + 0.16 * h * scale, 0.06 * w * scale, [16, 43, 60, 255]);

  const bandHeight = Math.max(6, Math.round(h * 0.04 * scale));
  fillRect(img, 0, h - bandHeight, w, bandHeight, [0, 209, 178, 185]);
}

function savePng(img, name) {
  const file = path.join(outDir, name);
  fs.writeFileSync(file, PNG.sync.write(img));
  return file;
}

function makeIcon() {
  const img = new PNG({ width: 1024, height: 1024 });
  fillGradient(img, [8, 28, 42], [11, 53, 74]);
  drawPadelyMark(img, 1);
  return savePng(img, 'icon.png');
}

function makeAdaptiveForeground() {
  const img = new PNG({ width: 1024, height: 1024 });
  drawPadelyMark(img, 0.88);
  return savePng(img, 'adaptive-foreground.png');
}

function makeSplash() {
  const img = new PNG({ width: 1242, height: 2436 });
  fillGradient(img, [7, 19, 29], [18, 58, 79]);
  fillCircle(img, 260, 420, 340, [0, 209, 178, 35]);
  fillCircle(img, 1050, 1930, 430, [244, 211, 94, 20]);
  drawPadelyMark(img, 0.8);
  return savePng(img, 'splash.png');
}

function makeFavicon() {
  const img = new PNG({ width: 256, height: 256 });
  fillGradient(img, [9, 33, 49], [14, 66, 92]);
  drawPadelyMark(img, 0.92);
  return savePng(img, 'favicon.png');
}

const files = [makeIcon(), makeAdaptiveForeground(), makeSplash(), makeFavicon()];
console.log('Generated assets:');
files.forEach((f) => console.log(`- ${f}`));
