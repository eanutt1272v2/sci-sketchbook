p5.displayFriendlyErrors = false;

let terrain, solver, renderer, media, gui, vertShader, fragShader, colourMaps;

const metadata = {
  name: "Fluvia",
  version: "v4.1",
  author: "@eanutt1272.v2"
}

const params = {
  vertShaderSrc: "vert.glsl",
  fragShaderSrc: "frag.glsl",
  colourMapSrc: "colour-maps.json",

  running: true,
  dropletsPerFrame: 256,
  maxAge: 500,
  minVolume: 0.01,

  terrainSize: 256,
  noiseScale: 0.6,
  noiseOctaves: 8,
  amplitudeFalloff: 0.6,

  sedimentErosionRate: 0.1,
  bedrockErosionRate: 0.1,
  depositionRate: 0.1,
  evaporationRate: 0.001,
  precipitationRate: 1,

  entrainment: 2,
  gravity: 1,
  momentumTransfer: 1,

  learningRate: 0.1,
  maxHeightDiff: 0.01,
  settlingRate: 0.8,

  displayMethod: "3D",
  surfaceMap: "composite",
  colourMap: "greyscale",

  heightScale: 100,

  skyColour: { r: 173, g: 183, b: 196 },
  steepColour: { r: 115, g: 115, b: 95 },
  flatColour: { r: 50, g: 81, b: 33 },
  sedimentColour: { r: 201, g: 189, b: 117 },
  waterColour: { r: 92, g: 133, b: 142 },

  lightDir: { x: 50, y: 50, z: -50 },
  specularIntensity: 100
};

const statistics = {
  fps: 0
}

const cameraData = {
  rotX: Math.PI / 4,
  rotZ: 0,
  zoom: 750
};

const gestureData = {
  mode: null,
  pinchStartDist: 0,
  pinchLastDist: 0,
  prevX: 0,
  prevY: 0
};

function preload() {
  const {
    colourMapSrc,
    vertShaderSrc,
    fragShaderSrc
  } = params;

  colourMaps = loadJSON(colourMapSrc);
  vertShader = loadStrings(vertShaderSrc);
  fragShader = loadStrings(fragShaderSrc);
}

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  createCanvas(canvasSize, canvasSize);

  noSmooth();
  pixelDensity(1);

  vertShader = vertShader.join("\n");
  fragShader = fragShader.join("\n");

  initialiseClasses(true);

  terrain.generate();
  gui.setupTabs();
}

function draw() {
  if (params.running) {
    solver.hydraulicErosion();
    solver.updateDischargeMap();
  }

  renderer.render();
  statistics.fps = frameRate();
}

function initialiseClasses(initialiseGUI) {
  terrain = new Terrain(params);
  solver = new Solver(terrain, params);
  renderer = new Renderer(terrain, params, cameraData, gestureData, vertShader, fragShader, colourMaps);
  media = new Media(terrain, renderer, metadata, params);

  if (initialiseGUI) {
    gui = new GUI(renderer, media, metadata, params, statistics, cameraData, Object.keys(colourMaps), {
      onGenerate: generateTerrain,
      onReset: resetTerrain
    });
  }
}

function generateTerrain() {	
  if (terrain.size !== params.terrainSize) {
    initialiseClasses(false);
  }

  terrain.generate();
}

function resetTerrain() {
  terrain.reset();
}

function mouseDragged(e) {
  if (canvasInteraction(e)) {
    renderer.handlePointer(e);
    return false;
  }
}

function mouseWheel(e) {
  if (canvasInteraction(e)) {
    renderer.handleWheel(e);
    return false;
  }
}

function touchStarted(e) {
  if (canvasInteraction(e)) {
    renderer.handlePointer(e);
    return false;
  }
}

function touchMoved(e) {
  if (canvasInteraction(e)) {
    renderer.handlePointer(e);
    return false;
  }
}

function touchEnded(e) {
  if (canvasInteraction(e)) {
    renderer.handlePointer(e);
    return false;
  }
}

function canvasInteraction(e) {
  return e.target && 
	      params.displayMethod === "3D" && 
	      !e.target.closest(".tp-dfwv");
}

function windowResized() {
  renderer.resize();
}