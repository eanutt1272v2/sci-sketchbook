const config = {
  n: 3, l: 2, m: 0,
  resolution: 512,
  viewRadius: 32.0,
  sliceY: 0.0,
  exposure: 0.75,
  colourMap: "rocket",
  orbitalNotation: "",
  displayData: true,
};

let solver, renderer, gui;

async function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  createCanvas(canvasSize, canvasSize);
  
  pixelDensity(1);
  noSmooth();
  p5.displayFriendlyErrors = false;
  p5.displayFriendly = false;
  
  solver = new Solver();
  renderer = new Renderer(solver, config);
  await renderer.loadMaps('colour-maps.json');
  gui = new GUI(config, () => renderer.update());
  gui.initialise(Object.keys(renderer.maps));
}

function draw() {
  background(0);
  renderer.display();
}

function windowResized() {
  const canvasSize = min(windowWidth, windowHeight)
  resizeCanvas(canvasSize, canvasSize);
}