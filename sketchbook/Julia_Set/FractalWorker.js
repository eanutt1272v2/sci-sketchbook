"use strict";

let lutArr = null;
let lutLast = 0;

self.onmessage = function (e) {
  if (e.data.type === "setLUT") {
    lutArr = new Uint8Array(e.data.lut);
    lutLast = e.data.LUT_SIZE - 1;
    return;
  }
  if (e.data.type !== "render" || !lutArr) return;

  const {
    w,
    h,
    zoom,
    offsetX,
    offsetY,
    maxIterations,
    juliaCx,
    juliaCy,
  } = e.data;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const aspectRatio = w / h;
  const invZoom = 1.0 / zoom;

  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let zx =
        (-2.1 * aspectRatio + (x / w) * 3.2 * aspectRatio) * invZoom +
        offsetX +
        0.5;
      let zy = (-2.1 + (y / h) * 3.2) * invZoom + offsetY + 0.5;
      let n = 0;

      while (n < maxIterations) {
        const zx2 = zx * zx;
        const zy2 = zy * zy;
        if (zx2 + zy2 > 16.0) break;
        const newZx = zx2 - zy2 + juliaCx;
        zy = 2.0 * zx * zy + juliaCy;
        zx = newZx;
        n++;
      }

      const pidx = (x + y * w) * 4;
      if (n === maxIterations) {
        pixels[pidx + 3] = 255;
      } else {
        const logZn = Math.log(zx * zx + zy * zy) * 0.5;
        const nu = Math.log(logZn / Math.LN2) / Math.LN2;
        const t = (n + 1 - nu) / maxIterations;
        const li =
          Math.min(lutLast, Math.max(0, Math.floor(t * lutLast))) * 3;
        pixels[pidx] = lutArr[li];
        pixels[pidx + 1] = lutArr[li + 1];
        pixels[pidx + 2] = lutArr[li + 2];
        pixels[pidx + 3] = 255;
      }
    }
  }

  self.postMessage({ type: "result", pixels: pixels.buffer, w, h }, [
    pixels.buffer,
  ]);
};
