precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec2  uResolution;   // en pixeles de dispositivo
uniform vec2  uMouse;        // en espacio UV (0..1)
uniform float uMouseActive;
uniform float uReveal;
uniform float uDotSize;      // lado de la celda de trama, en pixeles
uniform float uAspect;

/* ------------------------------------------------------------- geometria */

float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

mat3 rotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}

mat3 rotX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
}

// La forma va de cubo a esfera y vuelve. Sin textura, sin ruido: geometria
// pura, que es lo que pide una estetica de instrumento.
float map(vec3 p) {
  p = rotX(uTime * 0.13) * rotY(uTime * 0.21) * p;

  // Tope en 0.7: el cubo perfecto visto de frente es una cara plana, con
  // normal constante y por tanto sin gradiente que tramar. Dejando siempre
  // algo de esfera, la curvatura nunca desaparece.
  float morph = 0.35 + 0.35 * sin(uTime * 0.25);
  float sphere = sdSphere(p, 1.00);
  float box = sdBox(p, vec3(0.70)) - 0.06;

  return mix(sphere, box, morph);
}

vec3 calcNormal(vec3 p) {
  // Truco del tetraedro: 4 muestras en vez de 6.
  const vec2 k = vec2(1.0, -1.0);
  const float h = 0.0012;
  return normalize(
    k.xyy * map(p + k.xyy * h) +
    k.yyx * map(p + k.yyx * h) +
    k.yxy * map(p + k.yxy * h) +
    k.xxx * map(p + k.xxx * h)
  );
}

float march(vec3 ro, vec3 rd) {
  float t = 0.0;
  for (int i = 0; i < 64; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < 0.0008 * t || t > 8.0) break;
    t += d;
  }
  return t;
}

/* ---------------------------------------------------------------- trama */

// Bayer 8x8 sin textura: dos niveles de anidamiento sobre una matriz 2x2.
float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x * 0.5 + a.y * a.y * 0.75);
}

float bayer8(vec2 a) {
  float b2 = bayer2(a);
  float b4 = bayer2(a * 0.5) * 0.25 + b2;
  return bayer2(a * 0.25) * 0.0625 + b4 * 0.25;
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);

  // --- escena continua en escala de grises ---
  vec3 ro = vec3(0.0, 0.0, 3.2);
  vec3 rd = normalize(vec3(p * 1.25, -1.0));

  float t = march(ro, rd);
  float lum = 0.0;

  if (t < 8.0) {
    vec3 pos = ro + rd * t;
    vec3 n = calcNormal(pos);

    // Luz PUNTUAL, no direccional. Con una direccional, una cara plana recibe
    // luminancia constante y la trama no tiene gradiente que tramar: sale un
    // recorte blanco solido. La caida con la distancia es lo que genera el
    // degradado sobre el que el dither dibuja.
    // Luz cercana y caida agresiva: es lo que reparte la luminancia por todo
    // el rango 0..1 en vez de saturarla a blanco.
    vec3 lightPos = vec3(-1.45, 1.75, 1.95);
    vec3 ld = lightPos - pos;
    float dist = length(ld);
    ld /= dist;

    float diffuse = max(dot(n, ld), 0.0);
    float falloff = 1.0 / (1.0 + 0.55 * dist * dist);
    lum = diffuse * falloff * 3.0;

    // Relleno tenue desde el lado opuesto: evita negros absolutos que cortan
    // la silueta de golpe.
    lum += 0.10 * max(dot(n, normalize(vec3(0.9, -0.3, 0.5))), 0.0);

    // Especular estrecho: el punto de luz que remata la sensacion de volumen.
    lum += 0.55 * pow(max(dot(reflect(-ld, n), -rd), 0.0), 36.0);

    // Curva de respuesta: sube los medios para que la trama tenga densidad.
    lum = pow(clamp(lum, 0.0, 1.0), 0.80);
  }

  // Aparicion desde el centro hacia fuera.
  lum *= smoothstep(0.0, 0.6, uReveal - length(p) * 0.18);

  // --- trama ---
  // La celda se fija en pixeles de dispositivo: los puntos miden lo mismo en
  // cualquier pantalla en lugar de encogerse en las de alta densidad.
  vec2 cell = gl_FragCoord.xy / max(uDotSize, 1.0);

  // Desplazamiento de medio escalon. Sin el, la celda cuyo umbral vale 0 se
  // enciende incluso con luminancia 0 y el fondo negro sale punteado.
  float threshold = (bayer8(cell) * 63.0 + 0.5) / 64.0;

  float dithered = step(threshold, lum);

  // Cerca del cursor la trama se disuelve y deja ver el gris continuo: el
  // visitante descubre que debajo hay una escena 3D de verdad.
  float d = distance(p, (uMouse - 0.5) * vec2(uAspect, 1.0));
  float resolve = uMouseActive * smoothstep(0.42, 0.06, d);
  float value = mix(dithered, lum, resolve);

  gl_FragColor = vec4(vec3(value), 1.0);
}
