import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import { PassThrough } from 'stream';
import * as PImage from 'pureimage';
import path from 'path';

const pdfjsPath = require.resolve('pdfjs-dist/package.json');
const standardFontsUrl = path.join(path.dirname(pdfjsPath), 'standard_fonts') + '/';

pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');

export async function extractPdfImages(buffer: Buffer): Promise<Buffer[]> {
  try {
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
      data,
      disableFontFace: true,
      standardFontDataUrl: standardFontsUrl,
    });
    const pdfDocument = await loadingTask.promise;
    
    const numPages = Math.min(pdfDocument.numPages, 10);
    const images: Buffer[] = [];
    
    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const ops = await page.getOperatorList();
      
      for (let j = 0; j < ops.fnArray.length; j++) {
        if (ops.fnArray[j] === pdfjsLib.OPS.paintImageXObject || ops.fnArray[j] === (pdfjsLib.OPS as any).paintJpegXObject || ops.fnArray[j] === (pdfjsLib.OPS as any).paintXObject) {
          const imgName = ops.argsArray[j][0];
          try {
            const img = await page.objs.get(imgName);
            if (img && img.data && img.width && img.height) {
              const canvas = PImage.make(img.width, img.height);
              const ctx = canvas.getContext('2d');
              
              // Handle RGB / RGBA / Grayscale
              const isRGB = img.data.length === img.width * img.height * 3;
              const isRGBA = img.data.length === img.width * img.height * 4;
              
              let dataIdx = 0;
              for (let y = 0; y < img.height; y++) {
                for (let x = 0; x < img.width; x++) {
                  let r, g, b, a = 255;
                  if (isRGBA) {
                    r = img.data[dataIdx++];
                    g = img.data[dataIdx++];
                    b = img.data[dataIdx++];
                    a = img.data[dataIdx++];
                  } else if (isRGB) {
                    r = img.data[dataIdx++];
                    g = img.data[dataIdx++];
                    b = img.data[dataIdx++];
                  } else {
                    // Grayscale
                    r = g = b = img.data[dataIdx++];
                  }
                  
                  ctx.fillStyle = `rgba(${r},${g},${b},${a/255})`;
                  ctx.fillRect(x, y, 1, 1);
                }
              }
              
              const stream = new PassThrough();
              const chunks: Buffer[] = [];
              stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
              const encodePromise = new Promise<Buffer>((resolve, reject) => {
                stream.on('end', () => resolve(Buffer.concat(chunks)));
                stream.on('error', reject);
              });
              
              await PImage.encodePNGToStream(canvas, stream);
              images.push(await encodePromise);
            }
          } catch (e) {
            console.warn('Failed to extract image obj', imgName, e);
          }
        }
      }
    }
    
    return images;
  } catch (error) {
    console.warn('[pdfImageExtractor] Error:', error);
    return [];
  }
}
