/**
 * Prepara el retrato de la cabecera a partir de una foto cualquiera.
 *
 *   node scripts/prepare-portrait.mjs ruta/a/tu-foto.jpg
 *
 * Genera en public/:
 *   retrato.webp           recorte con transparencia, que es lo que consume el shader
 *   retrato-original.webp  la foto entera, por si el recorte no convence
 *
 * Solo recorta el fondo, encuadra y redimensiona: NO retoca la imagen. Ningun
 * pixel dentro de la silueta se modifica.
 *
 * Todo ocurre en local. La primera ejecucion descarga el modelo U2-Net
 * (~176 MB, Apache 2.0) a .models/ y a partir de ahi no vuelve a tocar la red.
 * La foto no sale del equipo en ningun momento.
 */
import sharp from 'sharp';
import * as ort from 'onnxruntime-node';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

const PUBLIC_DIR = path.resolve('public');
const MODEL_DIR = path.resolve('.models');
const MODEL_PATH = path.join(MODEL_DIR, 'u2net.onnx');
const MODEL_URL = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx';

const SIZE = 320; // resolucion de entrada fija del modelo
const MAX_HEIGHT = 1800;
const PADDING = 0.025; // margen alrededor del sujeto, en fraccion del lado mayor

// Normalizacion de ImageNet, que es con la que se entreno U2-Net.
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

function fail(message) {
  console.error(`\n  x ${message}\n`);
  process.exit(1);
}

async function ensureModel() {
  if (existsSync(MODEL_PATH)) {
    const { size } = await stat(MODEL_PATH);
    if (size > 100_000_000) return;
    console.log('  El modelo guardado esta incompleto, lo descargo de nuevo.');
  }

  await mkdir(MODEL_DIR, { recursive: true });
  console.log('  Descargando U2-Net (~176 MB, solo la primera vez)...');

  const response = await fetch(MODEL_URL);
  if (!response.ok || !response.body) {
    fail(`No he podido descargar el modelo (HTTP ${response.status}).`);
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(MODEL_PATH));
  console.log('  Modelo listo.');
}

/** Ejecuta U2-Net y devuelve la mascara de saliencia a 320x320, en 0..1. */
async function segment(inputPath) {
  const { data } = await sharp(inputPath)
    .resize(SIZE, SIZE, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // U2-Net normaliza dividiendo por el maximo real de la imagen, no por 255:
  // actua como una autoexposicion suave y mejora el recorte en fotos oscuras.
  let max = 0;
  for (let i = 0; i < data.length; i++) if (data[i] > max) max = data[i];
  if (max === 0) fail('La imagen esta completamente negra.');

  // A NCHW, que es el formato que espera el modelo.
  const tensor = new Float32Array(3 * SIZE * SIZE);
  const plane = SIZE * SIZE;
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) {
      tensor[c * plane + i] = (data[i * 3 + c] / max - MEAN[c]) / STD[c];
    }
  }

  const session = await ort.InferenceSession.create(MODEL_PATH);
  const feeds = { [session.inputNames[0]]: new ort.Tensor('float32', tensor, [1, 3, SIZE, SIZE]) };
  const results = await session.run(feeds);

  // El modelo devuelve siete salidas (d0..d6); la primera es la buena.
  const pred = results[session.outputNames[0]].data;

  let lo = Infinity;
  let hi = -Infinity;
  for (const v of pred) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const range = Math.max(hi - lo, 1e-6);

  const mask = Buffer.allocUnsafe(plane);
  for (let i = 0; i < plane; i++) {
    mask[i] = Math.round(Math.min(Math.max((pred[i] - lo) / range, 0), 1) * 255);
  }
  return mask;
}

/** Caja que ocupa el sujeto dentro de la mascara. */
function alphaBounds(mask, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Umbral 24/255: por debajo es halo difuminado, no sujeto.
      if (mask[y * width + x] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  return maxX < 0 ? null : { minX, minY, maxX, maxY, width, height };
}

const input = process.argv[2];
if (!input) fail('Falta la ruta.\n    Uso: node scripts/prepare-portrait.mjs mi-foto.jpg');
if (!existsSync(input)) fail(`No encuentro "${input}".`);

const meta = await sharp(input).metadata();
console.log(`\n  Entrada  ${path.basename(input)} - ${meta.width}x${meta.height}`);

await ensureModel();
console.log('  Segmentando...');

const maskSmall = await segment(input);

// La mascara vuelve al tamaño original. El desenfoque de 1 px suaviza el
// escalon de 320 px a varios miles sin comerse el pelo.
const maskFull = await sharp(maskSmall, { raw: { width: SIZE, height: SIZE, channels: 1 } })
  .resize(meta.width, meta.height, { fit: 'fill', kernel: 'cubic' })
  .blur(1)
  .linear(1.25, -22) // curva suave: aprieta el borde sin recortarlo a tijera
  // Sin esto sharp saca 3 canales: al reescalar un raw de un solo canal lo
  // interpreta como sRGB y lo promueve. joinChannel recibiria entonces el
  // triple de bytes de los que espera y la mascara saldria desplazada.
  .toColourspace('b-w')
  .raw()
  .toBuffer();

// Composicion manual del RGBA. joinChannel() si añade una cuarta banda, pero
// sharp no la marca como alfa y la tira al codificar el PNG: el resultado sale
// con tres canales y el fondo intacto. Entrelazando a mano no hay ambiguedad.
const { data: rgb } = await sharp(input)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const pixels = meta.width * meta.height;
const rgba = Buffer.allocUnsafe(pixels * 4);

for (let i = 0; i < pixels; i++) {
  rgba[i * 4] = rgb[i * 3];
  rgba[i * 4 + 1] = rgb[i * 3 + 1];
  rgba[i * 4 + 2] = rgb[i * 3 + 2];
  rgba[i * 4 + 3] = maskFull[i];
}

const cutout = await sharp(rgba, {
  raw: { width: meta.width, height: meta.height, channels: 4 },
})
  .png()
  .toBuffer();

// La caja sale de la mascara directamente: es el alfa, no hace falta volver a
// descodificar el PNG para leerlo.
const bounds = alphaBounds(maskFull, meta.width, meta.height);
if (!bounds) {
  fail('El modelo no ha encontrado ningun sujeto en la foto.');
}

const subjectW = bounds.maxX - bounds.minX + 1;
const subjectH = bounds.maxY - bounds.minY + 1;
const pad = Math.round(Math.max(subjectW, subjectH) * PADDING);

const left = Math.max(0, bounds.minX - pad);
const top = Math.max(0, bounds.minY - pad);
const cropW = Math.min(bounds.width - left, subjectW + pad * 2);
const cropH = Math.min(bounds.height - top, subjectH + pad * 2);

await mkdir(PUBLIC_DIR, { recursive: true });

// WebP con alfa en vez de PNG: mismo recorte por una fraccion del peso, y en
// la cabecera esa imagen es lo primero que se descarga.
const portrait = await sharp(cutout)
  .extract({ left, top, width: cropW, height: cropH })
  .resize({ height: Math.min(cropH, MAX_HEIGHT), withoutEnlargement: true })
  .webp({ quality: 90, alphaQuality: 100, effort: 6 })
  .toBuffer();

await writeFile(path.join(PUBLIC_DIR, 'retrato.webp'), portrait);

const original = await sharp(input)
  .resize({ height: MAX_HEIGHT, withoutEnlargement: true })
  .webp({ quality: 88 })
  .toBuffer();

await writeFile(path.join(PUBLIC_DIR, 'retrato-original.webp'), original);

const out = await sharp(portrait).metadata();

console.log(`
  OK  public/retrato.webp           ${out.width}x${out.height}  (${(portrait.length / 1024).toFixed(0)} KB)
  OK  public/retrato-original.webp  (${(original.length / 1024).toFixed(0)} KB)

  Relacion de aspecto: ${(out.width / out.height).toFixed(3)}
`);
