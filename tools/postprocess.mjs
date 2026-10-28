// Apply site-specific fixes on top of the Framer mirror. Idempotent: safe to re-run.
// usage: node tools/postprocess.mjs [siteDir]
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.argv[2] || '.';
const DOMAIN = 'camcomerciolara.org.ve';
const ORIGIN = 'https://' + DOMAIN;
const FORM_ENDPOINT = 'https://formspree.io/f/xaeejrnl';
const SITE = 'Cámara de Comercio Lara';

// page file -> [public path, title, description]
const PAGES = {
  'index.html': ['/', SITE,
    'Cámara de Comercio del Estado Lara: gremio que desde 1901 representa y apoya al comercio y los servicios de Lara, Venezuela.'],
  'nosotros.html': ['/nosotros', `Nosotros | ${SITE}`,
    'Conoce la historia, misión y junta directiva de la Cámara de Comercio del Estado Lara, fundada en marzo de 1901.'],
  'afiliarse.html': ['/afiliarse', `Afíliate | ${SITE}`,
    'Afilia tu empresa a la Cámara de Comercio del Estado Lara y accede a beneficios, formación y representación gremial.'],
  'recursos.html': ['/recursos', `Recursos | ${SITE}`,
    'Documentos, formatos y recursos para afiliados de la Cámara de Comercio del Estado Lara.'],
  'contactanos.html': ['/contactanos', `Contáctanos | ${SITE}`,
    'Escríbenos o visítanos: datos de contacto, ubicación y formulario de la Cámara de Comercio del Estado Lara.'],
  'log-in/registrarse.html': ['/log-in/registrarse', `Registrarse | ${SITE}`,
    'Regístrate en la Cámara de Comercio del Estado Lara.'],
};

// Remove an element (by id) with all its children; Framer's markup has no unclosed <div>s.
function removeElementById(html, id) {
  const start = html.indexOf(`<div id="${id}"`);
  if (start < 0) return html;
  const tag = /<\/?div\b[^>]*>/g;
  tag.lastIndex = start;
  let depth = 0, m;
  while ((m = tag.exec(html))) {
    depth += m[0][1] === '/' ? -1 : 1;
    if (depth === 0) return html.slice(0, start) + html.slice(tag.lastIndex);
  }
  throw new Error('unbalanced <div id="' + id + '">');
}

const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function patchHtml(html, [route, title, desc]) {
  const url = ORIGIN + route;
  html = html
    .replace(/https:\/\/camaradecomerciolara\.framer\.website[^"]*/g, url)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta (?:name|property)="(?:og:|twitter:)?title" content=")[^"]*"/g, `$1${esc(title)}"`)
    .replace(/(<meta (?:name|property)="(?:og:|twitter:)?description" content=")[^"]*"/g, `$1${esc(desc)}"`);

  // "Made in Framer" badge: its own React root, hydrated from script_main (patched below)
  html = removeElementById(html, '__framer-badge-container');

  // icons, og:image and form endpoint: inject once, right after og:type
  html = html.replace(/\n?<!-- ccl:head -->[\s\S]*?<!-- \/ccl:head -->/, '');
  const head = [
    '<!-- ccl:head -->',
    '<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">',
    `<meta property="og:image" content="${ORIGIN}/assets/og-image.png">`,
    `<meta name="twitter:image" content="${ORIGIN}/assets/og-image.png">`,
    `<meta property="og:site_name" content="${SITE}">`,
    '<meta property="og:locale" content="es_VE">',
    `<script>window.CCL_FORM_ENDPOINT=${JSON.stringify(FORM_ENDPOINT)}</script>`,
    '<!-- /ccl:head -->',
  ].join('\n');
  return html.replace(/(<meta property="og:type"[^>]*>)/, `$1\n${head}`);
}

// Framer forms on this site have no `action`, so submit is a no-op. Fall back to
// window.CCL_FORM_ENDPOINT and post plain FormData there (no Framer proof-of-work).
function patchFramerRuntime(js) {
  const guard = 'if(!e||!D||k.current)return;';
  if (js.includes(guard)) js = js.replace(guard, 'if(e||(e=globalThis.CCL_FORM_ENDPOINT),!e||k.current)return;');
  const submit = 'async function _f(e,t,n,r){';
  if (js.includes(submit) && !js.includes('CCL_FORM_ENDPOINT){')) {
    js = js.replace(submit, submit +
      // honeypot filled (__framer_2 = filled count) -> pretend success, send nothing
      'if(e===globalThis.CCL_FORM_ENDPOINT){if(+t.get(`__framer_2`)>0)return{ok:!0};' +
      'for(let k of[...t.keys()])k.startsWith(`__framer`)&&t.delete(k);' +
      't.set(`_subject`,`Formulario web: `+document.title);t.set(`_pagina`,location.href);' +
      'let o=await fetch(e,{body:t,method:`POST`,headers:{Accept:`application/json`}});' +
      'if(o.ok)return o;throw Error(`Failed to submit form (${o.status})`)}');
  }
  return js;
}

// Framer re-applies each page's title/description after hydration and on client-side
// navigation from a small per-page module; hard-code ours there too.
function patchPageMeta(js, [, title, desc]) {
  return js
    .replace(/description:\w+\(e,n\)\.description,/, `description:${JSON.stringify(desc)},`)
    .replace(/title:(?:\w+\(e,n\)\.title\|\|)?`[^`]*`,viewport:/, `title:${JSON.stringify(title)},viewport:`);
}

for (const [file, meta] of Object.entries(PAGES)) {
  const f = path.join(root, file);
  await fs.writeFile(f, patchHtml(await fs.readFile(f, 'utf8'), meta));
}

const sitesDir = path.join(root, 'assets/fu/sites');
for (const site of await fs.readdir(sitesDir)) {
  const dir = path.join(sitesDir, site);
  const names = await fs.readdir(dir);
  const patchFile = async (name, patch, marker) => {
    const f = path.join(dir, name);
    const before = await fs.readFile(f, 'utf8');
    const after = patch(before);
    if (!after.includes(marker)) throw new Error('patch did not apply to ' + f);
    if (after !== before) await fs.writeFile(f, after);
  };
  for (const name of names.filter(n => /^framer\..*\.mjs$/.test(n))) {
    await patchFile(name, patchFramerRuntime, 'CCL_FORM_ENDPOINT');
  }
  for (const name of names.filter(n => /^script_main\..*\.mjs$/.test(n))) {
    await patchFile(name, js => js.replace(
      /Z&&i\(\(\)=>\{v\(document\.getElementById\(`__framer-badge-container`\),[^;]*?import\(`[^`]*`\)\)\)\)\)\}\)/,
      'void 0/*ccl:no-badge*/'), 'ccl:no-badge');
  }
  // page metadata modules import shared-lib's metadata helper; the page HTML that
  // preloads one tells us which route it belongs to
  for (const name of names.filter(n => n.endsWith('.mjs'))) {
    const js = await fs.readFile(path.join(dir, name), 'utf8');
    if (!/serializationId:`framer-/.test(js) || !/^import\{[^}]*\}from"\.\/shared-lib\./m.test(js.split(';')[1] + ';')) continue;
    for (const [file, meta] of Object.entries(PAGES)) {
      if ((await fs.readFile(path.join(root, file), 'utf8')).includes(name)) {
        await patchFile(name, js => patchPageMeta(js, meta), `title:${JSON.stringify(meta[1])},viewport:`);
      }
    }
  }
}

// GitHub Pages: custom domain, crawler files
await fs.writeFile(path.join(root, 'CNAME'), DOMAIN + '\n');
await fs.writeFile(path.join(root, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
await fs.writeFile(path.join(root, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  Object.values(PAGES).map(([r]) => `  <url><loc>${ORIGIN}${r}</loc></url>\n`).join('') +
  '</urlset>\n');
console.log('postprocess ok');
