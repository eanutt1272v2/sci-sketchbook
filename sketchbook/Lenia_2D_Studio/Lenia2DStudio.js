p5.disableFriendlyErrors = true;

let appcore;
let font, animalsData, colourMaps;
let mainCanvas;

const metadata = {
  name: "Lenia 2D Studio",
  version: "v1.6.9-dev",
  author: "@eanutt1272.v2",
};

function preload() {
  font = loadFont("JetBrainsMono-Regular.ttf");
  animalsData = loadJSON("animals.json");
  colourMaps = loadJSON("colour-maps.json");
}

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  mainCanvas = createCanvas(canvasSize, canvasSize);

  setupCanvasProperties(mainCanvas);

  appcore = new AppCore({
    metadata,
    animalsData,
    colourMaps,
    font,
  });

  appcore.setup();
}

function draw() {
  appcore.draw();
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

function mouseClicked(e) { return appcore.handleMouseClicked(e); }
function touchStarted(e) { return appcore.handleMouseClicked(e); }
function windowResized() { return appcore.windowResized(); }
function keyPressed() { return appcore.handleKeyPressed(key || event.key, keyCode); }
function keyReleased() { return appcore.handleKeyReleased(key || event.key, keyCode); }
