p5.disableFriendlyErrors = true;

let manager;
let vertShader, fragShader, colourMaps, monoFont;

const metadata = {
  name: "Fluvia",
  version: "v4.8",
  author: "@eanutt1272.v2"
};

function preload() {
  monoFont = loadFont("monaco.ttf");
  colourMaps = loadJSON("colour-maps.json");
  
  loadStrings("vert.glsl", lines => vertShader = lines.join("\n"));
  loadStrings("frag.glsl", lines => fragShader = lines.join("\n"));
}

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  createCanvas(canvasSize, canvasSize);
  
  noSmooth();
  textFont(monoFont);
  pixelDensity(1);

  manager = new Manager({
    metadata,
    vertShader,
    fragShader,
    colourMaps,
    monoFont
  });
}

function draw() {
  manager.update();
  manager.draw();
}

function keyPressed() { return manager.handleKeyPressed(key, keyCode); }
function keyReleased() { return manager.handleKeyReleased(key, keyCode); }
function mouseWheel(event) { return manager.handleWheel(event); }
function mouseDragged(event) { return manager.handlePointer(event); }
function touchStarted(event) { return manager.handlePointer(event); }
function touchMoved(event) { return manager.handlePointer(event); }
function touchEnded(event) { return manager.handlePointer(event); }

function windowResized() {
  manager.resize();
}