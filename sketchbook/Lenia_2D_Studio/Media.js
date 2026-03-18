class Media {
  constructor(appcore) {
    this.appcore = appcore;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;

    this.importInput = this._createHiddenInput("image/*", (file) => this.handleImageImport(file));
    this.dataImportInput = this._createHiddenInput(".json,application/json,text/plain", (file) => {
      if (this.pendingDataImportHandler) {
        this.pendingDataImportHandler(file);
        this.pendingDataImportHandler = null;
      }
    });
    this.pendingDataImportHandler = null;
  }

  _createHiddenInput(accept, onFile) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    input.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (file) onFile(file);
      input.value = "";
    });
    document.body.appendChild(input);
    return input;
  }

  openImportDialog() {
    this.importInput.value = "";
    this.importInput.click();
  }

  openDataImportDialog(handler) {
    this.pendingDataImportHandler = handler;
    this.dataImportInput.value = "";
    this.dataImportInput.click();
  }

  handleImageImport(file) {
    if (!file?.type.startsWith("image")) {
      console.error("Import failed: provided file is not an image");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const imgSrc = event.target.result;
      loadImage(
        imgSrc,
        (img) => {
          const { board, analyser, automaton } = this.appcore;
          const size = board.size;
          const area = size * size;

          img.resize(size, size);
          img.loadPixels();

          const pixels = img.pixels;
          if (!pixels || pixels.length < area * 4) {
            console.error("Import failed: pixel buffer incomplete");
            return;
          }

          for (let i = 0; i < area; i++) {
            const idx = i << 2;
            const brightness = (
              0.2126 * pixels[idx] +
              0.7152 * pixels[idx + 1] +
              0.0722 * pixels[idx + 2]
            ) / 255;
            board.cells[i] = brightness;
          }

          board.potential.fill(0);
          board.field.fill(0);
          if (board.fieldOld) board.fieldOld.fill(0);

          automaton.reset();
          analyser.resetStatistics();
          analyser.reset();

          this.appcore.refreshGUI();
          console.log(`Imported image into Lenia board: ${size}x${size}`);
        },
        (err) => console.error("Import failed: load error", err),
      );
    };

    reader.readAsDataURL(file);
  }

  startRecording() {
    if (this.isRecording) return;

    const sourceCanvas = _renderer?.elt;
    if (!sourceCanvas) {
      console.error("No valid canvas found");
      return;
    }

    this.recordedChunks = [];
    const types = ["video/webm;codecs=vp8", "video/mp4", "video/webm"];
    const supportedType = types.find((t) => MediaRecorder.isTypeSupported(t));

    if (!supportedType) {
      console.error("No supported video format found");
      return;
    }

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
      this.appcore.refreshGUI();
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
    this.appcore.refreshGUI();
  }

  exportImage() {
    save(_renderer, this._getFilename(this.appcore.params.imageFormat));
  }

  exportWorldJSON() {
    const data = this.appcore.board.toJSON();
    if (!data) return;
    this._downloadJSON(data, this._getFilename("world.json"));
     console.log(`[Lenia] Exported world JSON: size=${this.appcore.board.size}`);
  }

  importWorldJSON() {
    this.openDataImportDialog((file) => {
      this._readJSONFile(file, (data) => {
        if (!data || typeof data !== "object" || !data.cells) {
          throw new Error("Invalid world JSON payload");
        }

        const importedBoard = Board.fromJSON(data);
        const newSize = importedBoard.size || this.appcore.params.gridSize;

        if (newSize !== this.appcore.params.gridSize) {
          this.appcore.params.gridSize = newSize;
          this.appcore.changeResolution();
        }

         this.appcore._ensureBuffers();
         this.appcore.board.cells.set(importedBoard.cells.subarray(0, this.appcore.board.cells.length));
        this.appcore.board.potential.fill(0);
        this.appcore.board.field.fill(0);
        if (this.appcore.board.fieldOld) this.appcore.board.fieldOld.fill(0);

        this.appcore.analyser.resetStatistics();
        this.appcore.analyser.reset();
        this.appcore.automaton.reset();
        this.appcore.refreshGUI();
         this.appcore._workerSendKernel();
         console.log(`[Lenia] Imported world JSON: size=${newSize}`);
      });
    });
  }

  exportStatisticsCSV() {
    const csv = this.appcore.analyser.exportCSV();
    if (!csv) return;
    this._downloadText(csv, this._getFilename("stats.csv"), "text/csv");
     console.log(`[Lenia] Exported statistics CSV`);
  }

  exportStatisticsJSON() {
    const payload = {
      metadata: this.appcore.metadata,
      statistics: { ...this.appcore.statistics },
      series: Array.isArray(this.appcore.analyser.series) ? this.appcore.analyser.series : [],
      exportedAt: new Date().toISOString(),
    };
    this._downloadJSON(payload, this._getFilename("stats.json"));
     console.log(`[Lenia] Exported statistics JSON: ${this.appcore.analyser.series.length} rows`);
  }

  exportParamsJSON() {
    const payload = {
      metadata: this.appcore.metadata,
      params: JSON.parse(JSON.stringify(this.appcore.params)),
      exportedAt: new Date().toISOString(),
    };
    this._downloadJSON(payload, this._getFilename("params.json"));
     console.log(`[Lenia] Exported params JSON`);
  }

  importParamsJSON() {
    this.openDataImportDialog((file) => {
      this._readJSONFile(file, (data) => {
        if (!data || typeof data !== "object" || !data.params) {
          throw new Error("Invalid params JSON payload");
        }

        const incoming = data.params;
        const target = this.appcore.params;
        const oldSize = target.gridSize;

        const allowed = [
          "running", "gridSize", "R", "T", "m", "s", "b", "kn", "gn",
          "softClip", "multiStep", "addNoise", "maskRate", "paramP", "colourMap",
          "displayMode", "renderGrid", "renderScale", "renderLegend", "renderStats",
          "renderMotionOverlay", "renderKeymapRef", "selectedAnimal", "placeMode", "imageFormat",
        ];

        for (const key of allowed) {
          if (key in incoming) target[key] = incoming[key];
        }

        if (target.gridSize !== oldSize) {
          this.appcore.changeResolution();
        }

        this.appcore.updateAutomatonParams();
        this.appcore.refreshGUI();
        console.log(`[Lenia] Imported params JSON`);
      });
    });
  }

  _readJSONFile(file, onSuccess) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        onSuccess(parsed);
      } catch (err) {
        console.error("JSON import failed:", err);
      }
    };
    reader.onerror = () => console.error("File read failed");
    reader.readAsText(file);
  }

  _downloadJSON(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    this._triggerDownload(URL.createObjectURL(blob), filename);
  }

  _downloadText(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    this._triggerDownload(URL.createObjectURL(blob), filename);
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
    const { name, version } = this.appcore.metadata;
    const { displayMode, gridSize } = this.appcore.params;
    const ts = Date.now();
    return `${name}_${version}_${displayMode}_${gridSize}_${ts}.${extension}`;
  }
}
