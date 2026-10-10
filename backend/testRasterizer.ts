import fs from 'fs';
import { rasterizePdf } from './src/services/pdfRasterizer';

async function run() {
  try {
    const buffer = fs.readFileSync('../test-docs/image-only-lab-report.pdf');
    console.log('Buffer read, length:', buffer.length);
    const images = await rasterizePdf(buffer);
    console.log('Rasterized images:', images.length);
    if (images.length > 0) {
      fs.writeFileSync('out1.png', images[0]);
      console.log('Wrote out1.png');
    }
  } catch (err) {
    console.error(err);
  }
}
run();
