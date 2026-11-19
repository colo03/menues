/* SaleListo · Exportador PNG + PDF Nativos LinkedIn del Pack Gráfico
   Renderiza cada pieza de pieces.js con Chrome Headless al píxel exacto
   y genera los 3 PDFs multipágina (1080x1350 x 5 páginas) para LinkedIn.

   Uso (desde cualquier carpeta, con puppeteer-core instalado fuera del repo):
     $env:PUPPETEER_DIR = "$env:TEMP\sl_mkt_w5"
     node marketing/src_grafica/export.js                  # exporta todos los PNG + los 3 PDFs
     node marketing/src_grafica/export.js p4 c2s5 pdfs     # exporta piezas puntuales y/o PDFs
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

const CAROUSEL_PDFS = [
  { id: 'pdf1', slides: ['c1s1', 'c1s2', 'c1s3', 'c1s4', 'c1s5'], out: 'posts/SaleListo_Carrusel_01_Viajes.pdf' },
  { id: 'pdf2', slides: ['c2s1', 'c2s2', 'c2s3', 'c2s4', 'c2s5'], out: 'posts/SaleListo_Carrusel_02_Cero_Celulares.pdf' },
  { id: 'pdf3', slides: ['c3s1', 'c3s2', 'c3s3', 'c3s4', 'c3s5'], out: 'posts/SaleListo_Carrusel_03_Cocina_Barra.pdf' }
];

(async () => {
  const only = process.argv.slice(2);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--allow-file-access-from-files', '--font-render-hinting=none']
  });
  const page = await browser.newPage();
  const url = id => 'file:///' + path.join(SRC, 'render.html').replace(/\\/g, '/') + '?p=' + id;

  await page.goto(url('c1s1'));
  const list = await page.evaluate(() => Object.entries(window.PIECES).map(([id, p]) => ({ id, w: p.w, h: p.h, out: p.out })));
  let problems = 0;

  for (const p of list) {
    if (only.length && !only.includes(p.id) && !only.includes('pngs')) continue;
    await page.setViewport({ width: p.w, height: p.h, deviceScaleFactor: 1 });
    await page.goto(url(p.id), { waitUntil: 'networkidle0' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; })));
    });
    const issues = await page.evaluate(() => {
      const baseIssues = window.audit();
      const cv = document.querySelector('.cv');
      if (cv && Math.round(cv.getBoundingClientRect().height) === 1920) {
        const R = cv.getBoundingClientRect();
        const safe = cv.querySelector('.story-safe') || cv.firstElementChild;
        if (safe) {
          const sr = safe.getBoundingClientRect();
          if (sr.top - R.top < 250 - 0.5) baseIssues.push(`zona segura superior invadida: top=${Math.round(sr.top - R.top)}px (<250px)`);
          if (R.bottom - sr.bottom < 300 - 0.5) baseIssues.push(`zona segura inferior invadida: bottomGap=${Math.round(R.bottom - sr.bottom)}px (<300px)`);
          const kids = [...safe.children].filter(el => getComputedStyle(el).position !== 'absolute');
          for (let i = 1; i < kids.length; i++) {
            const gap = kids[i].getBoundingClientRect().top - kids[i - 1].getBoundingClientRect().bottom;
            if (gap < 8) baseIssues.push(`bloques apretados/solapados en story (${i - 1}->${i}): gap=${Math.round(gap)}px`);
          }
        }
      }
      const footEl = cv && (cv.querySelector('.pfoot') || cv.querySelector('.foot'));
      if (cv && footEl) {
        const fr = footEl.getBoundingClientRect();
        [...cv.children].forEach(ch => {
          if (ch === footEl || ch.classList.contains('top')) return;
          const cr = ch.getBoundingClientRect();
          if (cr.bottom > fr.top - 10) baseIssues.push(`cuerpo muy cerca o encima del pie: bodyBottom=${Math.round(cr.bottom)} vs footTop=${Math.round(fr.top)}`);
        });
      }
      return baseIssues;
    });
    const dest = path.join(OUT, p.out);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await page.screenshot({ path: dest, clip: { x: 0, y: 0, width: p.w, height: p.h } });
    console.log(`${issues.length ? '!!' : 'ok'} ${p.id.padEnd(7)} ${p.w}x${p.h} -> ${p.out}`);
    issues.forEach(i => console.log('     ' + i));
    problems += issues.length;
  }

  for (const c of CAROUSEL_PDFS) {
    if (only.length && !only.includes('pdfs') && !only.includes(c.id)) continue;
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
    await page.goto(url(c.slides[0]), { waitUntil: 'networkidle0' });
    await page.evaluate(async (slideIds) => {
      const style = document.createElement('style');
      style.textContent = `
        @page { size: 1080px 1350px; margin: 0; }
        html, body { margin: 0 !important; padding: 0 !important; width: 1080px; background: #faf7f2; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        #root { display: block !important; width: 1080px; margin: 0; padding: 0; }
        .pdf-slide { width: 1080px; height: 1350px; overflow: hidden; break-after: page; page-break-after: always; }
        .pdf-slide:last-child { break-after: auto; page-break-after: auto; }
      `;
      document.head.appendChild(style);
      document.getElementById('root').innerHTML = slideIds.map(id => `<div class="pdf-slide">${window.PIECES[id].html()}</div>`).join('');
      await document.fonts.ready;
      await Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; })));
    }, c.slides);
    const dest = path.join(OUT, c.out);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await page.pdf({
      path: dest,
      width: '1080px',
      height: '1350px',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
    });
    const raw = fs.readFileSync(dest, 'latin1');
    const pages = (raw.match(/\/Type\s*\/Page\b/g) || []).length;
    const ok = pages === c.slides.length;
    if (!ok) problems++;
    console.log(`${ok ? 'ok' : '!!'} ${c.id.padEnd(7)} 1080x1350 x ${pages}p -> ${c.out} (${Math.round(fs.statSync(dest).size / 1024)} KB)`);
  }

  await browser.close();
  console.log(problems ? `\n${problems} posibles problemas para revisar.` : '\nSin desbordes ni errores de paginado detectados.');
  if (problems) process.exitCode = 1;
})();
