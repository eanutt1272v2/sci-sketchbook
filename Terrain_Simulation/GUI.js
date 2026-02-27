class GUI {
  constructor(renderer, media, metadata, params, statistics, cameraData, colourMaps, callbacks) {
    this.renderer = renderer;
    this.media = media;	  
	 this.metadata = metadata;
    this.params = params;
	 this.statistics = statistics;	  
    this.cameraData = cameraData;
	 this.colourMaps = colourMaps;  
    this.callbacks = callbacks;

    this.pane = new Tweakpane.Pane({
      title: `${this.metadata.name} ${this.metadata.version} by ${this.metadata.author}`,
      expanded: true,
    });
  }

  setupTabs() {
    const tabs = this.pane.addTab({
      pages: [
        { title: "General" },
        { title: "Erosion" },
        { title: "Visuals" },
        { title: "Media" },
      ],
    });

    this.createGeneralTab(tabs.pages[0]);
    this.createErosionTab(tabs.pages[1]);
    this.createVisualTab(tabs.pages[2]);
    this.createMediaTab(tabs.pages[3]);
  }

  createGeneralTab(page) {
    const { params, statistics, callbacks } = this;

    page.addButton({ title: "Generate Terrain" }).on("click", callbacks.onGenerate);
    page.addButton({ title: "Reset Terrain" }).on("click", callbacks.onReset);
    
    page.addBlade({ view: "separator" });

	 page.addBinding(statistics, "fps", {
      readonly: true,
      label: "FPS",
      view: "graph",
      interval: 60,
      min: 0,
      max: 100,
    });

	 page.addBinding(statistics, "fps", {
	   label: "",
      readonly: true
    });

    page.addBlade({ view: "separator" });
    
    page.addBinding(params, "running", { label: "Running" });
    
    page.addBinding(params, "dropletsPerFrame", {
      label: "Droplets/Frame",
      min: 0,
      max: 512,
      step: 1,
    });

    page.addBinding(params, "maxAge", {
      label: "Maximum Age",
      min: 128,
      max: 512,
      step: 1,
    });

    page.addBinding(params, "minVolume", {
      label: "Minimum Volume",
      min: 0.001,
      max: 0.1,
      step: 0.001,
    });

    const genFolder = page.addFolder({ title: "Terrain Generation" });
    
    genFolder.addBinding(params, "terrainSize", {
      label: "Terrain Size",
      options: { "128×128": 128, "256×256": 256, "512×512": 512 },
    });
    
    genFolder.addBinding(params, "noiseScale", { label: "Noise Scale", min: 0.1, max: 5 });
    genFolder.addBinding(params, "noiseOctaves", { label: "Noise Octaves", min: 1, max: 12, step: 1 });
  }

  createErosionTab(page) {
    const { params } = this;

    const hydraulic = page.addFolder({ title: "Hydraulic Erosion" });
    
    const hSettings = [
      { key: "sedimentErosionRate", label: "Sediment Erosion", min: 0, max: 1 },
      { key: "bedrockErosionRate", label: "Bedrock Erosion", min: 0, max: 1 },
      { key: "depositionRate", label: "Deposition", min: 0, max: 1 },
      { key: "evaporationRate", label: "Evaporation", min: 0.001, max: 1, step: 0.001 },
      { key: "precipitationRate", label: "Precipitation", min: 0, max: 5 },
      { key: "entrainment", label: "Entrainment", min: 0, max: 32 },
      { key: "gravity", label: "Gravity", min: 0.1, max: 5 },
      { key: "momentumTransfer", label: "Momentum Transfer", min: 0, max: 4 },
      { key: "learningRate", label: "Learning Rate", min: 0, max: 0.5 }
    ];

    hSettings.forEach(s => hydraulic.addBinding(params, s.key, s));

    page.addBlade({ view: "separator" });

    const thermal = page.addFolder({ title: "Thermal Erosion" });
    
    thermal.addBinding(params, "maxHeightDiff", { label: "Maximum Height Difference", min: 0.01, max: 1 });
    thermal.addBinding(params, "settlingRate", { label: "Settling Rate", min: 0, max: 1 });
  }

  createVisualTab(page) {
    const { params, colourMaps } = this;

    page.addBinding(params, "displayMethod", {
      label: "Display Method",
      options: { "3D Perspective": "3D", "2D Orthogonal": "2D" },
    });
    
    page.addBinding(params, "surfaceMap", {
      label: "Surface Map",
      options: {
        "Composite View": "composite",
        "Height Map": "height",
        "Slope/Steepness": "slope", 
        "Water Discharge": "discharge",
        "Sediment Level": "sediment",
        "Erosion Delta": "delta", 
       },
    });

	 page.addBinding(params, "colourMap", {
      options: colourMaps.reduce((obj, name) => {
        obj[name.charAt(0).toUpperCase() + name.slice(1)] = name;
        return obj;
      }, {}),
      label: "Data Colour Map",
    })
     
    page.addBinding(params, "heightScale", { label: "Height Scale", min: 0, max: 256 });

    const lightFolder = page.addFolder({ title: "Lighting" });
    
    lightFolder.addBinding(params, "lightDir", {
      label: "Light Direction",
      x: { min: -100, max: 100 },
      y: { min: -100, max: 100 },
      z: { min: -100, max: 100 },
    });

    lightFolder.addBinding(params, "specularIntensity", {
      label: "Water Specular Intensity",
      min: 0.01,
      max: 1024,
    });
    
    page.addBlade({ view: "separator" });

    const colourFolder = page.addFolder({ title: "Colours" });

    colourFolder.addBinding(params, "skyColour", { label: "Sky" });
    colourFolder.addBinding(params, "steepColour", { label: "Steep Slopes" });
    colourFolder.addBinding(params, "flatColour", { label: "Flat Plains" });
    colourFolder.addBinding(params, "sedimentColour", { label: "Sediment" });
    colourFolder.addBinding(params, "waterColour", { label: "Water" });
  }

  createMediaTab(page) {
    const { media } = this;

    const impFolder = page.addFolder({ title: "Import" });
    
    impFolder.addButton({ title: "Import Heightmap" }).on("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";

      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (re) => {
          media.handleImport({ type: "image", data: re.target.result });
        };
        reader.readAsDataURL(file);
      };
      input.click();
    });
    
    const expFolder = page.addFolder({ title: "Export" });
    
    const recBtn = expFolder.addButton({
      title: media.isRecording ? "Stop Recording" : "Start Recording"
    });
    
    recBtn.on("click", () => {
      if (!media.isRecording) {
        media.startRecording();
        recBtn.title = "Stop Recording";
      } else {
        media.stopRecording();
        recBtn.title = "Start Recording";
      }
    });
    
    expFolder.addBlade({ view: "separator" });
    
    expFolder.addButton({ title: "Export Canvas" }).on("click", () => {
      media.exportCanvas();
    });
  }
}