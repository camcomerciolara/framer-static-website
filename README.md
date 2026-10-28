# Cámara de Comercio del Estado Lara — sitio estático

Copia estática (HTML + CSS + JS) del sitio publicado en Framer:
https://camaradecomerciolara.framer.website/

Todo se sirve desde este repo: páginas, imágenes, fuentes, módulos JS e íconos.
Las únicas dependencias externas son Formspree (formularios) y el mapa de Google en *Contáctanos*.

## Estructura

| Ruta pública            | Archivo                     |
|-------------------------|-----------------------------|
| `/`                     | `index.html`                |
| `/nosotros`             | `nosotros.html`             |
| `/afiliarse`            | `afiliarse.html`            |
| `/recursos`             | `recursos.html`             |
| `/contactanos`          | `contactanos.html`          |
| `/log-in/registrarse`   | `log-in/registrarse.html`   |

- `assets/fu/` — contenido de `framerusercontent.com` (imágenes, fuentes, bundles `.mjs`)
- `assets/gfonts/` — fuentes de Google
- `assets/fm/` — módulos de íconos (Phosphor, Material, Feather, Hero)
- `assets/editorbar-stub.mjs` — reemplazo vacío de la barra de edición de Framer
- `tools/` — script usado para generar la copia (`mirror.mjs`) y servidor local de prueba

## Despliegue (GitHub Pages)

Se publica desde la rama `main`, carpeta raíz (Settings → Pages → *Deploy from a branch*),
con dominio propio **camcomerciolara.org.ve** (archivo `CNAME`). `.nojekyll` evita que Jekyll
procese los archivos, y GitHub Pages sirve `/nosotros` → `nosotros.html` automáticamente.

Las rutas de assets son **absolutas desde la raíz** (`/assets/...`), por eso el sitio necesita
el dominio propio: no funciona en `camcomerciolara.github.io/framer-static-website/`.

DNS en el proveedor del dominio:

| Tipo  | Nombre | Valor                                                              |
|-------|--------|--------------------------------------------------------------------|
| A     | `@`    | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` |
| CNAME | `www`  | `camcomerciolara.github.io`                                        |

Cuando el certificado esté emitido, activar *Enforce HTTPS* en Settings → Pages.

## Probar localmente

```bash
python3 tools/serve.py "$PWD"   # http://127.0.0.1:8080
```

## Regenerar desde Framer

```bash
EXTRA=tools/extra-urls.txt node tools/mirror.mjs https://camaradecomerciolara.framer.website out \
  "" nosotros afiliarse recursos contactanos log-in/registrarse
node tools/postprocess.mjs out
```

`tools/postprocess.mjs` aplica los ajustes propios del sitio y se puede ejecutar varias veces:

- dominio en `canonical` / `og:url`, títulos y descripciones por página, favicon e imagen para redes;
- `CNAME`, `robots.txt` y `sitemap.xml`;
- **formularios**: los formularios de Framer no tienen destino, así que el script parchea el runtime
  (`assets/fu/sites/*/framer.*.mjs`) para enviarlos a Formspree. `FORM_ENDPOINTS` define el
  formulario de Formspree por ruta (*Afiliarse* tiene el suyo; el resto usa el de `""`). Los campos
  trampa (honeypot) se descartan y los envíos de bots no se mandan. El asunto del correo es
  `Formulario web: <título de la página>`;
- `FORM_FIELDS` corrige los nombres de campo genéricos de la plantilla de Framer (en *Afiliarse*:
  `Nombre comercial`, `Teléfono`, `RIF`), que son los que aparecen en Formspree.

Para cambiar dominio, endpoint o textos, editar las constantes al inicio del script y volver a ejecutarlo.

## Notas

- Se eliminó el script de analítica de Framer (`events.framer.com`).
