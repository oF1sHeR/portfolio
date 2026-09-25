precision highp float;

varying vec2 vUv;

uniform float     uTime;
uniform vec2      uResolution;
uniform vec2      uMouse;
uniform float     uMouseActive;
uniform float     uScroll;
uniform float     uReveal;
uniform float     uAspect;

uniform sampler2D uImage;
uniform float     uImageAspect;
uniform float     uParallax;
uniform float     uFocusY;      // encuadre vertical: 0 abajo, 0.5 centro, 1 arriba

/* --------------------------------------------------------------- utiles */

// Encaje "cover": rellena el canvas recortando el sobrante, igual que
// background-size: cover, pero en espacio de textura.
vec2 coverUv(vec2 uv, float canvasAspect, float imageAspect, float focusY) {
  vec2 scale = canvasAspect > imageAspect
    ? vec2(1.0, imageAspect / canvasAspect)
    : vec2(canvasAspect / imageAspect, 1.0);
  // El anclaje vertical decide que parte se conserva al recortar: con un
  // retrato, centrar suele cortar la coronilla.
  vec2 anchor = vec2(0.5, mix(1.0, 0.0, focusY));
  return (uv - anchor) * scale + anchor;
}

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 uv = vUv;

  // Desplazamiento del puntero, amortiguado y centrado. El eje Y se invierte
  // para que la figura siga al cursor en lugar de huir de el.
  vec2 offset = (uMouse - 0.5) * vec2(1.0, -1.0) * uParallax * uMouseActive;

  vec2 base = coverUv(uv, uAspect, uImageAspect, uFocusY);

  // Primera lectura sin desplazar: necesitamos saber que hay figura antes de
  // decidir cuanto desplazar ese pixel.
  vec4 probe = texture2D(uImage, base);

  // Proxy de profundidad. El alfa separa figura de fondo, que es la diferencia
  // que mas se nota al mover el raton; dentro de la figura, las zonas
  // iluminadas se leen como mas cercanas. No es un mapa de profundidad real,
  // pero para un retrato el ojo lo compra.
  float depth = probe.a * (0.40 + 0.60 * luma(probe.rgb));

  // El fondo se mueve al contrario que la figura: ahi nace la sensacion de
  // volumen.
  vec2 uvImage = base - offset * (depth * 1.35 - 0.35);
  vec4 tex = texture2D(uImage, uvImage);

  float value = luma(tex.rgb);

  // Gradacion: contraste alto y desaturado, coherente con el resto del sitio.
  value = clamp((value - 0.5) * 1.22 + 0.48, 0.0, 1.0);
  vec3 color = vec3(value);

  // Luz de contorno. La derivada del alfa marca el borde de la figura; teñirlo
  // con el color de acento separa el retrato del negro sin recortarlo a
  // tijera.
  vec2 px = 2.2 / uResolution;
  float edge =
    abs(texture2D(uImage, uvImage + vec2(px.x, 0.0)).a - texture2D(uImage, uvImage - vec2(px.x, 0.0)).a) +
    abs(texture2D(uImage, uvImage + vec2(0.0, px.y)).a - texture2D(uImage, uvImage - vec2(0.0, px.y)).a);
  color += smoothstep(0.15, 0.9, edge) * vec3(0.00, 0.85, 0.55) * 0.75;

  // Recorte contra el fondo negro.
  float mask = smoothstep(0.02, 0.5, tex.a);

  // Entrada: barrido de abajo arriba.
  float sweep = smoothstep(0.0, 0.75, uReveal * 1.9 - (1.0 - uv.y));
  mask *= sweep;

  // Al bajar, el retrato se desvanece y cede el turno a la seccion siguiente.
  mask *= 1.0 - smoothstep(0.25, 0.95, uScroll);

  // Grano fino: rompe el banding de los degradados sobre negro.
  color += (hash21(uv * uResolution + fract(uTime) * 100.0) - 0.5) * 0.022;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0) * mask, 1.0);
}
