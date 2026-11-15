// Gera os ícones da extensão em PNG, sem dependências.
// Mesmo símbolo da interface: anel com meia-luz, arco aceso e núcleo — mint sobre preto.

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// --- PNG ----------------------------------------------------------------

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filtro none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profundidade de bits
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- desenho ------------------------------------------------------------

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** cobertura de 1px para uma borda em `d` (distância com sinal). */
const cover = (d) => clamp01(0.5 - d);

const MINT = [92, 242, 196];

function draw(size) {
  const S = size;
  const px = Buffer.alloc(S * S * 4);
  const c = S / 2;

  const radius = S * 0.395;
  const ringW = Math.max(1.1, S * 0.062);
  const coreR = S * 0.118;
  const pad = S * 0.055;
  const rectHalf = S / 2 - pad;
  const round = S * 0.235;

  // source-over de uma cor sobre o pixel atual
  const blend = (i, r, g, b, a) => {
    if (a <= 0) return;
    const dstA = px[i + 3] / 255;
    const outA = a + dstA * (1 - a);
    if (outA <= 0) return;
    px[i] = Math.round((r * a + px[i] * dstA * (1 - a)) / outA);
    px[i + 1] = Math.round((g * a + px[i + 1] * dstA * (1 - a)) / outA);
    px[i + 2] = Math.round((b * a + px[i + 2] * dstA * (1 - a)) / outA);
    px[i + 3] = Math.round(outA * 255);
  };

  for (let y = 0; y < S; y++) {
    const fy = y + 0.5;
    for (let x = 0; x < S; x++) {
      const fx = x + 0.5;
      const i = (y * S + x) * 4;

      // placa: quadrado arredondado
      const qx = Math.abs(fx - c) - (rectHalf - round);
      const qy = Math.abs(fy - c) - (rectHalf - round);
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - round;
      const plate = cover(outside);
      if (plate > 0) {
        const t = fy / S;
        blend(i, Math.round(10 - 4 * t), Math.round(14 - 5 * t), Math.round(19 - 7 * t), plate);
      }

      const dist = Math.hypot(fx - c, fy - c);

      // anel em meia-luz
      const ringD = Math.abs(dist - radius) - ringW / 2;
      const ring = cover(ringD);
      if (ring > 0) blend(i, MINT[0], MINT[1], MINT[2], ring * 0.26);

      // arco aceso: metade direita, com pontas suaves
      if (ring > 0) {
        const ang = Math.atan2(fy - c, fx - c); // -PI..PI, 0 = direita
        const open = (Math.PI / 2) * 0.92; // meia-abertura ~166°
        const edge = Math.min(open - Math.abs(ang), 1); // 1 dentro, 0 fora
        const arc = clamp01(edge * 2);
        if (arc > 0) blend(i, MINT[0], MINT[1], MINT[2], ring * arc);
      }

      // núcleo
      const core = cover(dist - coreR);
      if (core > 0) blend(i, MINT[0], MINT[1], MINT[2], core);
    }
  }
  return px;
}

// --- saída --------------------------------------------------------------

const outDir = resolve(here, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const png = encodePng(size, size, draw(size));
  writeFileSync(resolve(outDir, `icon${size}.png`), png);
  console.log(`icon${size}.png  ${png.length} bytes`);
}
