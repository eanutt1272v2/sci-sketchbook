/**
 * @file sketch.js
 * @description A p5.js implementation of a Mandelbrot set explorer with a custom UI for adjusting parameters and colour maps.
 * @author @eanutt1272.v2
 * @version 3.0.0
 */

let appcore;

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  createCanvas(canvasSize, canvasSize);
  pixelDensity(1);
  appcore = new AppCore();
  appcore.setup();
}

function windowResized() {
  const canvasSize = min(windowWidth, windowHeight);
  resizeCanvas(canvasSize, canvasSize);

  if (appcore !== null) {
    appcore.renderer.buffer = createGraphics(width, height);
    appcore.renderer.buffer.pixelDensity(1);
    appcore.panel = new UIPanel(appcore);
    appcore.needsRedraw = true;
  }
}

function draw() {
  appcore.draw();
}

function draw() { appcore.draw();}
function mousePressed() { appcore.input.onMousePressed(); return false; }
function mouseReleased() { appcore.input.onMouseReleased(); return false; }
function mouseDragged() { appcore.input.onMouseDragged(); return false; }
function touchStarted() { appcore.input.onMousePressed(); return false;}
function touchEnded() { appcore.input.onMouseReleased(); return false; }
function touchMoved() { appcore.input.onMouseDragged(); return false; }
function mouseWheel(event) { appcore.input.onMouseWheel(event); return false; }
function keyPressed() { appcore.input.onKeyPressed(); return false; }
function keyReleased() { appcore.input.onKeyReleased(); return false; }

class AppCore {
  constructor() {
    this.maxIterations = 128;
    this.zoom = 1.0;
    this.offsetX = -0.25;
    this.offsetY = 0.5;
    this.needsRedraw = true;
    this.showUI = true;

    this.justPressed = false;

    this.theme = null;
    this.panel = null;
    this.renderer = null;
    this.input = null;
  }

  setup() {
    this.theme = new UITheme();
    this.renderer = new FractalRenderer(this);
    this.panel = new UIPanel(this);
    this.input = new InputHandler(this);

    this.renderer.generateLUT();
    colorMode(RGB, 255);
  }

  draw() {
    background(0);
    this.input.handleContinuousInput();

    if (this.needsRedraw) {
      this.renderer.render();
      this.needsRedraw = false;
    }

    image(this.renderer.buffer, 0, 0);

    if (this.showUI) {
      this.panel.draw();
    }

    this.justPressed = false;
  }

  doZoom(factor, tx, ty) {
    const aspectRatio = width / height;
    const baseX = map(tx, 0, width, -2.1 * aspectRatio, 1.1 * aspectRatio);
    const baseY = map(ty, 0, height, -2.1, 1.1);
    const old = this.zoom;
    this.zoom *= factor;
    this.offsetX += baseX * (1.0 / old - 1.0 / this.zoom);
    this.offsetY += baseY * (1.0 / old - 1.0 / this.zoom);
  }
}

class FractalRenderer {
  constructor(appcore) {
    this.appcore = appcore;
    this.buffer = createGraphics(width, height);
    this.buffer.pixelDensity(1);

    this.LUT_SIZE = 2048;
    this.colorLUT = new Array(this.LUT_SIZE);

    this.mapNames = [
      "cividis", "inferno", "magma", "mako",
      "plasma", "rocket", "turbo", "viridis", "greyscale"
    ];

    this.currentMapIndex = 2;
  }

  render() {
    this.buffer.loadPixels();
    this.buffer.colorMode(RGB, 1.0);

    const aspectRatio = width / height;
    const invZoom = 1.0 / this.appcore.zoom;

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const cx = map(x, 0, width, -2.1 * aspectRatio, 1.1 * aspectRatio) * invZoom + this.appcore.offsetX;
        const cy = map(y, 0, height, -2.1, 1.1) * invZoom + this.appcore.offsetY;
        let zx = 0.0;
        let zy = 0.0;
        let n = 0;

        while (n < this.appcore.maxIterations) {
          const zx2 = zx * zx;
          const zy2 = zy * zy;
          if (zx2 + zy2 > 16.0) {
            break;
          }
          const newZx = zx2 - zy2 + cx;
          zy = 2.0 * zx * zy + cy;
          zx = newZx;
          n++;
        }

        const idx = x + y * width;
        const pidx = idx * 4;
        if (n === this.appcore.maxIterations) {
          this.buffer.pixels[pidx] = 0;
          this.buffer.pixels[pidx + 1] = 0;
          this.buffer.pixels[pidx + 2] = 0;
          this.buffer.pixels[pidx + 3] = 255;
        } else {
          const logZn = Math.log(zx * zx + zy * zy) / 2.0;
          const nu = Math.log(logZn / Math.log(2)) / Math.log(2);
          const t = (n + 1 - nu) / this.appcore.maxIterations;
          const lutIndex = floor(constrain(t, 0, 1) * (this.LUT_SIZE - 1));
          const lutColor = this.colorLUT[lutIndex];
          this.buffer.pixels[pidx] = lutColor[0];
          this.buffer.pixels[pidx + 1] = lutColor[1];
          this.buffer.pixels[pidx + 2] = lutColor[2];
          this.buffer.pixels[pidx + 3] = 255;
        }
      }
    }

    this.buffer.updatePixels();
  }

  setMap(index) {
    this.currentMapIndex = index;
    this.generateLUT();
  }

  generateLUT() {
    const c = this.getCoefficients(this.mapNames[this.currentMapIndex]);
    for (let i = 0; i < this.LUT_SIZE; i++) {
      const t = i / (this.LUT_SIZE - 1);
      const r = Math.round(constrain(this.applyPoly(t, c[0]), 0, 1) * 255);
      const g = Math.round(constrain(this.applyPoly(t, c[1]), 0, 1) * 255);
      const b = Math.round(constrain(this.applyPoly(t, c[2]), 0, 1) * 255);
      this.colorLUT[i] = [r, g, b];
    }
  }

  applyPoly(t, c) {
    return c[0] + c[1] * t + c[2] * t * t + c[3] * t * t * t + c[4] * t * t * t * t + c[5] * t * t * t * t * t + c[6] * t * t * t * t * t * t;
  }

  getCoefficients(name) {
    if (name === "cividis") return [[-0.008973, -0.384689, 15.42921, -58.977031, 102.370492, -83.187239, 25.77607], [0.136756, 0.639494, 0.385562, -1.404197, 2.600914, -2.14075, 0.688122], [0.29417, 2.982654, -22.36376, 74.863561, -121.303164, 93.974216, -28.262533]];
    if (name === "inferno") return [[0.000214, 0.105874, 11.617115, -41.709277, 77.157454, -71.287667, 25.092619], [0.001635, 0.566364, -3.947723, 17.457724, -33.415679, 32.55388, -12.222155], [-0.03713, 4.117926, -16.257323, 44.645117, -82.253923, 73.588132, -23.11565]];
    if (name === "magma") return [[-0.002067, 0.250486, 8.345901, -27.666969, 52.170684, -50.758572, 18.664253], [-0.000688, 0.694455, -3.596031, 14.253853, -27.944584, 29.05388, -11.490027], [-0.009548, 2.495287, 0.329057, -13.646583, 12.881091, 4.269936, -5.570769]];
    if (name === "mako") return [[0.032987, 1.620032, -5.833466, 19.26673, -48.335836, 57.794682, -23.67438], [0.013232, 0.848348, -1.651402, 8.153931, -12.79364, 8.555513, -2.172825], [0.040283, 0.292971, 12.702365, -44.241782, 65.176477, -47.319049, 14.259791]];
    if (name === "plasma") return [[0.064053, 2.142438, -2.653255, 6.094711, -11.065106, 9.974645, -3.623823], [0.024812, 0.244749, -7.461101, 42.308428, -82.644718, 71.408341, -22.914405], [0.5349, 0.742966, 3.108382, -28.491792, 60.093584, -54.020563, 18.193381]];
    if (name === "rocket") return [[-0.003174, 1.947267, -6.401815, 30.376433, -57.268147, 44.789992, -12.453563], [0.037717, -0.476821, 15.073064, -81.403784, 173.768416, -158.313952, 52.250665], [0.112123, 0.400542, 6.253872, -21.550609, 14.869938, 11.402042, -10.648435]];
    if (name === "turbo") return [[0.080545, 7.00898, -66.727306, 228.660253, -334.841257, 220.424075, -54.09554], [0.069393, 3.147611, -4.927799, 25.101273, -69.296265, 67.510842, -21.578703], [0.219622, 7.655918, -10.16298, -91.680678, 288.708703, -305.386975, 110.735079]];
    if (name === "viridis") return [[0.274455, 0.107708, -0.327241, -4.599932, 6.203736, 4.751787, -5.432077], [0.005768, 1.39647, 0.214814, -5.758238, 14.153965, -13.749439, 4.641571], [0.332664, 1.386771, 0.091977, -19.291809, 56.6563, -65.320968, 26.272108]];
    return [[0, 1, 0, 0, 0, 0, 0], [0, 1, 0, 0, 0, 0, 0], [0, 1, 0, 0, 0, 0, 0]];
  }
}

class InputHandler {
  constructor(appcore) {
    this.appcore = appcore;

    this.keyUp = false;
    this.keyDown = false;
    this.keyLeft = false;
    this.keyRight = false;
    this.keyZoomIn = false;
    this.keyZoomOut = false;

    this.isTypingIter = false;
    this.typingBuffer = "";
  }

  handleContinuousInput() {
    const p = this.appcore.panel;
    if (p.dropdown.isOpen || p.slider.locked || this.isTypingIter) {
      return;
    }

    let changed = false;
    const speed = 0.05 / this.appcore.zoom;

    if (this.keyUp) {
      this.appcore.offsetY -= speed;
      changed = true;
    }
    if (this.keyDown) {
      this.appcore.offsetY += speed;
      changed = true;
    }
    if (this.keyLeft) {
      this.appcore.offsetX -= speed;
      changed = true;
    }
    if (this.keyRight) {
      this.appcore.offsetX += speed;
      changed = true;
    }
    if (this.keyZoomIn) {
      this.appcore.doZoom(1.05, width / 2, height / 2);
      changed = true;
    }
    if (this.keyZoomOut) {
      this.appcore.doZoom(1.0 / 1.05, width / 2, height / 2);
      changed = true;
    }

    if (mouseIsPressed && this.appcore.showUI && !this.appcore.justPressed) {
      if (p.zoomInBtn.isMouseOver()) {
        this.appcore.doZoom(1.05, width / 2, height / 2);
        changed = true;
      }
      if (p.zoomOutBtn.isMouseOver()) {
        this.appcore.doZoom(1.0 / 1.05, width / 2, height / 2);
        changed = true;
      }
    }

    if (mouseIsPressed && p.slider.locked && p.slider.update()) {
      this.appcore.maxIterations = int(p.slider.val);
      changed = true;
    }

    if (changed) {
      this.appcore.needsRedraw = true;
    }
  }

  onMousePressed() {
    if (!this.appcore.showUI) {
      return;
    }

    const p = this.appcore.panel;

    if (p.dropdown.isOpen) {
      const clicked = p.dropdown.getClickedIndex();
      if (clicked !== -1 && !this.appcore.justPressed) {
        this.appcore.renderer.setMap(clicked);
        this.appcore.needsRedraw = true;
        this.appcore.justPressed = true;
      }
      p.dropdown.isOpen = false;
      return;
    }

    if (p.dropdown.isHeaderOver() && !this.appcore.justPressed) {
      p.dropdown.toggle();
      this.appcore.justPressed = true;
      return;
    }

    const lay = p.layout;
    if (
      mouseX > lay.contentX() && mouseX < lay.contentX() + 180 &&
      mouseY > lay.getY("iterLabel") && mouseY < lay.getY("iterLabel") + 20
    ) {
      this.isTypingIter = true;
      this.typingBuffer = "";
      return;
    }

    this.isTypingIter = false;

    if (p.slider.isMouseOver()) {
      p.slider.locked = true;
      p.slider.val = constrain(
        map(mouseX, p.slider.x, p.slider.x + p.slider.w, p.slider.min, p.slider.max),
        p.slider.min,
        p.slider.max
      );
      this.appcore.maxIterations = int(p.slider.val);
      this.appcore.needsRedraw = true;
    }

    const amounts = [-64, -16, 16, 64];
    for (let i = 0; i < 4; i++) {
      if (p.stepButtons[i].isMouseOver() && !this.appcore.justPressed) {
        this.appcore.maxIterations = constrain(this.appcore.maxIterations + amounts[i], int(p.slider.min), int(p.slider.max));
        p.slider.val = this.appcore.maxIterations;
        this.appcore.needsRedraw = true;
        this.appcore.justPressed = true;
      }
    }

    if (p.zoomInBtn.isMouseOver() && !this.appcore.justPressed) {
      this.appcore.doZoom(1.05, width / 2, height / 2);
      this.appcore.needsRedraw = true;
      this.appcore.justPressed = true;
    }

    if (p.zoomOutBtn.isMouseOver() && !this.appcore.justPressed) {
      this.appcore.doZoom(1.0 / 1.05, width / 2, height / 2);
      this.appcore.needsRedraw = true;
      this.appcore.justPressed = true;
    }
  }

  onMouseReleased() {
    this.appcore.panel.slider.locked = false;
    // ! Watch this flag carefully to avoid issues with click-drag interactions on the UI
    this.appcore.justPressed = false;
  }

  onMouseDragged() {
    const p = this.appcore.panel;
    if (p.slider.locked) {
      p.slider.val = constrain(
        map(mouseX, p.slider.x, p.slider.x + p.slider.w, p.slider.min, p.slider.max),
        p.slider.min,
        p.slider.max
      );
      this.appcore.maxIterations = int(p.slider.val);
      this.appcore.needsRedraw = true;
      return;
    }

    if (this.appcore.showUI && (p.dropdown.isOpen || this.isTypingIter)) {
      return;
    }
    if (this.appcore.showUI && (p.zoomInBtn.isMouseOver() || p.zoomOutBtn.isMouseOver())) {
      return;
    }

    const ar = width / height;
    this.appcore.offsetX -= (mouseX - pmouseX) * (3.2 * ar) / width / this.appcore.zoom;
    this.appcore.offsetY -= (mouseY - pmouseY) * 3.2 / height / this.appcore.zoom;
    this.appcore.needsRedraw = true;
  }

  onMouseWheel(event) {
    if (this.appcore.showUI && this.appcore.panel.dropdown.isOpen) {
      return;
    }
    this.appcore.doZoom(event.delta < 0 ? 1.15 : 1.0 / 1.15, mouseX, mouseY);
    this.appcore.needsRedraw = true;
  }

  onKeyPressed() {
    if (this.isTypingIter) {
      if (key >= "0" && key <= "9") {
        this.typingBuffer += key;
      } else if (keyCode === BACKSPACE && this.typingBuffer.length > 0) {
        this.typingBuffer = this.typingBuffer.substring(0, this.typingBuffer.length - 1);
      } else if (keyCode === ENTER || keyCode === RETURN) {
        if (this.typingBuffer.length > 0) {
          this.appcore.maxIterations = constrain(int(this.typingBuffer), int(this.appcore.panel.slider.min), int(this.appcore.panel.slider.max));
          this.appcore.panel.slider.val = this.appcore.maxIterations;
          this.appcore.needsRedraw = true;
        }
        this.isTypingIter = false;
      } else if (keyCode === ESCAPE) {
        this.isTypingIter = false;
      }
      return;
    }

    if (key === "h" || key === "H") this.appcore.showUI = !this.appcore.showUI;
    if (key === "w" || key === "W" || keyCode === UP_ARROW) this.keyUp = true;
    if (key === "s" || key === "S" || keyCode === DOWN_ARROW) this.keyDown = true;
    if (key === "a" || key === "A" || keyCode === LEFT_ARROW) this.keyLeft = true;
    if (key === "d" || key === "D" || keyCode === RIGHT_ARROW) this.keyRight = true;
    if (key === "e" || key === "E" || key === "=" || key === "+") this.keyZoomIn = true;
    if (key === "q" || key === "Q" || key === "-") this.keyZoomOut = true;
  }

  onKeyReleased() {
    if (key === "w" || key === "W" || keyCode === UP_ARROW) this.keyUp = false;
    if (key === "s" || key === "S" || keyCode === DOWN_ARROW) this.keyDown = false;
    if (key === "a" || key === "A" || keyCode === LEFT_ARROW) this.keyLeft = false;
    if (key === "d" || key === "D" || keyCode === RIGHT_ARROW) this.keyRight = false;
    if (key === "e" || key === "E" || key === "=" || key === "+") this.keyZoomIn = false;
    if (key === "q" || key === "Q" || key === "-") this.keyZoomOut = false;
  }
}

class UIPanel {
  constructor(appcore) {
    this.appcore = appcore;

    this.PANEL_W = 390;

    this.layout = new UILayout(10, 10, this.PANEL_W, 12, 5, 18);
    this.layout.add("iterLabel", 20, "panel");
    this.layout.add("iterSlider", 18, "panel");
    this.layout.add("stepButtons", 30, "panel");
    this.layout.add("zoomInfo", 19, "panel");
    this.layout.add("posInfo", 19, "panel");
    this.layout.add("hints", 15, "panel");
    this.layout.add("colorMap", 28, "panel");
    this.layout.finish();

    this.slider = new Slider(this.layout.contentX(), this.layout.getY("iterSlider"), this.layout.contentW(), 18, 1, 512, this.appcore.maxIterations, this.appcore.theme);

    const stepLabels = ["--", "-", "+", "++"];
    const stepY = this.layout.getY("stepButtons");
    this.stepButtons = new Array(4);
    for (let i = 0; i < 4; i++) {
      this.stepButtons[i] = new Button(this.layout.contentX() + i * 36, stepY, 28, 28, stepLabels[i], this.appcore.theme);
    }

    this.dropdown = new Dropdown(this.layout.contentX(), this.layout.getY("colorMap"), 180, 26, this.appcore.renderer.mapNames, this.appcore.theme);
    this.zoomInBtn = new Button(width - 80, height - 150, 56, 56, "+", this.appcore.theme);
    this.zoomOutBtn = new Button(width - 80, height - 80, 56, 56, "-", this.appcore.theme);
  }

  draw() {
    const t = this.appcore.theme;
    colorMode(RGB, 255);

    fill(t.bgPanel);
    stroke(t.strokePanel);
    strokeWeight(t.swPanel);
    rect(this.layout.x, this.layout.y, this.PANEL_W, this.layout.totalHeight, 4);

    for (const sy of this.layout.separatorYs()) {
      stroke(t.strokeSeparator);
      strokeWeight(t.swSeparator);
      line(this.layout.contentX(), sy, this.layout.x + this.PANEL_W - this.layout.padding, sy);
    }

    const px = this.layout.contentX();

    const inp = this.appcore.input;
    const iterText = inp.isTypingIter ? `Input: ${inp.typingBuffer}_` : `Iterations: ${this.appcore.maxIterations}`;
    noStroke();
    fill(t.textPrimary);
    textSize(t.textSizePrimary);
    textAlign(LEFT, TOP);
    text(iterText, px, this.layout.getY("iterLabel"));

    if (!inp.isTypingIter) {
      fill(t.textMuted);
      textSize(t.textSizeCaption);
      text("(click to type)", px + 105, this.layout.getY("iterLabel") + 3);
    }

    this.slider.display();

    for (const b of this.stepButtons) {
      b.display();
    }

    noStroke();
    fill(t.textSecondary);
    textSize(t.textSizeSecondary);
    textAlign(LEFT, TOP);

    const zr = this.format3dp(this.appcore.zoom);
    const xr = this.format3dp(this.appcore.offsetX);
    const yr = this.format3dp(-this.appcore.offsetY);

    text(`Zoom: ${zr}x`, px, this.layout.getY("zoomInfo"));
    text(`Position: X=${xr}, Y=${yr}`, px, this.layout.getY("posInfo"));

    fill(t.textMuted);
    textSize(t.textSizeCaption);
    text("[WASD/Arrows]: Pan, [Scroll/Q,E]: Zoom, [H]: Toggle UI", px, this.layout.getY("hints"));

    this.dropdown.display(this.appcore.renderer.currentMapIndex);

    this.zoomInBtn.display();
    this.zoomOutBtn.display();
  }

  format3dp(value) {
    const rounded = Math.round(value * 1000.0) / 1000.0;
    const sign = rounded < 0 ? "-" : "";
    const absRounded = Math.abs(rounded);

    let whole = Math.floor(absRounded);
    let frac = Math.round((absRounded - whole) * 1000.0);
    if (frac === 1000) {
      whole += 1;
      frac = 0;
    }

    const wholeStr = String(whole);
    const fracStr = `${frac < 10 ? "00" : frac < 100 ? "0" : ""}${frac}`;
    return `${sign}${wholeStr}.${fracStr}`;
  }
}

class UITheme {
  constructor() {
    this.bgPanel = color(20, 20, 20, 210);
    this.bgWidget = color(42, 42, 42, 220);
    this.bgHover = color(68, 68, 68, 230);
    this.bgActive = color(100, 100, 100, 245);

    this.textPrimary = color(240);
    this.textSecondary = color(180);
    this.textMuted = color(110);

    this.textSizePrimary = 16;
    this.textSizeSecondary = 14;
    this.textSizeCaption = 10;

    this.swPanel = 1.4;
    this.swWidget = 1.0;
    this.swTrack = 0.8;
    this.swSeparator = 0.6;

    this.strokePanel = color(105);
    this.strokeWidget = color(82);
    this.strokeTrack = color(65);
    this.strokeSeparator = color(50);
    this.strokeFocus = color(190);

    this.accentHandle = color(220);
  }
}

class UILayout {
  constructor(x, y, w, padding, intraGap, interGap) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.padding = padding;
    this.intraGap = intraGap;
    this.interGap = interGap;
    this.totalHeight = 0;

    this.names = [];
    this.heights = [];
    this.groups = [];
    this.gaps = [];

    this.yPositions = new Map();
    this._separatorYs = [];
  }

  add(name, h, group) {
    this.names.push(name);
    this.heights.push(h);
    this.groups.push(group);
  }

  finish() {
    this.gaps = [];
    for (let i = 0; i < this.names.length; i++) {
      const lastInGroup = i === this.names.length - 1 || this.groups[i] !== this.groups[i + 1];
      this.gaps.push(lastInGroup ? this.interGap : this.intraGap);
    }

    let cursor = this.y + this.padding;
    for (let i = 0; i < this.names.length; i++) {
      this.yPositions.set(this.names[i], cursor);
      cursor += this.heights[i] + this.gaps[i];
    }
    this.totalHeight = cursor - this.y - this.interGap + this.padding;

    this._separatorYs = [];
    for (let i = 0; i < this.names.length - 1; i++) {
      if (this.groups[i] !== this.groups[i + 1]) {
        const rowBottom = this.yPositions.get(this.names[i]) + this.heights[i];
        const nextTop = this.yPositions.get(this.names[i + 1]);
        this._separatorYs.push((rowBottom + nextTop) / 2.0);
      }
    }
  }

  getY(name) {
    const v = this.yPositions.get(name);
    return v !== undefined ? v : this.y;
  }

  contentX() {
    return this.x + this.padding;
  }

  contentW() {
    return this.w - this.padding * 2;
  }

  separatorYs() {
    return this._separatorYs;
  }
}

class Slider {
  constructor(x, y, w, h, minVal, maxVal, start, theme) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.min = minVal;
    this.max = maxVal;
    this.val = start;
    this.theme = theme;

    this.locked = false;
  }

  display() {
    colorMode(RGB, 255);
    const trackY = this.y + this.h / 2;
    stroke(this.theme.strokeTrack);
    strokeWeight(this.theme.swTrack);
    line(this.x, trackY, this.x + this.w, trackY);

    const handleX = map(this.val, this.min, this.max, this.x, this.x + this.w);
    noStroke();
    fill(this.locked ? this.theme.accentHandle : this.theme.textSecondary);
    ellipse(handleX, trackY, this.h * 0.5, this.h * 0.5);
  }

  update() {
    if (this.locked) {
      this.val = constrain(map(mouseX, this.x, this.x + this.w, this.min, this.max), this.min, this.max);
      return true;
    }
    return false;
  }

  isMouseOver() {
    return mouseX > this.x && mouseX < this.x + this.w && mouseY > this.y && mouseY < this.y + this.h;
  }
}

class Dropdown {
  constructor(x, y, w, h, items, theme) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.items = items;
    this.theme = theme;

    this.isOpen = false;
  }

  display(currentIndex) {
    colorMode(RGB, 255);
    stroke(this.theme.strokeWidget);
    strokeWeight(this.theme.swWidget);

    fill(this.isHeaderOver() ? this.theme.bgHover : this.theme.bgWidget);
    rect(this.x, this.y, this.w, this.h, 3);
    fill(this.theme.textPrimary);
    textSize(this.theme.textSizeSecondary);
    textAlign(LEFT, CENTER);
    text(`Map: ${this.items[currentIndex].charAt(0).toUpperCase() + this.items[currentIndex].slice(1)}`, this.x + 8, this.y + this.h / 2);

    if (this.isOpen) {
      for (let i = 0; i < this.items.length; i++) {
        const over = mouseX > this.x && mouseX < this.x + this.w && mouseY > this.y + this.h + i * this.h && mouseY < this.y + 2 * this.h + i * this.h;
        fill(over ? this.theme.bgActive : this.theme.bgHover);
        rect(this.x, this.y + this.h + i * this.h, this.w, this.h);
        fill(this.theme.textPrimary);
        text(this.items[i].charAt(0).toUpperCase() + this.items[i].slice(1), this.x + 8, this.y + this.h + i * this.h + this.h / 2);
      }
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
  }

  isHeaderOver() {
    return mouseX > this.x && mouseX < this.x + this.w && mouseY > this.y && mouseY < this.y + this.h;
  }

  getClickedIndex() {
    for (let i = 0; i < this.items.length; i++) {
      if (mouseX > this.x && mouseX < this.x + this.w && mouseY > this.y + this.h + i * this.h && mouseY < this.y + 2 * this.h + i * this.h) {
        return i;
      }
    }
    return -1;
  }
}

class Button {
  constructor(x, y, w, h, label, theme) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.label = label;
    this.theme = theme;
  }

  display() {
    colorMode(RGB, 255);
    fill(this.isMouseOver() ? this.theme.bgHover : this.theme.bgWidget);
    stroke(this.theme.strokeWidget);
    strokeWeight(this.theme.swWidget);
    rect(this.x, this.y, this.w, this.h, 3);
    fill(this.theme.textPrimary);
    textSize(max(11, this.h * 0.42));
    textAlign(CENTER, CENTER);
    text(this.label, this.x + this.w / 2, this.y + this.h / 2);
  }

  isMouseOver() {
    return mouseX > this.x && mouseX < this.x + this.w && mouseY > this.y && mouseY < this.y + this.h;
  }
}
