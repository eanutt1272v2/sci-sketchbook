p5.disableFriendlyErrors = true;

let appcore;
let font, animalsData;
let mainCanvas;

const metadata = {
  name: "Lenia2D Studio",
  version: "v1.0.0-dev",
  author: "@eanutt1272.v2"
};

function preload() {
  font = loadFont("monaco.ttf");
  animalsData = loadJSON("animals.json");
}

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  mainCanvas = createCanvas(canvasSize, canvasSize);

  setupCanvasProperties();

  appcore = new AppCore({
    metadata,
    animalsData,
    font
  });

  appcore.setup();
}

function draw() {
  appcore.draw();
}

function setupCanvasProperties() {
  const canvasEl = mainCanvas.elt;
  canvasEl.setAttribute("tabindex", "0");

  setTimeout(() => {
    canvasEl.focus();
  }, 100);

  noSmooth();
  textFont(font);
  pixelDensity(1);
}


function stepOnce() {
  appcore.stepOnce();
}

function clearWorld() {
  appcore.clearWorld();
}

function randomiseWorld() {
  appcore.randomiseWorld();
}

function changeResolution() {
  appcore.changeResolution();
}

function loadAnimal(animal) {
  appcore.loadAnimal(animal);
}

function loadSelectedAnimal() {
  appcore.loadSelectedAnimal();
}

function placeAnimal(cellX, cellY) {
  appcore.placeAnimal(cellX, cellY);
}

function loadFirstAnimal() {
  appcore.loadFirstAnimal();
}

function canvasInteraction(e) {
  return appcore.canvasInteraction(e);
}

function mouseClicked(e) {
  return appcore.handleMouseClicked(e);
}

function windowResized() {
  appcore.windowResized();
}

function keyPressed() {
  return appcore.handleKeyPressed(key || event.key, keyCode);
}

function keyReleased() {
  return appcore.handleKeyReleased(key || event.key, keyCode);
}

function downloadFile(content, filename, mimeType) {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:' + mimeType + ';charset=utf-8,' + encodeURIComponent(content));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}