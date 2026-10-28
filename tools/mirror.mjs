// Mirror a Framer site into a static folder.
// usage: node mirror.mjs <siteOrigin> <outDir> <page...>
import fs from 'node:fs/promises';
import path from 'node:path';

const [origin, outDir, ...pages] = process.argv.slice(2);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

// remote host -> local prefix (root-relative)
const HOSTS = {
  'https://framerusercontent.com/': '/assets/fu/',
  'https://fonts.gstatic.com/': '/assets/gfonts/',
  'https://framer.com/m/': '/assets/fm/',
};
const EXTRA = process.env.EXTRA ? (await fs.readFile(process.env.EXTRA, 'utf8')).split('\n').filter(Boolean) : [];
const hostRe = /https:\/\/(?:framerusercontent\.com|fonts\.gstatic\.com)\/[^"'`\s)\\<>,]+/g;

const seen = new Set();
const queue = [];
const failed = [];

function stripQuery(u) { return u.split(/[?#]/)[0]; }
function localPathFor(u) {
  const clean = stripQuery(u);
  for (const [h, p] of Object.entries(HOSTS)) if (clean.startsWith(h)) return (p + clean.slice(h.length)).replace(/\.js@[\d.]+$/, '.js');
  return null;
}
function enqueue(u) {
  u = stripQuery(u).replace(/&amp;$/, '');
  if (!localPathFor(u) || seen.has(u) || u.endsWith('/') || !/\/[^/]+\.[a-z0-9]+$/i.test(u) && !/\/images\/|\/assets\//.test(u) && !u.includes('framer.com/m/')) return;
  seen.add(u); queue.push(u);
}
function rewrite(text) {
  // Framer editor bar -> local no-op stub
  text = text.split('https://framer.com/edit/init.mjs').join('/assets/editorbar-stub.mjs');
  // icon modules: drop the @version suffix so files have a .js extension
  text = text.replace(/\.js@\d+\.\d+\.\d+`/g, '.js`');
  for (const [h, p] of Object.entries(HOSTS)) text = text.split(h).join(p);
  return text;
}

async function get(u) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(u, { headers: { 'user-agent': UA } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) { if (i === 2) throw e; }
  }
}

async function save(rel, buf) {
  const f = path.join(outDir, rel);
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.writeFile(f, buf);
}

const TEXT = /\.(m?js|css|json|svg|txt|html)$/i;

async function processAsset(u) {
  const lp = localPathFor(u);
  let buf;
  try { buf = await get(u); } catch (e) { failed.push(u + ' ' + e.message); return; }
  if (TEXT.test(lp)) {
    let t = buf.toString('utf8');
    for (const m of t.matchAll(hostRe)) enqueue(m[0]);
    // relative module imports / chunk refs within the same directory tree
    if (/\.m?js$/i.test(lp)) {
      for (const m of t.matchAll(/["'`](\.{1,2}\/[^"'`\s]+?\.(?:mjs|js|json|css))["'`]/g)) {
        enqueue(new URL(m[1], u).href);
      }
    }
    t = rewrite(t);
    await save(lp, Buffer.from(t, 'utf8'));
  } else {
    await save(lp, buf);
  }
}

// 1) pages
for (const p of pages) {
  const url = origin.replace(/\/$/, '') + (p === '' ? '/' : '/' + p);
  let html = (await get(url)).toString('utf8');
  for (const m of html.matchAll(hostRe)) enqueue(m[0].replace(/&amp;.*$/, ''));
  // remove Framer analytics + editor bar loader
  html = html.replace(/<script async src="https:\/\/events\.framer\.com\/script[^>]*><\/script>/g, '');
  html = html.replace(/<script>try\{if\(localStorage\.getItem\("__framer_force_showing_editorbar_since"\)\)[\s\S]*?<\/script>/, '');
  html = rewrite(html);
  // canonical / og urls -> keep pointing to origin? make them relative to final domain later
  const file = p === '' ? 'index.html' : p + '.html';
  await save(file, Buffer.from(html, 'utf8'));
  console.log('page', file);
}

for (const u of EXTRA) enqueue(u);
await save('assets/editorbar-stub.mjs', Buffer.from('export function createEditorBar(){return function EditorBar(){return null}}\n'));

// 2) assets (BFS, limited concurrency)
let done = 0;
async function worker() {
  while (queue.length) {
    const u = queue.shift();
    await processAsset(u);
    if (++done % 50 === 0) console.log('assets', done, 'queued', queue.length);
  }
}
while (queue.length) await Promise.all(Array.from({ length: 12 }, worker));
console.log('total assets', done);
if (failed.length) { console.log('FAILED:\n' + failed.join('\n')); }
