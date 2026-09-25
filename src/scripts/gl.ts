const VERTEX_SOURCE = `
// Triangulo unico que cubre la pantalla: mas barato que un quad de dos
// triangulos, sin costura diagonal y con una invocacion de vertice menos.
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export interface QuadOptions {
  /** Tope de densidad de pixeles. Bajarlo es la palanca mas efectiva de rendimiento. */
  maxDpr?: number;
  /** Uniforms propios del efecto, ademas de los comunes. */
  extraUniforms?: readonly string[];
  /** Se llama cada frame justo antes del draw, para subir los uniforms propios. */
  onFrame?: (renderer: QuadRenderer, dt: number) => void;
  /** Segundos que tarda uReveal en ir de 0 a 1. */
  revealDuration?: number;
}

export interface QuadRenderer {
  gl: WebGLRenderingContext;
  /** Localizacion de un uniform, o null si el compilador lo elimino por no usarse. */
  at: (name: string) => WebGLUniformLocation | null;
  state: {
    time: number;
    reveal: number;
    mouseX: number;
    mouseY: number;
    mouseActive: number;
    scroll: number;
  };
  destroy: () => void;
}

const COMMON_UNIFORMS = [
  'uTime',
  'uResolution',
  'uMouse',
  'uMouseActive',
  'uScroll',
  'uReveal',
  'uAspect',
] as const;

function compile(gl: WebGLRenderingContext, type: number, source: string, label: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(`[gl] ${label}:`, gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * Monta un fragment shader a pantalla completa sobre un canvas y se encarga de
 * todo lo aburrido: contexto, compilacion, redimensionado, seguimiento del
 * cursor y del scroll con amortiguacion, y pausa del bucle cuando el canvas
 * sale de pantalla o la pestaña pasa a segundo plano.
 *
 * Devuelve null si no hay WebGL, para que quien llame deje a la vista su
 * alternativa sin JavaScript.
 */
export function mountQuad(
  canvas: HTMLCanvasElement,
  fragmentSource: string,
  options: QuadOptions = {},
): QuadRenderer | null {
  const { maxDpr = 1.75, extraUniforms = [], onFrame, revealDuration = 1.4 } = options;

  const gl = (canvas.getContext('webgl2', { antialias: false, alpha: false }) ??
    canvas.getContext('webgl', { antialias: false, alpha: false })) as WebGLRenderingContext | null;
  if (!gl) return null;

  const vertexShader = compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE, 'vertex');
  const fragmentShader = compile(gl, gl.FRAGMENT_SHADER, fragmentSource, 'fragment');
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[gl] link:', gl.getProgramInfoLog(program));
    return null;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const aPosition = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  const locations = new Map<string, WebGLUniformLocation | null>();
  for (const name of [...COMMON_UNIFORMS, ...extraUniforms]) {
    locations.set(name, gl.getUniformLocation(program, name));
  }
  const at = (name: string) => locations.get(name) ?? null;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const state = {
    time: reducedMotion.matches ? 8 : 0,
    reveal: reducedMotion.matches ? 1 : 0,
    mouseX: 0.5,
    mouseY: 0.5,
    mouseActive: 0,
    scroll: 0,
  };
  const target = { mouseX: 0.5, mouseY: 0.5, mouseActive: 0, scroll: 0 };

  const onPointerMove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    target.mouseX = (event.clientX - rect.left) / rect.width;
    // El shader trabaja en UV con origen abajo; el DOM al reves.
    target.mouseY = 1 - (event.clientY - rect.top) / rect.height;
    target.mouseActive = 1;
  };
  const onPointerLeave = () => {
    target.mouseActive = 0;
  };
  const onScroll = () => {
    const rect = canvas.getBoundingClientRect();
    target.scroll = Math.min(Math.max(-rect.top / Math.max(rect.height, 1), 0), 1);
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerleave', onPointerLeave);
  window.addEventListener('scroll', onScroll, { passive: true });

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    if (canvas.width === w && canvas.height === h) return;

    canvas.width = w;
    canvas.height = h;
    gl!.viewport(0, 0, w, h);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  let onScreen = true;
  const intersectionObserver = new IntersectionObserver(
    ([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) start();
    },
    { threshold: 0 },
  );
  intersectionObserver.observe(canvas);

  const onVisibility = () => {
    if (!document.hidden) start();
  };
  document.addEventListener('visibilitychange', onVisibility);

  let frame = 0;
  let last = performance.now();
  const renderer: QuadRenderer = { gl, at, state, destroy };

  function render(now: number) {
    frame = 0;
    if (!onScreen || document.hidden) return;

    // Limitamos delta: una pestaña que vuelve de segundo plano pegaria un
    // salto de varios segundos en la animacion.
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;

    if (!reducedMotion.matches) {
      state.time += dt;
      if (state.reveal < 1) state.reveal = Math.min(1, state.reveal + dt / revealDuration);
    }

    // Amortiguacion exponencial, independiente del framerate.
    const follow = 1 - Math.pow(0.0015, dt);
    state.mouseX += (target.mouseX - state.mouseX) * follow;
    state.mouseY += (target.mouseY - state.mouseY) * follow;
    state.mouseActive += (target.mouseActive - state.mouseActive) * (1 - Math.pow(0.05, dt));
    state.scroll += (target.scroll - state.scroll) * (1 - Math.pow(0.02, dt));

    gl!.uniform1f(at('uTime'), state.time);
    gl!.uniform2f(at('uResolution'), canvas.width, canvas.height);
    gl!.uniform2f(at('uMouse'), state.mouseX, state.mouseY);
    gl!.uniform1f(at('uMouseActive'), state.mouseActive);
    gl!.uniform1f(at('uScroll'), state.scroll);
    gl!.uniform1f(at('uReveal'), state.reveal);
    gl!.uniform1f(at('uAspect'), canvas.width / Math.max(canvas.height, 1));

    onFrame?.(renderer, dt);

    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    frame = requestAnimationFrame(render);
  }

  function start() {
    if (frame !== 0) return;
    last = performance.now();
    frame = requestAnimationFrame(render);
  }

  function destroy() {
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerleave', onPointerLeave);
    window.removeEventListener('scroll', onScroll);
    gl!.deleteBuffer(buffer);
    gl!.deleteProgram(program);
    gl!.deleteShader(vertexShader!);
    gl!.deleteShader(fragmentShader!);
  }

  resize();
  onScroll();
  start();

  return renderer;
}
