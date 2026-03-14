
/**
 * @file Renderer.js
 * @author @eanutt1272.v2
 * @version 1.0.0
 */
class Renderer {
  constructor(size) {
    this.size = size;
    this.img = createImage(this.size, this.size);
  }

  resize(size) {
    this.size = size;
    this.img = createImage(this.size, this.size);
  }

  render(board, automaton, displayMode) {
    let data = board.cells;
    let vmin = 0, vmax = 1;
    let currentSize = this.size;

    if (displayMode === "potential") {
      data = board.potential;
      vmax = 2 * automaton.m;
      if (this.img.width !== this.size) {
        this.img = createImage(this.size, this.size);
      }
    } else if (displayMode === "field") {
      data = board.field;
      vmin = -1;
      vmax = 1;
      if (this.img.width !== this.size) {
        this.img = createImage(this.size, this.size);
      }
    } else if (displayMode === "kernel") {
      data = automaton.kernel;
      currentSize = automaton.kernel.length;
      if (this.img.width !== currentSize) {
        this.img = createImage(currentSize, currentSize);
      }
      vmax = Math.max(...automaton.kernel.flat());
    } else {
      if (this.img.width !== this.size) {
        this.img = createImage(this.size, this.size);
      }
    }

    this.img.loadPixels();
    for (let y = 0; y < currentSize; y++) {
      for (let x = 0; x < currentSize; x++) {
        const val = data[y][x];
        const normVal = (val - vmin) / (vmax - vmin);
        const rgb = this._valueToColour(Math.max(0, Math.min(1, normVal)));
        const idx = (y * currentSize + x) * 4;
        this.img.pixels[idx] = rgb[0];
        this.img.pixels[idx + 1] = rgb[1];
        this.img.pixels[idx + 2] = rgb[2];
        this.img.pixels[idx + 3] = 255;
      }
    }

    this.img.updatePixels();
    noSmooth();
    image(this.img, 0, 0, width, height);
  }

  _valueToColour(val) {
    const v = Math.max(0, Math.min(1, val));
    let r, g, b;
    if (v < 0.25) {
      const t = v / 0.25;
      r = 0; g = t * 128; b = 64 + t * 191;
    } else if (v < 0.5) {
      const t = (v - 0.25) / 0.25;
      r = 0; g = 128 + t * 127; b = 255 - t * 127;
    } else if (v < 0.75) {
      const t = (v - 0.5) / 0.25;
      r = t * 255; g = 255; b = 128 - t * 128;
    } else {
      const t = (v - 0.75) / 0.25;
      r = 255; g = 255 - t * 255; b = 0;
    }
    return [Math.floor(r), Math.floor(g), Math.floor(b)];
  }

  drawGrid(R) {
    push();

    const pixelSpacing = width / this.size;

    if (pixelSpacing > 4) {
      stroke(255, 30);
      strokeWeight(0.5);
      for (let i = 0; i <= this.size; i++) {
        const pos = i * pixelSpacing;
        line(pos, 0, pos, height);
        line(0, pos, width, pos);
      }
    }

    const rSpacing = (R / this.size) * width;
    stroke(200, 100);
    strokeWeight(1.5);
    for (let x = 0; x <= width + 1; x += rSpacing) {
      line(x, 0, x, height);
    }
    for (let y = 0; y <= height + 1; y += rSpacing) {
      line(0, y, width, y);
    }

    pop();
  }

  drawScale(R) {
    const scaleWidth = (R / this.size) * width;
    const x = width - scaleWidth - 20;
    const y = height - 20;
    push();
    fill(255);
    noStroke();
    rect(x, y, scaleWidth, 4);
    textSize(10);
    textAlign(CENTER);
    text("R=" + R.toFixed(1), x + scaleWidth / 2, y + 15);
    pop();
  }

  drawLegend() {
    const x = width - 20;
    const y1 = 20;
    const y2 = height - 70;
    const w = 15;
    const h = y2 - y1;

    push();

    let grad = drawingContext.createLinearGradient(0, y1, 0, y2);

    const stops = 32;
    for (let i = 0; i <= stops; i++) {
      let t = i / stops;
      let c = this._valueToColour(1 - t);
      grad.addColorStop(t, `rgb(${c[0]}, ${c[1]}, ${c[2]})`);
    }

    noStroke();
    drawingContext.fillStyle = grad;
    drawingContext.fillRect(x - w, y1, w, h);

    noFill();
    stroke(255, 255, 255, 200);
    strokeWeight(1.5);
    rect(x - w, y1, w, h);

    fill(255);
    noStroke();
    textSize(11);
    textAlign(RIGHT, CENTER);

    const labels = [
      { val: "1.0", y: y1 },
      { val: "0.75", y: y1 + h * 0.25 },
      { val: "0.5", y: y1 + h * 0.5 },
      { val: "0.25", y: y1 + h * 0.75 },
      { val: "0.0", y: y2 }
    ];

    labels.forEach(label => {
      text(label.val, x - w - 6, label.y);

      stroke(255, 255, 255, 150);
      strokeWeight(1);
      line(x - w - 3, label.y, x - w, label.y);
    });

    pop();
  }

  drawStats(statistics, params) {
    push();

    const x = 20, y = 20;
    const dt = 1 / params.T;
    const RN = Math.pow(params.R, 2);

    fill(255);
    textSize(20);
    textAlign(LEFT, TOP);

    const stats = `Generation: ${statistics.gen}\nTime: ${statistics.time.toFixed(2)}s\nMass: ${(statistics.mass / RN).toFixed(2)}\nGrowth: ${(statistics.growth / RN).toFixed(3)}\nFPS: ${statistics.fps}`;

    text(stats, x, y);
    pop();
  }
}