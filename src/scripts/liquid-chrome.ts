import vertexSource from '../components/canvas/shaders/liquid.vert.glsl?raw';
import fragmentSource from '../components/canvas/shaders/liquid.frag.glsl?raw';

const NAME_LINES = ['RARES', 'VASILE'];
const SUBTITLE = 'DESARROLLADOR WEB';
const MAX_DPR = 1.75;

/**
 * Dibuja el nombre en un canvas 2D. Su canal alfa alimenta el campo de altura
 * del shader, asi que el texto queda esculpido EN el metal en lugar de pintado
 * encima. Las tres pasadas con desenfoque decreciente forman el bisel: sin
 * ellas el relieve sale con cantos de sierra.
 */
function drawNameField(canvas: HTMLCanvasElement, width: number, height: number) {
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);

  const font = (px: number) => `800 ${px}px "Inter Variable", Inter, system-ui, sans-serif`;

  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) return;

  // Ajuste tipografico: medimos a 100px y escalamos al ancho objetivo.
  measure.font = font(100);
  const widest = Math.max(...NAME_LINES.map((line) => measure.measureText(line).width));
  const size = Math.min(((width * 0.82) / widest) * 100, height * 0.26);

  const lineHeight = size * 0.92;
  const blockTop = height * 0.5 - (lineHeight * (NAME_LINES.length - 1)) / 2 - size * 0.12;
  const subSize = Math.max(size * 0.085, 11);

  const setTracking = (target: CanvasRenderingContext2D, value: number) => {
    // letterSpacing no existe en navegadores antiguos; no es critico.
    try {
      target.letterSpacing = `${value}px`;
    } catch {
      /* ignorado a proposito */
    }
  };

  /**
   * Estampa un bloque de texto en relieve. El bisel sale de desenfocar el
   * bitmap entero con drawImage, no cada glifo: aplicar `filter` a `fillText`
   * deja marcado el rectangulo del bounding box en el campo de altura.
   *
   * `feather` va atado al cuerpo tipografico del bloque. Compartir un feather
   * global entre el nombre y el subtitulo hunde al pequeño bajo el bisel del
   * grande y lo vuelve ilegible.
   */
  const emboss = (
    paint: (layer: CanvasRenderingContext2D) => void,
    feather: number,
    peak: number,
  ) => {
    const layer = document.createElement('canvas');
    layer.width = width;
    layer.height = height;

    const lctx = layer.getContext('2d');
    if (!lctx) return;

    lctx.textAlign = 'center';
    lctx.textBaseline = 'middle';
    lctx.fillStyle = '#ffffff';
    paint(lctx);

    // Blur decreciente: hombros anchos y meseta plana. La pasada "nitida"
    // conserva un desenfoque minimo porque una transicion de 0 a 1 en un solo
    // pixel vuelve vertical la normal del shader y dentaria los cantos.
    const passes = [
      { blur: feather * 0.05, alpha: 0.45 },
      { blur: feather * 0.018, alpha: 0.7 },
      { blur: feather * 0.008, alpha: 1 },
    ];

    for (const pass of passes) {
      ctx.filter = `blur(${Math.max(pass.blur, 0.5)}px)`;
      ctx.globalAlpha = pass.alpha * peak;
      ctx.drawImage(layer, 0, 0);
    }
  };

  emboss(
    (layer) => {
      layer.font = font(size);
      setTracking(layer, -size * 0.02);
      NAME_LINES.forEach((line, index) => {
        layer.fillText(line, width * 0.5, blockTop + index * lineHeight);
      });
    },
    size,
    1,
  );

  // El subtitulo va en relieve mas bajo para no competir con el nombre.
  emboss(
    (layer) => {
      layer.font = font(subSize);
      setTracking(layer, subSize * 0.42);
      layer.fillText(
        SUBTITLE,
        width * 0.5,
        blockTop + NAME_LINES.length * lineHeight + subSize * 1.4,
      );
    },
    subSize,
    0.45,
  );

  ctx.filter = 'none';
  ctx.globalAlpha = 1;
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('[liquid-chrome] shader:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function mountLiquidChrome(canvas: HTMLCanvasElement) {
  const gl = (canvas.getContext('webgl2', { antialias: false, alpha: false }) ??
    canvas.getContext('webgl', { antialias: false, alpha: false })) as WebGLRenderingContext | null;

  // Sin WebGL simplemente no montamos nada: debajo queda el degradado CSS.
  if (!gl) return () => {};

  const vertexShader = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) return () => {};

  const program = gl.createProgram();
  if (!program) return () => {};

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[liquid-chrome] link:', gl.getProgramInfoLog(program));
    return () => {};
  }
  gl.useProgram(program);

  // Geometria: un solo triangulo que desborda el viewport.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const aPosition = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  const u = {
    time: gl.getUniformLocation(program, 'uTime'),
    resolution: gl.getUniformLocation(program, 'uResolution'),
    mouse: gl.getUniformLocation(program, 'uMouse'),
    mouseActive: gl.getUniformLocation(program, 'uMouseActive'),
    scroll: gl.getUniformLocation(program, 'uScroll'),
    reveal: gl.getUniformLocation(program, 'uReveal'),
    aspect: gl.getUniformLocation(program, 'uAspect'),
    text: gl.getUniformLocation(program, 'uText'),
  };

  // Textura del nombre.
  const textCanvas = document.createElement('canvas');
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.uniform1i(u.text, 0);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const state = {
    time: reducedMotion.matches ? 12 : 0,
    reveal: reducedMotion.matches ? 1 : 0,
    mouseX: 0.5,
    mouseY: 0.5,
    mouseActive: 0,
    scroll: 0,
    width: 0,
    height: 0,
  };
  const target = { mouseX: 0.5, mouseY: 0.5, mouseActive: 0, scroll: 0 };

  let fontsReady = false;
  document.fonts?.ready.then(() => {
    fontsReady = true;
    uploadText();
  });

  function uploadText() {
    if (state.width === 0 || state.height === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    drawNameField(textCanvas, Math.round(state.width * dpr), Math.round(state.height * dpr));
    gl!.bindTexture(gl!.TEXTURE_2D, texture);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, textCanvas);
  }

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const next = { w: Math.round(width * dpr), h: Math.round(height * dpr) };
    if (canvas.width === next.w && canvas.height === next.h) return;

    canvas.width = next.w;
    canvas.height = next.h;
    state.width = width;
    state.height = height;

    gl!.viewport(0, 0, next.w, next.h);
    uploadText();
  }

  const onPointerMove = (event: PointerEvent) => {
    target.mouseX = event.clientX / window.innerWidth;
    // El shader trabaja en UV con origen abajo; el DOM al reves.
    target.mouseY = 1 - event.clientY / window.innerHeight;
    target.mouseActive = 1;
  };
  const onPointerLeave = () => {
    target.mouseActive = 0;
  };
  const onScroll = () => {
    target.scroll = Math.min(window.scrollY / window.innerHeight, 1);
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerleave', onPointerLeave);
  window.addEventListener('scroll', onScroll, { passive: true });

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  // Fuera de pantalla o en pestaña oculta no gastamos GPU: el hero es, con
  // diferencia, lo mas caro del sitio.
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

  function render(now: number) {
    frame = 0;
    if (!onScreen || document.hidden) return;

    // Limitamos delta: una pestaña que vuelve de background pegaria un salto
    // de varios segundos en la animacion.
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;

    if (!reducedMotion.matches) {
      state.time += dt;
      if (state.reveal < 1 && fontsReady) state.reveal = Math.min(1, state.reveal + dt / 1.8);
    }

    // Amortiguacion exponencial, independiente del framerate.
    const follow = 1 - Math.pow(0.0015, dt);
    state.mouseX += (target.mouseX - state.mouseX) * follow;
    state.mouseY += (target.mouseY - state.mouseY) * follow;
    state.mouseActive += (target.mouseActive - state.mouseActive) * (1 - Math.pow(0.05, dt));
    state.scroll += (target.scroll - state.scroll) * (1 - Math.pow(0.02, dt));

    gl!.uniform1f(u.time, state.time);
    gl!.uniform2f(u.resolution, canvas.width, canvas.height);
    gl!.uniform2f(u.mouse, state.mouseX, state.mouseY);
    gl!.uniform1f(u.mouseActive, state.mouseActive);
    gl!.uniform1f(u.scroll, state.scroll);
    gl!.uniform1f(u.reveal, state.reveal);
    gl!.uniform1f(u.aspect, canvas.width / Math.max(canvas.height, 1));

    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    frame = requestAnimationFrame(render);
  }

  function start() {
    if (frame !== 0) return;
    last = performance.now();
    frame = requestAnimationFrame(render);
  }

  resize();
  onScroll();
  start();

  return () => {
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerleave', onPointerLeave);
    window.removeEventListener('scroll', onScroll);
    gl!.deleteTexture(texture);
    gl!.deleteBuffer(buffer);
    gl!.deleteProgram(program);
    gl!.deleteShader(vertexShader!);
    gl!.deleteShader(fragmentShader!);
  };
}
