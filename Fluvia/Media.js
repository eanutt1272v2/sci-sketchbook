class Media {
  constructor(manager) {
    this.m = manager;

    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;

    this.importInput = document.createElement("input");
    this.importInput.type = "file";
    this.importInput.accept = "image/*";
    this.importInput.style.display = "none";

    this.importInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (file) this.handleImport(file);
    });

    document.body.appendChild(this.importInput);
  }

  openImportDialog() {
    console.warn("WARNING: This feature is currently unstable.");
    this.importInput.value = "";
    this.importInput.click();
  }

  handleImport(file) {
    if (!file?.type.startsWith("image")) {
      console.error("Import failed: provided file is not an image");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const imgSrc = event.target.result;

      loadImage(imgSrc, (img) => {
        try {
          const { terrain } = this.m;
          const { size, area, heightMap, bedrockMap, originalHeightMap, sedimentMap } = terrain;

          if (!img) throw new Error("loadImage returned null");

          img.resize(size, size);
          img.loadPixels();

          const { pixels } = img;
          if (!pixels || pixels.length < area * 4) throw new Error("pixel buffer incomplete");

          for (let i = 0; i < area; i++) {
            const idx = i << 2;

            const brightness = (
              0.2126 * pixels[idx]     +
              0.7152 * pixels[idx + 1] +
              0.0722 * pixels[idx + 2]
            ) / 255;

            heightMap[i] = bedrockMap[i] = originalHeightMap[i] = brightness;
            sedimentMap[i] = 0;
          }

          terrain.reset();
          console.log(`Heightmap imported: ${size}×${size}`);
        } catch (err) {
          console.error("Import failed during processing:", err);
        }
      }, (err) => console.error("Import failed: load error", err));
    };

    reader.readAsDataURL(file);
  }

  startRecording() {
    if (this.isRecording) return;

    const sourceCanvas = _renderer.elt;
    if (!sourceCanvas) return console.error("No valid canvas found");

    this.recordedChunks = [];

    const types = ["video/webm;codecs=vp8", "video/mp4", "video/webm"];
    const supportedType = types.find(t => MediaRecorder.isTypeSupported(t));

    if (!supportedType) return console.error("No supported video format found");

    try {
      const stream = sourceCanvas.captureStream(60);
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: supportedType,
        videoBitsPerSecond: 8000000,
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.recordedChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: supportedType });
        const ext = supportedType.includes("mp4") ? "mp4" : "webm";
        this._triggerDownload(URL.createObjectURL(blob), this._getFilename(ext));
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      console.log(`Recording: ${supportedType}`);
    } catch (err) {
      console.error("Recording failed:", err);
      this.stopRecording();
    }
  }

  stopRecording() {
    if (!this.mediaRecorder || !this.isRecording) return;
    this.mediaRecorder.stop();
    this.isRecording = false;
    this.recordedChunks = [];
  }

  exportImage() {
    const { imageFormat } = this.m.params;
    try {
      const filename = this._getFilename(imageFormat);
      save(_renderer, filename);
      console.log(`Exported: ${filename}`);
    } catch (err) {
      console.error(`Export failed: ${err}`);
    }
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
      URL.revokeObjectURL(url);
    }, 100);
  }

  _getFilename(extension) {
    const { terrainSize, surfaceMap, displayMethod } = this.m.params;
    const { name, version } = this.m.metadata;
    const ts = Date.now();

    return `${name}_${version}_${displayMethod}_${surfaceMap}_${terrainSize}_${ts}.${extension}`;
  }
}