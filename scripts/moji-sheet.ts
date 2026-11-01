/**
 * Renders every Moji into a static HTML contact sheet (dark + light grounds) for design review.
 * Usage: npx tsx scripts/moji-sheet.ts out.html
 */
import { writeFileSync } from 'node:fs';
import { MOJI_ART } from '../components/orbit/moji/art';
import type { MojiShape } from '../components/orbit/moji/types';

function shapeSvg(s: MojiShape): string {
  const common = `fill="${s.f}"${s.o != null ? ` opacity="${s.o}"` : ''}${s.tr ? ` transform="${s.tr}"` : ''}`;
  switch (s.t) {
    case 'p': return `<path d="${s.d}" ${common}/>`;
    case 'c': return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" ${common}/>`;
    case 'e': return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" ${common}/>`;
    case 'r': return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}"${s.rx ? ` rx="${s.rx}"` : ''} ${common}/>`;
  }
}
const only = process.argv[3]?.split(',');
const names = Object.keys(MOJI_ART).filter((n) => !only || only.some((p) => n.startsWith(p)));
const cell = (n: string, size: number) =>
  `<div class="c"><svg width="${size}" height="${size}" viewBox="0 0 24 24">${(MOJI_ART as Record<string, readonly MojiShape[]>)[n].map(shapeSvg).join('')}</svg><span>${n}</span></div>`;
const grid = (bg: string, fg: string, size: number) =>
  `<div class="g" style="background:${bg};color:${fg}">${names.map((n) => cell(n, size)).join('')}</div>`;
writeFileSync(process.argv[2], `<!doctype html><meta charset="utf-8"><style>
body{margin:0;font:11px -apple-system,Helvetica,sans-serif}
.g{display:grid;grid-template-columns:repeat(10,1fr);gap:6px;padding:14px}
.c{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 0}
.c span{opacity:.7}</style>
${grid('#0E1726', '#C9D3E3', 56)}${grid('#F4F6FA', '#44506A', 28)}`);
console.log(names.length, 'moji');
