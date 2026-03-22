p5.disableFriendlyErrors = true;

let appcore;
let vertShader, fragShader, colourMaps, font;
let mainCanvas;

const metadata = {
  name: "Fluvia",
  version: "v5.1.2-dev",
  author: "@eanutt1272.v2",
};

function preload() {
  font = loadFont("../../_shared/fonts/Iosevka-Regular.ttf");
  colourMaps = loadJSON("../../_shared/data/colour-maps.json");
  loadStrings("vert.glsl", (lines) => (vertShader = lines.join("\n")));
  loadStrings("frag.glsl", (lines) => (fragShader = lines.join("\n")));
}

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  mainCanvas = createCanvas(canvasSize, canvasSize);

  setupCanvasProperties(mainCanvas);

  requestAnimationFrame(() => {
    appcore = new AppCore({
      metadata,
      vertShader,
      fragShader,
      colourMaps,
      font,
    });
  });
}

function setupCanvasProperties(canvas) {
  const canvasEl = canvas.elt;

  canvasEl.setAttribute("tabindex", "0");
  setTimeout(() => {
    canvasEl.focus();
  }, 100);

  noSmooth();
  textFont(font || "monospace");
  pixelDensity(1);
  frameRate(120);
}

function draw() {
  if (!appcore) return;
  appcore.update();
  appcore.render();
}

function windowResized() { if (!appcore) return; appcore.resize(); }
function keyPressed() { return appcore ? appcore.handleKeyPressed(key, keyCode) : false; }
function keyReleased() { return appcore ? appcore.handleKeyReleased(key, keyCode) : false; }
function mouseWheel(event) { return appcore ? appcore.handleWheel(event) : false; }
function mouseDragged(event) { return appcore ? appcore.handlePointer(event) : false; }
function touchStarted(event) { return appcore ? appcore.handlePointer(event) : false; }
function touchMoved(event) { return appcore ? appcore.handlePointer(event) : false; }
function touchEnded(event) { return appcore ? appcore.handlePointer(event) : false; }
