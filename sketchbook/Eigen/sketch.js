

p5.disableFriendlyErrors = true;

let manager;
let colourMaps, font;

const metadata = {
  name: "Eigen",
  version: "v2.0.0",
  author: "@eanutt1272.v2"
};

function preload() {
  colourMaps = loadJSON("colour-maps.json");
  font = loadFont("monaco.ttf");
}

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  const mainCanvas = createCanvas(canvasSize, canvasSize);

  setupCanvasProperties(mainCanvas);

  manager = new Manager({
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
  manager.update();
  manager.draw();
}

function windowResized() {
  const canvasSize = min(windowWidth, windowHeight);
  resizeCanvas(canvasSize, canvasSize);
}

function keyPressed() {
  return manager.handleKeyPressed(key, keyCode);
}

function keyReleased() {
  return manager.handleKeyReleased(key, keyCode);
}

function mouseWheel(event) {
  return manager.handleWheel(event);
}

function mouseDragged(event) {
  return manager.handlePointer(event);
}

function mouseReleased(event) {
  return manager.handlePointerEnd(event);
}

function touchStarted(event) {
  return manager.handlePointer(event);
}

function touchMoved(event) {
  return manager.handlePointer(event);
}

function touchEnded(event) {
  return manager.handlePointerEnd(event);
}
