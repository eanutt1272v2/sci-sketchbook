

p5.disableFriendlyErrors = true;

let appcore;
let colourMaps, font;

const metadata = {
  name: "Eigen",
  version: "v2.3.2-dev",
  author: "@eanutt1272.v2"
};

function preload() {
  font = loadFont("JetBrainsMono-Regular.ttf");
  colourMaps = loadJSON("colour-maps.json");
}

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  const mainCanvas = createCanvas(canvasSize, canvasSize);

  setupCanvasProperties(mainCanvas);

  appcore = new AppCore({
    metadata,
    colourMaps,
    font
  });
}

function setupCanvasProperties(canvas) {
  const canvasEl = canvas.elt;

  canvasEl.setAttribute("tabindex", "0");
  setTimeout(() => {
    canvasEl.focus();
  }, 100);

  textFont(font);
  pixelDensity(2);
}

function draw() {
  appcore.update();
  appcore.draw();
}

function windowResized() {
  const canvasSize = min(windowWidth, windowHeight);
  resizeCanvas(canvasSize, canvasSize);
}

function keyPressed() {
  return appcore.handleKeyPressed(key, keyCode);
}

function keyReleased() {
  return appcore.handleKeyReleased(key, keyCode);
}

function mouseWheel(event) {
  return appcore.handleWheel(event);
}

function mouseDragged(event) {
  return appcore.handlePointer(event);
}

function mouseReleased(event) {
  return appcore.handlePointerEnd(event);
}

function touchStarted(event) {
  return appcore.handlePointer(event);
}

function touchMoved(event) {
  return appcore.handlePointer(event);
}

function touchEnded(event) {
  return appcore.handlePointerEnd(event);
}
