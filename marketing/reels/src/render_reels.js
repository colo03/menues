// Render de frames de un Reel con Chrome headless (puppeteer-core instalado en WORK, fuera del repo).
// Uso: node render_reels.js r01 [--frames=0,60,120] [--out=dir] [--workers=7] [--quality=94]
const path = require('path');
const fs = require('fs');
const os = require('os');

const WORK = process.env.SL_REELS_WORK || path.join(process.env.TEMP || os.tmpdir(), 'sl_reels_work');
const puppeteer = require(path.join(WORK, 'node_modules', 'puppeteer-core'));
const CHROME = process.env.CHROME_BIN || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const KEY = process.argv[2];
const args = Object.fromEntries(process.argv.slice(3).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const DIR = path.join(WORK, KEY);
const TL = JSON.parse(fs.readFileSync(path.join(DIR, 'timeline.json'), 'utf8'));
const OUT = path.resolve(args.out || path.join(DIR, 'frames_out'));
const WORKERS = parseInt(args.workers || '7', 10);
const QUALITY = parseInt(args.quality || '94', 10);
const FC = {};
for (const d of fs.readdirSync(path.join(DIR, 'frames_src'))) FC[d] = fs.readdirSync(path.join(DIR, 'frames_src', d)).length;

const frames = args.frames ? String(args.frames).split(',').map(Number) : Array.from({ length: TL.frames }, (_, i) => i);

async function worker(browser, id, list) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error') console.log(`[w${id}] console:`, m.text()); });
  page.on('pageerror', e => console.log(`[w${id}] pageerror:`, e.message));
  await page.goto('file:///' + path.join(__dirname, 'reel.html').replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.evaluate(async (tl, fc) => await window.init(tl, fc), TL, FC);
  const cdp = await page.target().createCDPSession();
  const t0 = Date.now();
  for (let n = 0; n < list.length; n++) {
    const f = list[n];
    await page.evaluate(async fr => await window.renderFrame(fr), f);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: QUALITY, optimizeForSpeed: true });
    fs.writeFileSync(path.join(OUT, `f_${String(f).padStart(5, '0')}.jpg`), data, 'base64');
    if ((n + 1) % 150 === 0) console.log(`[w${id}] ${n + 1}/${list.length} (${((n + 1) / ((Date.now() - t0) / 1000)).toFixed(1)} fps)`);
  }
  await page.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--allow-file-access-from-files', '--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb', '--hide-scrollbars'] });
  const t0 = Date.now();
  const lists = Array.from({ length: Math.min(WORKERS, frames.length) }, () => []);
  const per = Math.ceil(frames.length / lists.length);   // bloques contiguos (cache de imagenes)
  frames.forEach((f, i) => lists[Math.floor(i / per)].push(f));
  await Promise.all(lists.map((l, i) => worker(browser, i + 1, l)));
  await browser.close();
  console.log(`OK ${KEY}: ${frames.length} frames en ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${OUT}`);
})().catch(e => { console.error(e); process.exit(1); });
