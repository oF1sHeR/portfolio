# Portfolio — Rares Vasile

Portfolio personal. La portada es una superficie de cromo líquido renderizada
en un único shader de pantalla completa: el nombre no está dibujado encima, está
esculpido en el campo de altura del metal.

🔗 **[rarestesting.es](https://rarestesting.es)**

## Stack

| Capa | Herramienta | Por qué |
|---|---|---|
| Framework | [Astro 7](https://astro.build) | Cero JS por defecto y salida estática pura |
| Estilos | [Tailwind v4](https://tailwindcss.com) | Motor Oxide, tokens definidos en CSS |
| Gráficos | WebGL2 + GLSL a pelo | El hero es un shader 2D: three.js habría sido 895 KB para dibujar un triángulo |
| Animación | [GSAP](https://gsap.com) + ScrollTrigger | Coreografía de scroll |
| Scroll | [Lenis](https://lenis.darkroom.engineering) | Inercia suave |
| UI interactiva | React 19 (islas Astro) | Reservado para el command palette |

## Peso en producción

| Recurso | Tamaño |
|---|---|
| Shader del hero | 9,4 KB |
| GSAP + ScrollTrigger + Lenis | 129 KB |
| CSS | 22 KB |
| HTML | 13 KB |

## Desarrollo

```bash
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # comprueba tipos y compila a dist/
pnpm preview    # sirve dist/ en local
```

Requiere Node 22+.

## Estructura

```
src/
├─ components/
│  ├─ canvas/shaders/   # GLSL del cromo líquido
│  ├─ sections/         # Hero, Perfil, Proyectos, Stack, Contacto
│  └─ ui/               # Primitivas compartidas
├─ data/                # Contenido: proyectos, skills, datos del sitio
├─ layouts/             # Layout base con SEO y scroll suave
├─ pages/               # Rutas
├─ scripts/             # liquid-chrome.ts (montaje WebGL)
└─ styles/              # Tokens de Tailwind y base
```

### Cómo funciona el hero

1. El nombre se rasteriza en un canvas 2D fuera de pantalla, en tres pasadas con
   desenfoque decreciente. Eso da un bisel con hombros suaves y meseta plana.
2. El canal alfa de ese canvas se sube a la GPU como textura y se suma al campo
   de altura del metal.
3. El fragment shader deriva la normal por diferencias finitas y refleja un
   entorno de estudio procedural, con aberración cromática por canal.
4. El cursor deforma el campo de altura; el scroll funde la escena a negro.

El bucle se para cuando el hero sale de pantalla o la pestaña pasa a segundo
plano, y respeta `prefers-reduced-motion`.

## Ramas

- `main` — producción. Cada push despliega a rarestesting.es.
- `develop` — integración.
- `feat/*`, `fix/*` — trabajo en curso, se fusionan en `develop`.

## Despliegue

GitHub Actions compila y sube solo `dist/` por SSH con `rsync`. El servidor no
necesita Node ni compilar nada.

Secrets necesarios en el repositorio (Settings → Secrets → Actions):

| Secret | Ejemplo | Descripción |
|---|---|---|
| `SSH_HOST` | `185.250.203.167` | IP o host del servidor |
| `SSH_USER` | `rarestesting` | Usuario de la suscripción Plesk |
| `SSH_PRIVATE_KEY` | `-----BEGIN OPENSSH...` | Clave privada dedicada al deploy |
| `SSH_PORT` | `22` | Opcional, por defecto 22 |
| `REMOTE_PATH` | `/var/www/vhosts/rarestesting.es/httpdocs/` | Docroot |

Mientras falte alguno, el workflow avisa y se salta el envío en lugar de fallar.

## Licencia

Código bajo MIT. El contenido, los textos y la identidad visual son propiedad de
Rares Vasile.
