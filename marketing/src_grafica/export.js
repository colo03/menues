/* SaleListo · Exportador PNG del Pack Gráfico
   Renderiza cada pieza de pieces.js con Chrome Headless y la guarda al píxel exacto.

   Uso (desde cualquier carpeta, con puppeteer-core instalado fuera del repo):
     $env:PUPPETEER_DIR = "$env:TEMP\sl_grafica_work"      # carpeta con node_modules/puppeteer-core
     $env:CHROME_PATH   = "C:\Program Files\Google\Chrome\Application\chrome.exe"   # opcional
     node marketing/src_grafica/export.js            # exporta todo
     node marketing/src_grafica/export.js c1s1 p2    # exporta solo esas piezas
*/
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');

const base = process.env.PUPPETEER_DIR ? createRequire(path.join(process.env.PUPPETEER_DIR, 'package.json')) : require;
const puppeteer = base('puppeteer-core');

const SRC = __dirname;
const OUT = path.resolve(SRC, '..');
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find(p => fs.existsSync(p));

(async () => {
  const only = process.argv.slice(2);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--allow-file-access-from-files', '--font-render-hinting=none'] });
  const page = await browser.newPage();
  const url = id => 'file:///' + path.join(SRC, 'render.html').replace(/\\/g, '/') + '?p=' + id;

  await page.goto(url('c1s1'));
  const list = await page.evaluate(() => Object.entries(window.PIECES).map(([id, p]) => ({ id, w: p.w, h: p.h, out: p.out })));
  let problems = 0;

  for (const p of list) {
    if (only.length && !only.includes(p.id)) continue;
    await page.setViewport({ width: p.w, height: p.h, deviceScaleFactor: 1 });
    await page.goto(url(p.id), { waitUntil: 'networkidle0' });
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))); });
    const issues = await page.evaluate(() => window.audit());
    const dest = path.join(OUT, p.out);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await page.screenshot({ path: dest, clip: { x: 0, y: 0, width: p.w, height: p.h } });
    console.log(`${issues.length ? '!!' : 'ok'} ${p.id.padEnd(7)} ${p.w}x${p.h} -> ${p.out}`);
    issues.forEach(i => console.log('     ' + i));
    problems += issues.length;
  }
  await browser.close();
  console.log(problems ? `\n${problems} posibles desbordes para revisar.` : '\nSin desbordes detectados.');
})();
