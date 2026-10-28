// Apply site-specific fixes on top of the Framer mirror. Idempotent: safe to re-run.
// usage: node tools/postprocess.mjs [siteDir]
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.argv[2] || '.';
const DOMAIN = 'camcomerciolara.org.ve';
const ORIGIN = 'https://' + DOMAIN;
// Formspree endpoint by route; "" is the default for every other form
const FORM_ENDPOINTS = {
  '': 'https://formspree.io/f/xaeejrnl',
  '/afiliarse': 'https://formspree.io/f/mvkkrezz',
};
const SITE = 'Cámara de Comercio Lara';

// Framer's form template left generic input names ("Phone Number" holds the RIF), and
// those names are what Formspree shows. Inputs are matched by their unique placeholder
// (Framer's original, or the replacement once patched).
// placeholder -> [name, type, new placeholder?]
const FORM_FIELDS = {
  // afiliarse
  'Victoria Contreras': ['Nombre comercial', 'text', 'Inversiones Lara C.A.'],
  '+58 4121234567': ['Teléfono', 'tel'],
  'J-123456789': ['RIF', 'text'],
  // contactanos ("Juan Pérez" is the tablet variant of the same input)
  'Ej. Juan Pérez': ['Nombre', 'text'],
  'Juan Pérez': ['Nombre', 'text'],
  'Ej. +58 412-123-4567': ['Teléfono', 'tel'],
};
const fieldPatterns = () => Object.entries(FORM_FIELDS).map(([ph, [name, type, newPh = ph]]) =>
  ({ phs: [...new Set([ph, newPh])], name, type, newPh }));

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
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
    `<script>window.CCL_FORMS=${JSON.stringify(FORM_ENDPOINTS)}</script>`,
    '<!-- /ccl:head -->',
  ].join('\n');
  html = html.replace(/(<meta property="og:type"[^>]*>)/, `$1\n${head}`);

  for (const { phs, name, type, newPh } of fieldPatterns()) {
    const ph = phs.map(p => reEsc(esc(p))).join('|');
    html = html.replace(new RegExp(`<input [^>]*placeholder="(?:${ph})"[^>]*>`, 'g'), tag => tag
      .replace(/ name="[^"]*"/, ` name="${esc(name)}"`).replace(/ type="[^"]*"/, ` type="${type}"`)
      .replace(/ placeholder="[^"]*"/, ` placeholder="${esc(newPh)}"`));
  }
  return html;
}

function patchFormFields(js) {
  for (const { phs, name, type, newPh } of fieldPatterns()) {
    const ph = phs.map(reEsc).join('|');
    js = js
      .replace(new RegExp('inputName:`[^`]*`,placeholder:`(?:' + ph + ')`,required:!0,type:`[^`]*`', 'g'),
        `inputName:\`${name}\`,placeholder:\`${newPh}\`,required:!0,type:\`${type}\``)
      // breakpoint variants override only the placeholder
      .replace(new RegExp('placeholder:`(?:' + ph + ')`\\}', 'g'), `placeholder:\`${newPh}\`}`);
  }
  return js;
}

// Framer forms on this site have no `action`, so submit is a no-op. Fall back to the
// endpoint for the current route (window.CCL_FORMS, looked up at submit time because
// client-side navigation keeps the first page's globals) and post plain FormData
// there (no Framer proof-of-work).
function patchFramerRuntime(js) {
  const guard = 'if(!e||!D||k.current)return;';
  if (js.includes(guard)) js = js.replace(guard,
    'if(e||(e=globalThis.CCL_FORMS?.[location.pathname.replace(/\\.html$/,``)]||globalThis.CCL_FORMS?.[``]),!e||k.current)return;');
  const submit = 'async function _f(e,t,n,r){';
  if (js.includes(submit) && !js.includes('formspree')) {
    js = js.replace(submit, submit +
      // honeypot filled (__framer_2 = filled count) -> pretend success, send nothing
      'if(/^https:\\/\\/formspree\\.io\\//.test(e)){if(+t.get(`__framer_2`)>0)return{ok:!0};' +
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
    await patchFile(name, patchFramerRuntime, 'CCL_FORMS');
  }
  for (const name of names.filter(n => n.endsWith('.mjs'))) {
    const js = await fs.readFile(path.join(dir, name), 'utf8');
    const field = fieldPatterns().find(f => f.phs.some(p => js.includes('inputName:`') && js.includes('placeholder:`' + p + '`,required')));
    if (field) await patchFile(name, patchFormFields, `inputName:\`${field.name}\`,placeholder:\`${field.newPh}\``);
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
