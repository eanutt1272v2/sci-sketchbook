
/**
 * @file GUI.js
 * @author @eanutt1272.v2
 * @version 1.0.0
 */
class GUI {
  constructor(params, statistics, dataManager, renderer, softwareVersion, callbacks) {
    this.params = params;
    this.stats = statistics;
    this.dataManager = dataManager;
    this.renderer = renderer;
    this.version = softwareVersion;
    this.callbacks = callbacks;

    this.pane = new Tweakpane.Pane({
      title: `Fluvia ${this.version}`,
    });
  }

  setupTabs() {
    const tabs = this.pane.addTab({
      pages: [
        { title: "General" },
        { title: "Erosion" },
        { title: "Visuals" },
        { title: "Data" },
      ],
    });

    this.createGeneralTab(tabs.pages[0]);
    this.createErosionTab(tabs.pages[1]);
    this.createVisualTab(tabs.pages[2]);
    this.createDataTab(tabs.pages[3]);
  }

  createGeneralTab(page) {
    page.addButton({
      title: "Generate New Terrain" 
    }).on("click", this.callbacks.onGenerate);
    
    page.addButton({
      title: "Reset Current Terrain"
    }).on("click", this.callbacks.onReset);
      
    page.addBlade({ view: "separator" });
        
    page.addBinding(this.stats, 'fps', {
      readonly: true,
      label: 'Live FPS',
      view: 'graph',
      interval: 60,
      min: 0,
      max: 100,
    });

    page.addBlade({ view: "separator" });
    
    page.addBinding(this.params, "isSimulationRunning", {
      label: "Simulation Running"
    });
    
    page.addBinding(this.params, "dropletsPerFrame", {
      label: "Droplets/Frame",
      min: 0,
      max: 512,
      step: 1,
    });

    page.addBinding(this.params, "dropletMaxAge", {
      label: "Max Droplet Age",
      min: 128,
      max: 512,
      step: 1,
    });

    page.addBinding(this.params, "dropletMinVolume", {
      label: "Minimum Droplet Volume",
      min: 0.001,
      max: 0.1,
      step: 0.001,
    });

    const terrainGenerationFolder = page.addFolder({
      title: "Terrain Generation",
    });
    
    terrainGenerationFolder.addBinding(this.params, "gridSize", {
      label: "Grid Size",
      options: { "128×128": 128, "256×256": 256, "512×512": 512 },
    });
    
    terrainGenerationFolder.addBinding(this.params, "noiseScale", {
      label: "Noise Scale",
      min: 0.1,
      max: 5,
    });

    terrainGenerationFolder.addBinding(this.params, "noiseOctaves", {
      label: "Noise Octaves",
      min: 1,
      max: 12,
      step: 1,
    });

    terrainGenerationFolder.addBinding(this.params, "terrainHeight", {
      label: "Terrain Height",
      min: 1,
      max: 16,
    });
  }

  createErosionTab(page) {
    const hydraulicErosionFolder = page.addFolder({
      title: "Hydraulic Erosion"
    });
    
    hydraulicErosionFolder.addBinding(this.params, "depositionRate", {
      label: "Deposition Rate",
      min: 0.01,
      max: 1,
    });
    
    hydraulicErosionFolder.addBinding(this.params, "evaporationRate", {
      label: "Evaporation Rate",
      min: 0.001,
      max: 1,
      step: 0.001,
    });

    hydraulicErosionFolder.addBinding(this.params, "precipitationRate", {
      label: "Precipitation Rate",
      min: 0,
      max: 5,
    });

    hydraulicErosionFolder.addBinding(this.params, "entrainment", {
      label: "Entrainment",
      min: 0,
      max: 32,
    });

    hydraulicErosionFolder.addBinding(this.params, "gravity", {
      label: "Gravity",
      min: 0.1,
      max: 5,
    });

    hydraulicErosionFolder.addBinding(this.params, "momentumTransfer", {
      label: "Momentum Transfer",
      min: 0,
      max: 4,
    });

    hydraulicErosionFolder.addBinding(this.params, "dischargeLearningRate", {
      label: "Discharge Learning Rate",
      min: 0.01,
      max: 0.5,
    });

    page.addBlade({ view: "separator" });

    const thermalErosionFolder = page.addFolder({
      title: "Thermal Erosion/Slope Stability"
    });
    
    thermalErosionFolder.addBinding(this.params, "cascadeMaxDiff", {
      label: "Maximum Height Difference",
      min: 0.01,
      max: 1,
    });
    
    thermalErosionFolder.addBinding(this.params, "cascadeSettling", {
      label: "Settling Rate",
      min: 0.1,
      max: 2,
    });
  }

  createVisualTab(page) {
    page.addBinding(this.params, "renderMode", {
      label: "Render Mode",
      options: {
        "Composite (Satellite)": "composite",
        "Height (Topography)": "height",
        "Delta (Erosion & Deposition)": "delta",
        "Slope (Steepness)": "slope",
        "Discharge (Flow)": "discharge",
      },
    });

    const lightingFolder = page.addFolder({
      title: "Lighting"
    });
    
    lightingFolder.addBinding(this.params, "lightDirection", {
      label: "Light Direction",
      x: { min: -100, max: 100 },
      y: { min: -100, max: 100 },
      z: { min: -100, max: 100 },
    });
    
    lightingFolder.addBinding(this.params, "surfaceNormalExaggeration", {
      label: "Surface Normals",
      min: 1,
      max: 128,
    });
    
    page.addBlade({ view: "separator" });

    const colourFolder = page.addFolder({
      title: "Colours",
    });
    
    colourFolder.addBinding(this.params, "flatColour", {
      label: "Flat Plains"
    });
    
    colourFolder.addBinding(this.params, "steepColour", {
      label: "Steep Slopes"
    });
    
    colourFolder.addBinding(this.params, "waterColour", {
      label: "Water"
    });
  }

  createDataTab(page) {
    const importFolder = page.addFolder({
      title: "Import",
    });
    
    importFolder.addButton({
      title: "Import Heightmap (Image)"
    }).on("click", () => {
      const input = createFileInput(file => 
        this.dataManager.handleImageImport(file, this.callbacks.onInitialise)
      );
      input.elt.click();
      input.hide();
    });
    
    const exportFolder = page.addFolder({
      title: "Export",
    });
    
    const recordButton = exportFolder.addButton({
      title: "Start Recording (WebM)"
    });
    
    recordButton.on("click", () => {
      if (!this.dataManager.isRecording) {
        this.dataManager.startRecording(document.querySelector('canvas'));
        recordButton.title = "Stop Recording & Download";
      } else {
        this.dataManager.stopRecording();
        recordButton.title = "Start Recording (WebM)";
      }
    });
    
    exportFolder.addBlade({ view: "separator" });
    
    exportFolder.addButton({
      title: "Export Current View (PNG)"
    }).on("click", () => {
      this.dataManager.exportCurrentView(this.renderer.canvas);
    });
    
    exportFolder.addButton({
      title: "Export Raw Heightmap Data (CSV)"
    }).on("click", () => {
      this.dataManager.exportCSV();
    });
  }
}