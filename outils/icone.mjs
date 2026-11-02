// Génère l'icône d'écran d'accueil (PNG 180×180, RVB opaque) et l'écrit en base64.
// Usage : node outils/icone.mjs > icone.b64   — sans dépendance (zlib est intégré à Node).
import { deflateSync } from 'node:zlib';

const N = 180, SS = 4, W = N * SS; // suréchantillonnage 4× pour lisser les bords
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const BAR = hex('#d9dde3'), PLATE = hex('#f0a63a'), PLATE2 = hex('#f7c46f');

// Rectangles arrondis en coordonnées 180 px : [x, y, l, h, rayon, couleur]
const SHAPES = [
  [20, 86, 140, 8, 3, BAR],
  [44, 46, 15, 88, 5, PLATE], [121, 46, 15, 88, 5, PLATE],
  [30, 60, 12, 60, 4, PLATE2], [138, 60, 12, 60, 4, PLATE2],
];
const inRR = (x, y, [rx, ry, rw, rh, r]) => {
  if (x < rx || y < ry || x > rx + rw || y > ry + rh) return false;
  const cx = Math.min(Math.max(x, rx + r), rx + rw - r), cy = Math.min(Math.max(y, ry + r), ry + rh - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
const bg = y => { const t = y / N; return [0, 1, 2].map(i => Math.round([0x22, 0x27, 0x2f][i] * (1 - t) + [0x0f, 0x11, 0x14][i] * t)); };

const raw = Buffer.alloc((N * 3 + 1) * N);
for (let y = 0; y < N; y++) {
  raw[y * (N * 3 + 1)] = 0;
  for (let x = 0; x < N; x++) {
    const acc = [0, 0, 0];
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const px = x + (sx + .5) / SS, py = y + (sy + .5) / SS;
      let c = bg(py);
      for (const s of SHAPES) if (inRR(px, py, s)) c = s[5];
      acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
    }
    const o = y * (N * 3 + 1) + 1 + x * 3;
    for (let i = 0; i < 3; i++) raw[o + i] = Math.round(acc[i] / (SS * SS));
  }
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = b => { let c = -1; for (const v of b) c = CRC[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4), t = Buffer.from(type), c = Buffer.alloc(4);
  len.writeUInt32BE(data.length); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 2;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
if (process.argv[2]) (await import('node:fs')).writeFileSync(process.argv[2], png);
process.stdout.write(png.toString('base64'));
