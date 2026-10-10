import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import * as PImage from 'pureimage';
import { PassThrough } from 'stream';
import Module from 'module';
import path from 'path';

// Mock 'canvas' so pdfjs-dist doesn't crash when it attempts to require it for polyfills
const originalRequire = Module.prototype.require;
(Module.prototype as any).require = function (id: string) {
  if (id === 'canvas') {
    return {
      createCanvas: (w: number, h: number) => PImage.make(w, h),
      Canvas: class Canvas {},
      Image: class Image {},
      DOMMatrix: class DOMMatrix {
        a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
        invertSelf() { return this; }
      },
      Path2D: class Path2D {}
    };
  }
  return originalRequire.apply(this, arguments as any);
};

const pdfjsPath = require.resolve('pdfjs-dist/package.json');
const standardFontsUrl = path.join(path.dirname(pdfjsPath), 'standard_fonts') + '/';

// Patch PureImage Context prototype
const dummyCtx = PImage.make(1, 1).getContext('2d') as any;
const CtxProto = dummyCtx.constructor.prototype;
CtxProto.createImageData = function (w: number, h: number) {
  return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
};
CtxProto.putImageData = function (imgData: any, dx: number, dy: number) {
  const tempCanvas = PImage.make(imgData.width, imgData.height);
  for (let i = 0; i < imgData.data.length; i++) {
    tempCanvas.data[i] = imgData.data[i];
  }
  this.drawImage(tempCanvas, dx, dy);
};
CtxProto.getTransform = function () {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, invertSelf: function() { return this; } };
};

// Ensure the worker is configured (pure JS path for Node)
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');

class PureImageCanvasFactory {
  create(width: number, height: number) {
    const canvas = PImage.make(width, height);
    const context = canvas.getContext('2d');
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);
    return { canvas, context };
  }

  reset(canvasAndContext: any, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: any) {
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

export async function rasterizePdf(buffer: Buffer): Promise<Buffer[]> {
  try {
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
      data,
      disableFontFace: true,
      standardFontDataUrl: standardFontsUrl,
    });
    const pdfDocument = await loadingTask.promise;

    const numPages = Math.min(pdfDocument.numPages, 10);
    const buffers: Buffer[] = [];
    const canvasFactory = new PureImageCanvasFactory();

    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const scale = 2.0;
      const viewport = page.getViewport({ scale });

      const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
      const renderContext = {
        canvasContext: canvasAndContext.context as any,
        viewport,
        canvasFactory: canvasFactory as any,
      };

      await page.render(renderContext).promise;

      // Encode to PNG buffer
      const stream = new PassThrough();
      const chunks: Buffer[] = [];
      stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
      const encodePromise = new Promise<Buffer>((resolve, reject) => {
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });

      await PImage.encodePNGToStream(canvasAndContext.canvas, stream);
      const pngBuffer = await encodePromise;
      buffers.push(pngBuffer);

      canvasFactory.destroy(canvasAndContext);
    }

    return buffers;
  } catch (error) {
    console.error('[pdfRasterizer] Failed to rasterize PDF:', error);
    return [];
  }
}
