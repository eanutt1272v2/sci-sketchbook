const SOFTWARE_VERSION = "3.6";

let terrainGrid, dataManager, erosionEngine, renderer, gui;

const params = {
  isSimulationRunning: true,
  dropletsPerFrame: 256,
  dropletMaxAge: 256,
  dropletMinVolume: 0.01,

  gridSize: 256,
  noiseScale: 0.6,
  noiseOctaves: 8,
  amplitudeFalloff: 0.6,
  terrainHeight: 1,

  depositionRate: 0.1,
  evaporationRate: 0.001,
  precipitationRate: 1.0,
  entrainment: 5.0,
  gravity: 1.0,
  momentumTransfer: 1,

  dischargeLearningRate: 0.1,
  cascadeMaxDiff: 0.01, // TODO: VAR RENAME
  cascadeSettling: 0.8, // TODO: VAR RENAME

  renderMode: "composite",
  flatColour: { r: 50, g: 81, b: 33 },
  steepColour: { r: 115, g: 115, b: 95 },
  waterColour: { r: 30, g: 80, b: 150 },
  lightDirection: { x: -50, y: 50, z: -50 },
  surfaceNormalExaggeration: 50,

  generateNewTerrain: () => generateNewTerrain(),
  resetCurrentTerrain: () => resetCurrentTerrain(),
};

const statistics = {
  fps: 0,
};

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  createCanvas(canvasSize, canvasSize);

  pixelDensity(1);
  //noSmooth();
  
  p5.displayFriendlyErrors = false;

  initialiseSimulation();
  
  gui.setupTabs();
}

function draw() {
  if (params.isSimulationRunning) {
    terrainGrid.dischargeTrack.fill(0);
    terrainGrid.momentumXTrack.fill(0);
    terrainGrid.momentumYTrack.fill(0);

    erosionEngine.simulateHydraulicErosion();
    erosionEngine.updateDischargeMap();
  }

  renderer.render();
  dataManager.updateStatistics();
}

function windowResized() {
  const canvasSize = min(windowWidth, windowHeight);
  resizeCanvas(canvasSize, canvasSize);
}


function initialiseSimulation() {
  terrainGrid = new TerrainGrid(params.gridSize, params);
  dataManager = new DataManager(terrainGrid, params, statistics, SOFTWARE_VERSION);
  erosionEngine = new ErosionEngine(terrainGrid, params);
  renderer = new Renderer(terrainGrid, params);
  gui = new GUI(params, statistics, dataManager, renderer, SOFTWARE_VERSION, {
    onInitialise: initialiseSimulation,
    onGenerate: generateNewTerrain,
    onReset: resetCurrentTerrain
  });

  terrainGrid.generate();
}

function generateNewTerrain() {
  if (terrainGrid.size !== params.gridSize) {
    initialiseSimulation();
    return;
  }

  terrainGrid.generate();
}

function resetCurrentTerrain() {
  terrainGrid.reset();
}