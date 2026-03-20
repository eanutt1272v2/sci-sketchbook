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
  font = loadFont("JetBrainsMono-Regular.ttf");
  colourMaps = loadJSON("colour-maps.json");
  loadStrings("vert.glsl", (lines) => (vertShader = lines.join("\n")));
  loadStrings("frag.glsl", (lines) => (fragShader = lines.join("\n")));
}

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  mainCanvas = createCanvas(canvasSize, canvasSize);

  setupCanvasProperties(mainCanvas);

  appcore = new AppCore({
    metadata,
    vertShader,
    fragShader,
    colourMaps,
    font: font,
  });
}

function setupCanvasProperties(canvas) {
  const canvasEl = canvas.elt;

  canvasEl.setAttribute("tabindex", "0");
  setTimeout(() => {
    canvasEl.focus();
  }, 100);

  noSmooth();
  textFont(font);
  pixelDensity(1);
  frameRate(60);
}

function draw() {
  appcore.update();
  appcore.draw();
}

function windowResized() { appcore.resize(); }
function keyPressed() { return appcore.handleKeyPressed(key, keyCode); }
function keyReleased() { return appcore.handleKeyReleased(key, keyCode); }
function mouseWheel(event) { return appcore.handleWheel(event); }
function mouseDragged(event) { return appcore.handlePointer(event); }
function touchStarted(event) { return appcore.handlePointer(event); }
function touchMoved(event) { return appcore.handlePointer(event); }
function touchEnded(event) { return appcore.handlePointer(event); }
