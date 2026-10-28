# Cámara de Comercio del Estado Lara — sitio estático

Copia estática (HTML + CSS + JS) del sitio publicado en Framer:
https://camaradecomerciolara.framer.website/

Todo se sirve desde este repo: páginas, imágenes, fuentes, módulos JS e íconos.
La única dependencia externa es el mapa de Google embebido en *Contáctanos*.

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

## Despliegue

Las rutas de assets son **absolutas desde la raíz** (`/assets/...`), así que el sitio debe
servirse en la raíz de un dominio:

- **Cloudflare Pages** (recomendado): conectar el repo, sin comando de build, directorio de salida `/`.
  Sirve `/nosotros` → `nosotros.html` automáticamente.
- **GitHub Pages**: funciona solo con dominio propio (p. ej. `www.cclara.org`), no en
  `camcomerciolara.github.io/framer-static-website/`.

## Probar localmente

```bash
python3 tools/serve.py "$PWD"   # http://127.0.0.1:8080
```

## Regenerar desde Framer

```bash
EXTRA=tools/extra-urls.txt node tools/mirror.mjs https://camaradecomerciolara.framer.website out \
  "" nosotros afiliarse recursos contactanos log-in/registrarse
```

## Pendientes conocidos

- **Formularios** (Contáctanos, Afiliarse, Registrarse): en el sitio de Framer tampoco tienen
  destino configurado, así que no envían datos. Hace falta conectarlos a un backend
  (Cloudflare Worker, Formspree, o la API del SAC).
- Las etiquetas `canonical` / `og:url` siguen apuntando a `camaradecomerciolara.framer.website`;
  actualizarlas cuando exista el dominio definitivo.
- Se eliminó el script de analítica de Framer (`events.framer.com`).
