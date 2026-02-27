class Media {
  constructor(terrain, renderer, metadata, params) {
    this.terrain = terrain;
    this.renderer = renderer;
    this.metadata = metadata;
    this.params = params;

    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
  }

  _triggerDownload(url, filename) {
    const anchor = document.createElement("a");
    anchor.style.display = "none";
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    
    setTimeout(() => {
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    }, 100);
  }

  startRecording() {
    if (this.isRecording) return;

    const { terrainSize, surfaceMap, displayMethod } = this.params;
    const { name, version } = this.metadata;
    
    const sourceCanvas = displayMethod === "3D" ? this.renderer.canvas3D.elt : canvas;

    this.recordedChunks = [];
    
    const supportedType = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/mp4",
      "video/webm",
    ].find(type => MediaRecorder.isTypeSupported(type)) || "";

    try {
      const stream = sourceCanvas.captureStream(60);
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: supportedType,
        videoBitsPerSecond: 8000000,
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: supportedType });
        const extension = supportedType.includes("mp4") ? "mp4" : "webm";
        const filename = `${name}_${version}_${displayMethod}_${surfaceMap}_${terrainSize}px_${Date.now()}.${extension}`;
        
        this._triggerDownload(URL.createObjectURL(blob), filename);
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      console.log(`Recording started: ${supportedType}`);
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
  }

  exportCanvas() {
    const { terrainSize, surfaceMap, displayMethod } = this.params;
    const { name, version } = this.metadata;
    const timestamp = Date.now();
    
    const filename = `${name}_${version}_${displayMethod}_${surfaceMap}_${terrainSize}px_${timestamp}`;

    if (displayMethod === "3D") {
      save(this.renderer.canvas3D, `${filename}.png`);
    } else {
      save(this.renderer.canvas2D, `${filename}.png`);
    }
    
    console.log(`Exported canvas: ${filename}.png`);
  }

  handleImport(file) {
    if (file.type !== "image") return;

    loadImage(file.data, (imageSource) => {
      const { size, area, heightMap, bedrockMap, originalHeightMap, sedimentMap } = this.terrain;
		const { terrain } = this.terrain;
		
      imageSource.resize(terrain.size, terrain.size);
      imageSource.loadPixels();

      for (let i = 0; i < area; i++) {
        const pixelOffset = i * 4;
        
        const r = imageSource.pixels[pixelOffset];
        const g = imageSource.pixels[pixelOffset + 1];
        const b = imageSource.pixels[pixelOffset + 2];
        
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

        heightMap[i] = brightness;
        bedrockMap[i] = brightness;
        originalHeightMap[i] = brightness;
        sedimentMap[i] = 0;
      }
      
      if (terrain.resetSimulation) {
        terrain.resetSimulation();
      }
      
      console.log(`Heightmap imported and scaled to ${terrain.size}px`);
    });
  }
}