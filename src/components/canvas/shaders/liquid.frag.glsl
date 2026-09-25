precision highp float;

varying vec2 vUv;

uniform float     uTime;
uniform vec2      uResolution;
uniform vec2      uMouse;        // en espacio UV (0..1)
uniform float     uMouseActive;  // 0..1, suavizado al entrar/salir el puntero
uniform float     uScroll;       // 0..1, progreso del hero
uniform float     uReveal;       // 0..1, animacion de entrada
uniform float     uAspect;
uniform sampler2D uText;

/* ------------------------------------------------------------------ ruido */

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i),                  hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = ROT * p * 2.02;
    a *= 0.5;
  }
  return v;
}

/* ----------------------------------------------- campo de altura (metal) */

float surface(vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  float t = uTime;

  // Domain warping: deformamos las coordenadas con ruido antes de volver a
  // muestrear. Es lo que separa una ondulacion liquida de una textura de ruido.
  vec2 warp = vec2(fbm(p * 0.9 + vec2(t * 0.030, 0.0)),
                   fbm(p * 0.9 + vec2(5.2, t * 0.024)));

  // Amplitudes bajas a proposito: el metal tiene que leerse pulido. Subirlas
  // lo convierte en papel de aluminio arrugado.
  float flow   = fbm(p * 1.10 + warp * 1.6);
  float ripple = fbm(p * 2.60 + warp * 0.8 - vec2(t * 0.045, 0.0));
  float h = flow * 0.150 + ripple * 0.045;

  // El nombre va esculpido EN la superficie, no dibujado encima.
  h += texture2D(uText, uv).a * 0.55 * uReveal;

  // Estela del cursor: onda expansiva + hundido local.
  float d = distance(p, (uMouse - 0.5) * vec2(uAspect, 1.0));
  h += uMouseActive * 0.075 * sin(d * 14.0 - t * 4.0) * exp(-d * 4.0);
  h -= uMouseActive * 0.090 * exp(-d * 7.0);

  return h;
}

// Normal por diferencias finitas sobre el campo de altura.
vec3 getNormal(vec2 uv) {
  vec2 e = 1.4 / uResolution;
  float l = surface(uv - vec2(e.x, 0.0));
  float r = surface(uv + vec2(e.x, 0.0));
  float d = surface(uv - vec2(0.0, e.y));
  float u = surface(uv + vec2(0.0, e.y));
  return normalize(vec3((l - r) * 90.0, (d - u) * 90.0, 1.0));
}

/* ------------------------------------------- entorno de estudio procedural */

vec3 studio(vec3 r) {
  float y = r.y * 0.5 + 0.5;
  vec3 base = mix(vec3(0.008, 0.010, 0.016),
                  vec3(0.180, 0.200, 0.255),
                  smoothstep(0.25, 1.0, y));

  // Softbox cenital: el reflejo que hace que lea como metal pulido.
  base += smoothstep(0.55, 0.98, r.y) * vec3(0.95, 0.98, 1.06);

  // Rebote frio (izquierda) y violeta (derecha). Son ACENTOS: en cuanto suben
  // de ~0.5 la escena deja de parecer cromo y parece plastico tintado.
  base += pow(max(dot(r, normalize(vec3(-0.75, 0.15, 0.55))), 0.0), 16.0) * vec3(0.20, 0.72, 0.95) * 0.45;
  base += pow(max(dot(r, normalize(vec3( 0.80, -0.20, 0.50))), 0.0), 14.0) * vec3(0.55, 0.33, 0.95) * 0.32;

  // Horizonte: los filamentos blancos que recorren la superficie salen de
  // aqui. Mas estrecho = mas moteado; mas intenso = sucio.
  base += smoothstep(0.030, 0.0, abs(r.y + 0.04)) * vec3(0.26);

  return base;
}

void main() {
  vec2 uv = vUv;
  vec2 p  = (uv - 0.5) * vec2(uAspect, 1.0);

  vec3 n    = getNormal(uv);
  vec3 view = normalize(vec3(p * 0.85, -1.0));

  // Aberracion cromatica en la reflexion: el truco que vende el cromo.
  const float DISP = 0.020;
  vec3 col;
  col.r = studio(reflect(view, normalize(n + vec3( DISP, 0.0, 0.0)))).r;
  col.g = studio(reflect(view, n)).g;
  col.b = studio(reflect(view, normalize(n + vec3(-DISP, 0.0, 0.0)))).b;

  // Fresnel: los bordes inclinados brillan mas.
  col += pow(1.0 - max(n.z, 0.0), 3.5) * vec3(0.35, 0.45, 0.60);

  // Realce sutil del relieve del nombre.
  col += texture2D(uText, uv).a * uReveal * vec3(0.06, 0.07, 0.10);

  // Viñeta.
  col *= mix(0.45, 1.0, smoothstep(1.25, 0.25, length(p)));

  // El scroll funde el hero a negro para entregar el paso a la seccion.
  col *= 1.0 - smoothstep(0.0, 0.85, uScroll);

  // Grano: rompe el banding del degradado, muy visible en pantallas OLED.
  col += (hash21(uv * uResolution + fract(uTime) * 100.0) - 0.5) * 0.020;

  // Tonemap ACES aproximado + codificacion sRGB (ShaderMaterial no la aplica).
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));

  gl_FragColor = vec4(col, 1.0);
}
