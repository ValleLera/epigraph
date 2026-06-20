import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const SVG = `<svg viewBox="0 0 236 236" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7ECFB3"/>
      <stop offset="100%" stop-color="#F4A8C0"/>
    </linearGradient>
  </defs>
  <g transform="translate(118,118)">
    <path fill="url(#cg)" stroke="#0A3D28" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"
          d="M 0,-118 L 102,-59 L 102,59 L 0,118 L -102,59 L -102,-59 Z"/>
    <path fill="#0A3D28" d="M -2.5,-118 C -5,-128 -1,-144 0,-152 C 1,-144 5,-128 2.5,-118 Z" transform="rotate(0)"/>
    <path fill="#0A3D28" d="M -2.5,-118 C -5,-128 -1,-144 0,-152 C 1,-144 5,-128 2.5,-118 Z" transform="rotate(60)"/>
    <path fill="#0A3D28" d="M -2.5,-118 C -5,-128 -1,-144 0,-152 C 1,-144 5,-128 2.5,-118 Z" transform="rotate(120)"/>
    <path fill="#0A3D28" d="M -2.5,-118 C -5,-128 -1,-144 0,-152 C 1,-144 5,-128 2.5,-118 Z" transform="rotate(180)"/>
    <path fill="#0A3D28" d="M -2.5,-118 C -5,-128 -1,-144 0,-152 C 1,-144 5,-128 2.5,-118 Z" transform="rotate(240)"/>
    <path fill="#0A3D28" d="M -2.5,-118 C -5,-128 -1,-144 0,-152 C 1,-144 5,-128 2.5,-118 Z" transform="rotate(300)"/>
    <path fill="#0A3D28" d="M 0,-68 C 38,-76 78,-52 81,-14 C 84,22 65,65 28,76 C 4,84 -26,74 -47,52 C -61,36 -57,17 -45,8 C -36,1 -49,-7 -49,-21 C -49,-47 -26,-63 0,-68 Z"/>
    <g transform="translate(12,4) scale(0.93) translate(-12,-4)">
      <path fill="#1A7A56" d="M 0,-68 C 38,-76 78,-52 81,-14 C 84,22 65,65 28,76 C 4,84 -26,74 -47,52 C -61,36 -57,17 -45,8 C -36,1 -49,-7 -49,-21 C -49,-47 -26,-63 0,-68 Z"/>
    </g>
    <ellipse cx="-6" cy="-24" rx="16" ry="12" fill="#2ECC8A" transform="rotate(-15,-6,-24)"/>
    <ellipse cx="30" cy="26" rx="12" ry="9" fill="#2ECC8A" transform="rotate(10,30,26)"/>
    <ellipse cx="42" cy="-8" rx="8" ry="6" fill="#2ECC8A"/>
  </g>
</svg>`;

const SIZES = [16, 32, 192, 512, 1024];

const browser = await chromium.launch();
const page = await browser.newPage();

if (!existsSync('icons')) mkdirSync('icons');

for (const size of SIZES) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:transparent">${SVG}</body></html>`);
  await page.evaluate((s) => {
    const svg = document.querySelector('svg');
    svg.setAttribute('width', s);
    svg.setAttribute('height', s);
    svg.style.display = 'block';
    document.body.style.width = s + 'px';
    document.body.style.height = s + 'px';
  }, size);
  const buf = await page.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  const dest = `icons/icon-${size}.png`;
  writeFileSync(dest, buf);
  console.log(`✓ ${dest}`);
}

await browser.close();
console.log('done');
