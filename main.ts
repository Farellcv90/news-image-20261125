// news-image-20261125 — "The World in One Day"
// A newspaper front page summing up Wednesday 25 November 2026 in one image.
// Node 22, standard library only, no network. Deterministic: two runs
// produce byte-identical PNG output (1024x1024, under 1 MiB).
//
// Usage: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
const CREAM = 0xf4efe4;
const NAVY = 0x1f2a44;
const INK = 0x1a1a1a;
const RED = 0xb3232a;
const WHITE = 0xffffff;
const SKY = 0xa9c7d9;
const SKY2 = 0xcfdde6;
const SEA = 0x4f7590;
const SEA2 = 0x6d97ad;
const TAN = 0xd8c9a3;
const SAND = 0xe2d3a8;
const GREEN = 0x5d7d4a;
const GREY = 0x8a8a86;
const DARKGREY = 0x555550;
const GOLD = 0xd9a441;
const ORANGE = 0xd96a1e;
const YELLOW = 0xe8c832;
const BROWN = 0x7a5230;
const LIGHTBLUE = 0x7fa3bd;
const STEEL = 0x3d4a5c;
const PALE = 0xe9e2cf;

// ------------------------------------------------------------------- CRC32
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ------------------------------------------------------------- PNG encoder
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(w: number, h: number, rgb: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ canvas
class Canvas {
  buf: Buffer;
  constructor() {
    this.buf = Buffer.alloc(W * H * 3, 0);
  }
  px(x: number, y: number, c: number): void {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 3;
    this.buf[o] = (c >> 16) & 0xff;
    this.buf[o + 1] = (c >> 8) & 0xff;
    this.buf[o + 2] = c & 0xff;
  }
  rect(x: number, y: number, w: number, h: number, c: number): void {
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(W, x + w);
    const y1 = Math.min(H, y + h);
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) this.px(xx, yy, c);
    }
  }
  hline(x: number, y: number, w: number, c: number): void {
    for (let i = 0; i < w; i++) this.px(x + i, y, c);
  }
  vline(x: number, y: number, h: number, c: number): void {
    for (let i = 0; i < h; i++) this.px(x, y + i, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.px(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }
  thickLine(x0: number, y0: number, x1: number, y1: number, w: number, c: number): void {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + 1;
    const r = Math.floor(w / 2);
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / steps);
      const y = Math.round(y0 + ((y1 - y0) * i) / steps);
      this.circle(x, y, r, c);
    }
  }
  circle(cx: number, cy: number, r: number, c: number): void {
    this.ellipse(cx, cy, r, r, c);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number): void {
    for (let dy = -ry; dy <= ry; dy++) {
      const t = 1 - (dy * dy) / (ry * ry);
      if (t < 0) continue;
      const dx = Math.floor(rx * Math.sqrt(t));
      this.hline(cx - dx, cy + dy, dx * 2 + 1, c);
    }
  }
  ring(cx: number, cy: number, r: number, c: number): void {
    for (let a = 0; a < 360; a += 2) {
      const rad = (a * Math.PI) / 180;
      this.px(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), c);
    }
  }
  poly(pts: [number, number][], c: number): void {
    if (pts.length < 3) return;
    let minY = H;
    let maxY = 0;
    for (const [, y] of pts) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    for (let y = Math.max(0, minY); y <= Math.min(H - 1, maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          xs.push(Math.round(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0)));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        this.hline(xs[i], y, xs[i + 1] - xs[i] + 1, c);
      }
    }
  }
}

// ------------------------------------------------------------ bitmap font
// 5x7 glyphs, uppercase A-Z, digits, and . , : ' - ( ) ! ? / & %
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

function glyph(ch: string): string[] {
  return FONT[ch] || FONT["?"];
}

function textWidth(s: string, scale: number): number {
  if (s.length === 0) return 0;
  return s.length * (5 * scale + scale) - scale;
}

function drawText(cv: Canvas, s: string, x: number, y: number, scale: number, c: number): number {
  let cx = x;
  for (const ch of s) {
    const g = glyph(ch);
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === "1") {
          cv.rect(cx + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
    cx += 5 * scale + scale;
  }
  return cx - x - scale;
}

function drawTextCentered(cv: Canvas, s: string, cx: number, y: number, scale: number, c: number): void {
  drawText(cv, s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c);
}

function wrapText(s: string, maxW: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur === "" ? w : cur + " " + w;
    if (textWidth(t, scale) <= maxW) {
      cur = t;
    } else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ------------------------------------------------------------------ scenes
// Each scene draws into a box (x, y, w, h) with flat shapes.

function drawDrone(cv: Canvas, x: number, y: number, s: number, c: number): void {
  cv.rect(x - 3 * s, y - s, 6 * s, 2 * s, c);
  cv.rect(x - 5 * s, y - 2 * s, 2 * s, s, c);
  cv.rect(x + 3 * s, y - 2 * s, 2 * s, s, c);
  cv.rect(x - s, y + s, 2 * s, 2 * s, c);
}

function drawFlame(cv: Canvas, x: number, y: number, s: number): void {
  cv.poly(
    [
      [x, y - 6 * s],
      [x + 3 * s, y],
      [x + s, y],
      [x + 2 * s, y - 2 * s],
      [x, y],
      [x - 2 * s, y - 2 * s],
      [x - s, y],
      [x - 3 * s, y],
    ],
    ORANGE,
  );
  cv.poly(
    [
      [x, y - 3 * s],
      [x + 2 * s, y],
      [x - 2 * s, y],
    ],
    YELLOW,
  );
}

function drawLeadScene(cv: Canvas, n: number, x: number, y: number, w: number, h: number): void {
  if (n === 1) {
    // Warship sinking in a harbour, drone above.
    cv.rect(x, y, w, h, SKY);
    cv.rect(x, y + (h * 2) / 3, w, h / 3, SEA);
    cv.rect(x, y + (h * 2) / 3, w, 3, SEA2);
    // distant harbour wall
    cv.rect(x, y + h / 2, w, 8, DARKGREY);
    // sinking hull, bow up
    cv.poly(
      [
        [x + 30, y + h - 18],
        [x + w - 40, y + h - 34],
        [x + w - 20, y + h - 22],
        [x + w - 30, y + h - 8],
      ],
      STEEL,
    );
    cv.rect(x + w - 90, y + h - 62, 10, 30, STEEL);
    cv.rect(x + w - 120, y + h - 52, 40, 8, INK);
    // smoke
    cv.circle(x + w - 96, y + h - 74, 10, GREY);
    cv.circle(x + w - 78, y + h - 84, 13, GREY);
    cv.circle(x + w - 58, y + h - 76, 9, GREY);
    // waves
    cv.hline(x + 12, y + h - 12, 40, WHITE);
    cv.hline(x + w - 70, y + h - 10, 46, WHITE);
    // drone
    drawDrone(cv, x + 70, y + 26, 2, INK);
  } else if (n === 2) {
    // Tall tower with drone and smoke, city skyline.
    cv.rect(x, y, w, h, SKY2);
    // skyline
    cv.rect(x + 6, y + h - 52, 34, 52, GREY);
    cv.rect(x + 46, y + h - 40, 26, 40, DARKGREY);
    cv.rect(x + 226, y + h - 58, 36, 58, GREY);
    cv.rect(x + 268, y + h - 44, 28, 44, DARKGREY);
    // Kingdom-style tower
    cv.rect(x + 128, y + 8, 64, h - 8, NAVY);
    cv.poly(
      [
        [x + 128, y + 8],
        [x + 192, y + 8],
        [x + 160, y - 6],
      ],
      NAVY,
    );
    // arch opening near the top
    cv.ellipse(x + 160, y + 34, 12, 16, SKY2);
    cv.rect(x + 148, y + 34, 24, 16, SKY2);
    // windows
    for (let i = 0; i < 5; i++) {
      cv.rect(x + 136, y + 58 + i * 9, 12, 4, YELLOW);
      cv.rect(x + 172, y + 58 + i * 9, 12, 4, YELLOW);
    }
    // smoke from the tower
    cv.circle(x + 206, y + 30, 11, GREY);
    cv.circle(x + 222, y + 20, 14, GREY);
    cv.circle(x + 240, y + 28, 10, GREY);
    // drone
    drawDrone(cv, x + 90, y + 22, 2, INK);
    // red warning light on tower
    cv.circle(x + 160, y + 4, 4, RED);
  } else {
    // Server room, broken shield, warning light.
    cv.rect(x, y, w, h, STEEL);
    cv.rect(x + 8, y + 8, 52, h - 16, INK);
    cv.rect(x + 68, y + 8, 52, h - 16, INK);
    cv.rect(x + 128, y + 8, 52, h - 16, INK);
    for (const rx of [8, 68, 128]) {
      for (let i = 0; i < 5; i++) {
        cv.rect(x + rx + 6, y + 16 + i * 16, 40, 8, DARKGREY);
        cv.circle(x + rx + 44, y + 20 + i * 16, 2, i % 2 === 0 ? 0x3fae5a : YELLOW);
      }
    }
    // broken shield
    cv.poly(
      [
        [x + 236, y + 14],
        [x + 292, y + 14],
        [x + 292, y + 52],
        [x + 264, y + 84],
        [x + 236, y + 52],
      ],
      LIGHTBLUE,
    );
    cv.thickLine(x + 252, y + 22, x + 268, y + 44, 3, WHITE);
    cv.thickLine(x + 268, y + 44, x + 256, y + 66, 3, WHITE);
    // warning light
    cv.circle(x + 292, y + 14, 7, RED);
    cv.circle(x + 292, y + 14, 3, WHITE);
  }
}

function drawIcon(cv: Canvas, n: number, x: number, y: number, w: number, h: number): void {
  if (n === 4) {
    // Early-warning radar plane over Poland.
    cv.rect(x, y, w, h, SKY);
    cv.poly(
      [
        [x + 30, y + 18],
        [x + 62, y + 12],
        [x + 88, y + 20],
        [x + 96, y + 34],
        [x + 74, y + 44],
        [x + 44, y + 42],
        [x + 26, y + 32],
      ],
      TAN,
    );
    // plane
    cv.poly(
      [
        [x + 130, y + 12],
        [x + 210, y + 18],
        [x + 130, y + 26],
        [x + 150, y + 20],
      ],
      INK,
    );
    cv.poly(
      [
        [x + 160, y + 8],
        [x + 176, y + 8],
        [x + 172, y + 20],
        [x + 162, y + 20],
      ],
      INK,
    );
    cv.circle(x + 216, y + 20, 5, INK);
    // radar rings
    cv.ring(x + 216, y + 20, 11, WHITE);
    cv.ring(x + 216, y + 20, 17, WHITE);
  } else if (n === 5) {
    // Oil tanker on fire in a strait, mines.
    cv.rect(x, y, w, h, SKY2);
    cv.rect(x, y + (h * 3) / 5, w, (h * 2) / 5, SEA);
    cv.rect(x + 30, y + 22, 150, 14, INK);
    cv.rect(x + 40, y + 10, 24, 12, RED);
    cv.rect(x + 150, y + 16, 10, 8, WHITE);
    drawFlame(cv, x + 70, y + 24, 2);
    drawFlame(cv, x + 120, y + 24, 2);
    drawFlame(cv, x + 160, y + 24, 1);
    // mines
    cv.circle(x + 200, y + 40, 5, INK);
    cv.line(x + 192, y + 40, x + 208, y + 40, INK);
    cv.line(x + 200, y + 32, x + 200, y + 48, INK);
    cv.circle(x + 26, y + 42, 4, INK);
  } else if (n === 6) {
    // Kremlin silhouette with warning flag.
    cv.rect(x, y, w, h, SKY2);
    cv.rect(x, y + h - 18, w, 18, 0x9e3b32);
    for (let i = 0; i < 6; i++) cv.rect(x + 8 + i * 38, y + h - 26, 14, 8, 0x9e3b32);
    // towers with onion domes
    for (const tx of [36, 108, 180]) {
      cv.rect(x + tx, y + 12, 16, h - 26, 0x9e3b32);
      cv.circle(x + tx + 8, y + 10, 9, GOLD);
      cv.rect(x + tx + 7, y - 2, 2, 6, GOLD);
    }
    // warning flag
    cv.line(x + 210, y + 6, x + 210, y + 34, INK);
    cv.poly(
      [
        [x + 210, y + 6],
        [x + 228, y + 11],
        [x + 210, y + 16],
      ],
      RED,
    );
  } else if (n === 7) {
    // Medal on a ribbon at a podium.
    cv.rect(x, y, w, h, PALE);
    cv.rect(x + 30, y + h - 14, w - 60, 14, DARKGREY);
    cv.rect(x + 60, y + h - 26, w - 120, 12, GREY);
    // ribbon
    cv.poly(
      [
        [x + 96, y + 4],
        [x + 112, y + 4],
        [x + 118, y + 26],
        [x + 104, y + 26],
      ],
      RED,
    );
    cv.poly(
      [
        [x + 122, y + 4],
        [x + 138, y + 4],
        [x + 130, y + 26],
        [x + 116, y + 26],
      ],
      0x7a1a1e,
    );
    // medal
    cv.circle(x + 118, y + 34, 11, GOLD);
    cv.ring(x + 118, y + 34, 7, 0x8a6a1a);
    cv.poly(
      [
        [x + 118, y + 27],
        [x + 120, y + 32],
        [x + 125, y + 32],
        [x + 121, y + 35],
        [x + 123, y + 40],
        [x + 118, y + 37],
        [x + 113, y + 40],
        [x + 115, y + 35],
        [x + 111, y + 32],
        [x + 116, y + 32],
      ],
      0x8a6a1a,
    );
  } else if (n === 8) {
    // Smartphone with gavel and circuit lines.
    cv.rect(x, y, w, h, PALE);
    cv.rect(x + 84, y + 4, 62, 42, INK);
    cv.rect(x + 89, y + 9, 52, 30, LIGHTBLUE);
    cv.rect(x + 96, y + 42, 38, 2, INK);
    // circuit lines
    cv.line(x + 10, y + 12, x + 70, y + 12, STEEL);
    cv.line(x + 10, y + 24, x + 70, y + 24, STEEL);
    cv.line(x + 10, y + 36, x + 70, y + 36, STEEL);
    cv.circle(x + 70, y + 12, 3, STEEL);
    cv.circle(x + 70, y + 24, 3, STEEL);
    cv.circle(x + 70, y + 36, 3, STEEL);
    // gavel
    cv.thickLine(x + 170, y + 8, x + 200, y + 40, 4, BROWN);
    cv.rect(x + 162, y + 2, 22, 12, BROWN);
    cv.rect(x + 196, y + 34, 14, 6, BROWN);
  } else if (n === 9) {
    // Falling stock chart, big red arrow.
    cv.rect(x, y, w, h, WHITE);
    cv.line(x + 14, y + 6, x + 14, y + h - 8, INK);
    cv.line(x + 14, y + h - 8, x + w - 8, y + h - 8, INK);
    cv.thickLine(x + 20, y + 12, x + 70, y + 18, 2, STEEL);
    cv.thickLine(x + 70, y + 18, x + 120, y + 14, 2, STEEL);
    cv.thickLine(x + 120, y + 14, x + 170, y + 30, 2, STEEL);
    cv.thickLine(x + 170, y + 30, x + 220, y + 44, 2, RED);
    cv.poly(
      [
        [x + 196, y + 34],
        [x + 226, y + 44],
        [x + 200, y + 46],
      ],
      RED,
    );
    cv.circle(x + 70, y + 18, 3, STEEL);
    cv.circle(x + 170, y + 30, 3, RED);
  } else if (n === 10) {
    // Two turkeys on a lawn with a podium.
    cv.rect(x, y, w, h, SKY2);
    cv.rect(x, y + h - 14, w, 14, GREEN);
    // podium
    cv.rect(x + 96, y + h - 26, 44, 12, DARKGREY);
    // turkey 1
    cv.ellipse(x + 66, y + 30, 16, 12, BROWN);
    cv.circle(x + 82, y + 18, 6, BROWN);
    cv.poly(
      [
        [x + 48, y + 26],
        [x + 56, y + 10],
        [x + 62, y + 24],
      ],
      0x9a6a3a,
    );
    cv.poly(
      [
        [x + 62, y + 24],
        [x + 70, y + 8],
        [x + 74, y + 24],
      ],
      0x9a6a3a,
    );
    // turkey 2
    cv.ellipse(x + 168, y + 32, 14, 10, 0x6a4526);
    cv.circle(x + 182, y + 22, 5, 0x6a4526);
    cv.poly(
      [
        [x + 152, y + 28],
        [x + 160, y + 14],
        [x + 166, y + 26],
      ],
      BROWN,
    );
    cv.poly(
      [
        [x + 164, y + 26],
        [x + 172, y + 12],
        [x + 176, y + 26],
      ],
      BROWN,
    );
  } else if (n === 11) {
    // Cricket bat and ball.
    cv.rect(x, y, w, h, GREEN);
    cv.rect(x, y + h - 10, w, 10, 0x4a6a3c);
    // pitch
    cv.rect(x + 90, y + 6, 56, h - 16, SAND);
    // stumps
    cv.line(x + 96, y + 12, x + 96, y + 30, YELLOW);
    cv.line(x + 102, y + 12, x + 102, y + 30, YELLOW);
    cv.line(x + 108, y + 12, x + 108, y + 30, YELLOW);
    // bat
    cv.poly(
      [
        [x + 150, y + 8],
        [x + 162, y + 14],
        [x + 140, y + 40],
        [x + 128, y + 34],
      ],
      TAN,
    );
    cv.thickLine(x + 158, y + 10, x + 170, y + 2, 3, BROWN);
    // ball
    cv.circle(x + 196, y + 38, 6, RED);
    cv.circle(x + 196, y + 38, 2, WHITE);
  } else if (n === 12) {
    // Apartment block in rubble with rescue lights.
    cv.rect(x, y, w, h, SKY2);
    cv.rect(x + 16, y + 10, 60, 30, GREY);
    cv.poly(
      [
        [x + 16, y + 10],
        [x + 46, y + 2],
        [x + 76, y + 10],
      ],
      DARKGREY,
    );
    cv.rect(x + 96, y + 18, 54, 22, DARKGREY);
    // rubble
    cv.poly(
      [
        [x + 20, y + h - 6],
        [x + 60, y + h - 22],
        [x + 100, y + h - 6],
      ],
      GREY,
    );
    cv.poly(
      [
        [x + 110, y + h - 6],
        [x + 150, y + h - 18],
        [x + 190, y + h - 6],
      ],
      DARKGREY,
    );
    // rescue lights
    cv.poly(
      [
        [x + 200, y + 8],
        [x + 214, y + 8],
        [x + 226, y + 34],
        [x + 196, y + 34],
      ],
      YELLOW,
    );
    cv.circle(x + 207, y + 6, 4, RED);
  } else if (n === 13) {
    // Desert road with military convoy and a city.
    cv.rect(x, y, w, h, SKY2);
    cv.rect(x, y + h - 20, w, 20, SAND);
    // distant city
    cv.rect(x + 150, y + h - 34, 18, 14, GREY);
    cv.rect(x + 172, y + h - 40, 12, 20, GREY);
    cv.rect(x + 188, y + h - 30, 22, 10, GREY);
    // road
    cv.poly(
      [
        [x, y + h - 8],
        [x + w, y + h - 16],
        [x + w, y + h - 6],
        [x, y + h - 2],
      ],
      DARKGREY,
    );
    // convoy trucks
    cv.rect(x + 24, y + h - 26, 30, 12, 0x4a5a3a);
    cv.rect(x + 54, y + h - 28, 8, 14, 0x4a5a3a);
    cv.rect(x + 76, y + h - 24, 30, 12, 0x4a5a3a);
    cv.rect(x + 106, y + h - 26, 8, 14, 0x4a5a3a);
    cv.circle(x + 32, y + h - 12, 3, INK);
    cv.circle(x + 46, y + h - 12, 3, INK);
    cv.circle(x + 84, y + h - 12, 3, INK);
    cv.circle(x + 98, y + h - 12, 3, INK);
  } else if (n === 14) {
    // Courthouse with scales and gavel.
    cv.rect(x, y, w, h, PALE);
    cv.poly(
      [
        [x + 76, y + 4],
        [x + 160, y + 4],
        [x + 118, y + 18],
      ],
      DARKGREY,
    );
    cv.rect(x + 80, y + 18, 76, 26, WHITE);
    for (const cx of [88, 108, 128, 148]) cv.rect(x + cx, y + 20, 5, 22, GREY);
    cv.rect(x + 76, y + 44, 84, 4, DARKGREY);
    // scales
    cv.line(x + 30, y + 10, x + 30, y + 34, INK);
    cv.line(x + 18, y + 14, x + 42, y + 14, INK);
    cv.poly(
      [
        [x + 14, y + 22],
        [x + 22, y + 22],
        [x + 18, y + 28],
      ],
      GOLD,
    );
    cv.poly(
      [
        [x + 38, y + 22],
        [x + 46, y + 22],
        [x + 42, y + 28],
      ],
      GOLD,
    );
    // gavel
    cv.thickLine(x + 186, y + 10, x + 206, y + 34, 4, BROWN);
    cv.rect(x + 180, y + 6, 18, 10, BROWN);
  } else {
    // Court building with French flag.
    cv.rect(x, y, w, h, PALE);
    cv.rect(x + 60, y + 10, 110, 34, WHITE);
    cv.poly(
      [
        [x + 56, y + 10],
        [x + 174, y + 10],
        [x + 115, y - 2],
      ],
      DARKGREY,
    );
    for (const cx of [70, 92, 114, 136, 158]) cv.rect(x + cx, y + 14, 5, 28, GREY);
    // French flag
    cv.line(x + 196, y + 2, x + 196, y + 44, INK);
    cv.rect(x + 196, y + 4, 10, 12, 0x1e3a8a);
    cv.rect(x + 206, y + 4, 10, 12, WHITE);
    cv.rect(x + 216, y + 4, 10, 12, RED);
  }
}

// ------------------------------------------------------------------ content
type Story = {
  n: number;
  kicker: string;
  headline: string[]; // hand-wrapped lines, large font
  deck: string;
};

const LEADS: Story[] = [
  {
    n: 1,
    kicker: "UKRAINE - BLACK SEA",
    headline: ["ZELENSKYY CONFIRMS UKRAINE", "SANK RUSSIAN WARSHIP"],
    deck: "Warship sunk off Libya, cargo ship hit in Gulf of Finland",
  },
  {
    n: 2,
    kicker: "MIDDLE EAST - RIYADH",
    headline: ["HOUTHI DRONE HITS RIYADH'S", "TALLEST TOWER"],
    deck: "11 wounded, Saudi civil defence says, coalition condemns attack",
  },
  {
    n: 3,
    kicker: "US - INTELLIGENCE",
    headline: ["CIA AND SPY CHIEF'S", "OFFICE BREACHED"],
    deck: "Unclassified data hit in cyber breach, source says",
  },
];

const FEATURED: Story[] = [
  {
    n: 4,
    kicker: "EUROPE - POLAND",
    headline: ["EARLY-WARNING JETS", "TO POLAND"],
    deck: "Move follows missiles landing in Poland in Ukraine attack",
  },
  {
    n: 5,
    kicker: "MIDDLE EAST - HORMUZ",
    headline: ["TANKERS HIT BY MINES", "IN HORMUZ"],
    deck: "Iran navy says three tankers struck, shipping on alert",
  },
  {
    n: 6,
    kicker: "EUROPE - MOSCOW",
    headline: ["PUTIN: RETALIATION", "IS INEVITABLE"],
    deck: "After Ukraine strikes on Russian oil plants",
  },
  {
    n: 7,
    kicker: "US - WHITE HOUSE",
    headline: ["TRUMP GIVES GIULIANI", "MEDAL OF FREEDOM"],
    deck: "Ex-New York mayor honoured at White House",
  },
  {
    n: 8,
    kicker: "TECH - CHINA",
    headline: ["HUAWEI GUILTY OF", "STEALING SECRETS"],
    deck: "US jury convicts, clears firm of racketeering",
  },
  {
    n: 9,
    kicker: "MARKETS - AI",
    headline: ["ANTHROPIC SHARES", "SLIDE BELOW IPO PRICE"],
    deck: "Stock under 83 dollars, nearly 200 billion dollars lost",
  },
  {
    n: 10,
    kicker: "US - THANKSGIVING",
    headline: ["TRUMP PARDONS TURKEYS", "FREEDOM AND FEATHERS"],
    deck: "Annual rite ahead of Thanksgiving Day",
  },
  {
    n: 11,
    kicker: "SPORT - CRICKET",
    headline: ["ENGLAND LEVEL T20", "SERIES IN AUSTRALIA"],
    deck: "Eight-wicket win chasing 185 in second match",
  },
  {
    n: 12,
    kicker: "UKRAINE - KYIV",
    headline: ["RUSSIAN STRIKE KILLS", "11 NEAR KYIV"],
    deck: "Rescuers search rubble of apartment block",
  },
  {
    n: 13,
    kicker: "MIDDLE EAST - YEMEN",
    headline: ["HOUTHIS PRESS TOWARD", "ADEN, ARMY SAYS NO"],
    deck: "Fighters 60 km from temporary capital",
  },
  {
    n: 14,
    kicker: "US - COURTS",
    headline: ["FORT HOOD GUNMAN", "SEEKS EXECUTION STAY"],
    deck: "Hasan asks court to halt next week's execution",
  },
  {
    n: 15,
    kicker: "EUROPE - FRANCE",
    headline: ["SARKOZY CORRUPTION", "CASE SENT TO TRIAL"],
    deck: "Ex-president and wife face court, hearing April 2027",
  },
];

const ALSO: string[] = [
  "16. US ENVOY UNSURE ON ISRAEL AID END",
  "17. EU ANNOUNCES NEW SANCTIONS ON RUSSIA",
  "18. UN WARNS OVER GAZA HUMANITARIAN AID",
  "19. KUSHNER FLOATS NATO-LIKE KYIV PLEDGE",
  "20. RUSSIA, UKRAINE TRADE CHARGES AT UN",
  "21. SWEDEN VOTES ON KRISTERSSON STAYING PM",
  "22. O'HARE FLIGHTS DELAYED BY RADAR FAULT",
  "23. DELL RAISES OUTLOOK ON RECORD AI QUARTER",
  "24. NVIDIA FALLS 7 PERCENT ON PROBE QUESTIONS",
  "25. IRAN TO RATION POWER AS GRID BATTERED",
  "26. 700,000 RUSSIAN DEAD, STUDY FINDS",
  "27. IRAQ PM ORDERS KURD FIELDS SEIZED",
  "28. VENEZUELA DEBT PUT AT 237.5 BILLION",
  "29. US ARMY TO DETONATE LEAD AZIDE IN IOWA",
  "30. BJP AND AKALI DAL REUNITE IN PUNJAB",
  "31. NEPAL PM ENDS FIRST INDIA VISIT",
  "32. STAR SYSTEM THAT SHOULD NOT EXIST FOUND",
  "33. SOORYAVANSHI FASTEST DOUBLE TON",
  "34. MAN UTD FURY OVER YORO RED CARD",
  "35. DAY AGAINST VIOLENCE ON WOMEN MARKED",
];

// World map: approximate continent polygons in [lon, lat].
const CONTINENTS: [number, number][][] = [
  // North America
  [
    [-168, 66], [-140, 70], [-125, 72], [-110, 73], [-95, 80], [-85, 70],
    [-75, 62], [-60, 60], [-55, 52], [-65, 45], [-75, 40], [-80, 32],
    [-85, 30], [-90, 21], [-95, 18], [-105, 20], [-115, 28], [-125, 40],
    [-130, 50], [-140, 60], [-155, 58], [-165, 60],
  ],
  // South America
  [
    [-80, 10], [-75, 5], [-60, 5], [-50, 0], [-35, -8], [-40, -20],
    [-50, -30], [-60, -38], [-70, -50], [-73, -40], [-70, -20], [-80, -5],
  ],
  // Europe
  [
    [-10, 36], [-9, 43], [-2, 48], [0, 51], [5, 53], [8, 57], [10, 59],
    [18, 56], [21, 55], [24, 58], [28, 60], [30, 62], [32, 70], [40, 68],
    [45, 66], [40, 60], [35, 55], [30, 50], [28, 45], [23, 40], [19, 42],
    [12, 44], [3, 43], [-2, 37],
  ],
  // Africa
  [
    [-17, 15], [-10, 30], [0, 36], [10, 37], [20, 32], [32, 31], [35, 28],
    [40, 15], [43, 11], [48, 10], [51, 12], [40, 0], [35, -15], [30, -25],
    [20, -35], [15, -30], [12, -18], [9, -2], [9, 4], [-8, 5], [-13, 8],
  ],
  // Asia
  [
    [30, 62], [40, 68], [55, 68], [70, 72], [90, 75], [110, 76], [130, 72],
    [160, 70], [178, 66], [170, 60], [160, 55], [150, 60], [140, 50],
    [135, 43], [127, 40], [122, 32], [120, 25], [110, 20], [105, 10],
    [100, 8], [95, 15], [90, 22], [85, 20], [80, 8], [77, 8], [72, 20],
    [66, 25], [60, 25], [55, 26], [50, 29], [48, 30], [45, 25], [40, 20],
    [38, 15], [35, 28], [30, 36],
  ],
  // Oceania
  [
    [113, -22], [120, -15], [130, -12], [135, -15], [142, -11], [146, -19],
    [150, -22], [153, -27], [150, -37], [140, -38], [130, -32], [125, -33],
    [115, -35], [113, -25],
  ],
  // New Zealand
  [
    [167, -45], [174, -41], [178, -38], [175, -37], [172, -40], [168, -44],
  ],
];

// Map dot positions: [story number, lon, lat, dx, dy] (dx/dy nudge in px).
const DOTS: [number, number, number, number, number][] = [
  [1, 20.1, 32.1, 0, 0], // Benghazi, Libya
  [2, 46.7, 24.7, -6, -4], // Riyadh
  [3, -77.0, 38.9, -18, 4], // Washington DC
  [4, 19.4, 52.0, 0, -8], // Poland
  [5, 56.5, 26.5, 8, -6], // Strait of Hormuz
  [6, 37.6, 55.8, 6, -5], // Moscow
  [7, -77.0, 38.9, 16, -12], // Washington DC
  [8, -95.0, 39.0, -20, -14], // United States
  [9, -74.0, 40.7, 18, 6], // New York
  [10, -77.0, 38.9, -2, 16], // Washington DC
  [11, 149.0, -35.0, 0, 0], // south-east Australia
  [12, 30.5, 50.5, 4, 8], // Kyiv
  [13, 45.0, 12.8, 0, 10], // Aden, Yemen
  [14, -99.0, 31.0, -22, 8], // Texas
  [15, 2.35, 48.85, -9, 2], // Paris
];

// ------------------------------------------------------------------- build
function numberBadge(cv: Canvas, n: number, x: number, y: number, size: number, scale: number): void {
  const s = String(n);
  const bw = s.length === 1 ? size : size + 8;
  cv.rect(x, y, bw, size, RED);
  drawText(cv, s, x + Math.floor((bw - textWidth(s, scale)) / 2), y + Math.floor((size - 7 * scale) / 2), scale, WHITE);
}

function drawStoryCell(cv: Canvas, st: Story, x: number, y: number, w: number, big: boolean): void {
  if (big) {
    drawLeadScene(cv, st.n, x, y, w, 100);
    numberBadge(cv, st.n, x, y, 20, 2);
    drawText(cv, st.kicker, x, y + 108, 1, RED);
    let hy = y + 122;
    for (const ln of st.headline) {
      drawText(cv, ln, x, hy, 2, INK);
      hy += 16;
    }
    const deckLines = wrapText(st.deck.toUpperCase(), w, 1);
    let dy = hy + 6;
    for (const ln of deckLines.slice(0, 2)) {
      drawText(cv, ln, x, dy, 1, INK);
      dy += 10;
    }
  } else {
    drawIcon(cv, st.n, x, y, w, 50);
    numberBadge(cv, st.n, x, y, 16, 1);
    drawText(cv, st.kicker, x, y + 58, 1, RED);
    let hy = y + 72;
    for (const ln of st.headline) {
      drawText(cv, ln, x, hy, 2, INK);
      hy += 16;
    }
    const deckLines = wrapText(st.deck.toUpperCase(), w, 1);
    let dy = hy + 6;
    for (const ln of deckLines.slice(0, 2)) {
      drawText(cv, ln, x, dy, 1, INK);
      dy += 10;
    }
  }
}

function main(): void {
  const cv = new Canvas();
  cv.rect(0, 0, W, H, CREAM);

  // ---------------------------------------------------------- masthead
  cv.rect(0, 0, W, 115, NAVY);
  drawText(cv, "THE WORLD IN ONE DAY", 20, 16, 1, WHITE);
  const rightTop = "35 STORIES - 6 CONTINENTS - ONE DAY";
  drawText(cv, rightTop, W - 20 - textWidth(rightTop, 1), 16, 1, WHITE);
  drawTextCentered(cv, "WEDNESDAY 25 NOVEMBER 2026", W / 2, 44, 5, WHITE);
  cv.rect(0, 115, W, 3, RED);

  // ---------------------------------------------------------- three leads
  const leadXs = [20, 352, 684];
  for (let i = 0; i < 3; i++) {
    drawStoryCell(cv, LEADS[i], leadXs[i], 130, 320, true);
  }
  cv.hline(20, 318, 984, INK);

  // ---------------------------------------------------------- twelve featured
  const cellXs = [20, 269, 518, 767];
  const rowYs = [330, 478, 626];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const st = FEATURED[r * 4 + c];
      drawStoryCell(cv, st, cellXs[c], rowYs[r], 237, false);
    }
  }
  cv.hline(20, 784, 984, INK);

  // ---------------------------------------------------------- bottom band
  drawText(cv, "WHERE IT HAPPENED", 30, 796, 2, INK);
  drawText(cv, "ALSO ON WEDNESDAY 25 NOVEMBER", 500, 796, 2, INK);

  // world map
  const mapX0 = 30;
  const mapY0 = 822;
  const mapW = 440;
  const mapH = 150;
  cv.rect(mapX0 - 4, mapY0 - 4, mapW + 8, mapH + 8, 0xdfe9ee);
  const mx = (lon: number): number => mapX0 + ((lon + 180) / 360) * mapW;
  const my = (lat: number): number => mapY0 + ((90 - lat) / 150) * mapH;
  for (const cont of CONTINENTS) {
    const pts = cont.map(([lon, lat]) => [Math.round(mx(lon)), Math.round(my(lat))] as [number, number]);
    cv.poly(pts, TAN);
  }
  // numbered dots
  for (const [n, lon, lat, dx, dy] of DOTS) {
    const cx = Math.round(mx(lon)) + dx;
    const cy = Math.round(my(lat)) + dy;
    const s = String(n);
    const r = s.length === 1 ? 7 : 8;
    cv.circle(cx, cy, r, RED);
    cv.ring(cx, cy, r, WHITE);
    drawText(cv, s, cx - Math.floor(textWidth(s, 1) / 2), cy - 3, 1, WHITE);
  }
  drawText(cv, "NUMBERED DOTS MARK STORIES 1-15.", 30, 980, 1, INK);

  // also list, two columns of ten
  for (let i = 0; i < 10; i++) {
    const itemA = ALSO[i];
    const dotA = itemA.indexOf(".");
    const numA = itemA.slice(0, dotA + 1);
    const wA = drawText(cv, numA, 500, 826 + i * 15, 1, RED);
    drawText(cv, itemA.slice(dotA + 1), 500 + wA, 826 + i * 15, 1, INK);
    const itemB = ALSO[i + 10];
    const dotB = itemB.indexOf(".");
    const numB = itemB.slice(0, dotB + 1);
    const wB = drawText(cv, numB, 758, 826 + i * 15, 1, RED);
    drawText(cv, itemB.slice(dotB + 1), 758 + wB, 826 + i * 15, 1, INK);
  }

  // ---------------------------------------------------------- footer
  drawTextCentered(
    cv,
    "EVERY STORY HAPPENED OR WAS FIRST REPORTED ON WEDNESDAY 25 NOVEMBER 2026. DISPUTED CLAIMS ARE ATTRIBUTED.",
    W / 2,
    998,
    1,
    INK,
  );
  drawTextCentered(cv, "SOURCES: AP, REUTERS, AFP, BBC, AL JAZEERA, UN NEWS. ORIGINAL DRAWINGS.", W / 2, 1008, 1, INK);

  // ---------------------------------------------------------- write out
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(outDir, { recursive: true });
  const png = encodePNG(W, H, cv.buf);
  writeFileSync(outDir + "/entry.png", png);
}

main();
