
/**
 * @file DataManager.js
 * @author @eanutt1272.v2
 * @version 1.0.0
 */
class DataManager {
  constructor(grid, params, statistics, softwareVersion) {
    this.grid = grid;
    this.params = params;
    this.statistics = statistics;
    this.version = softwareVersion;

    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
  }
  
  updateStatistics() {
    this.statistics.fps = frameRate();
  }

  startRecording(canvasElement) {
    const { gridSize, renderMode } = this.params;
    
    this.recordedChunks = [];
    const stream = canvasElement.captureStream(60);
    const types = ["video/webm;codecs=vp8", "video/webm", "video/mp4"];

    let supportedType = types.find(type => MediaRecorder.isTypeSupported(type)) || "";

    if (!supportedType) {
      console.error("No supported MediaRecorder format found.");
      return;
    }

    try {
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: supportedType });
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.recordedChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: supportedType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ext = supportedType.includes("mp4") ? "mp4" : "webm";
        a.download = `Fluvia_v${this.version}_Recording_${renderMode}_${gridSize}x${gridSize}.${ext}`;
        a.click();
        window.URL.revokeObjectURL(url);
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      console.log(`Recording started: ${supportedType}`);
    } catch (e) {
      console.error("Recorder Error:", e);
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
  }

  exportCurrentView(canvas) {
    const { gridSize, renderMode } = this.params;
    let exportResult = createImage(gridSize, gridSize);
    
    exportResult.loadPixels();
    
    canvas.loadPixels();
    for (let i = 0; i < canvas.pixels.length; i++) {
      exportResult.pixels[i] = canvas.pixels[i];
    }
    
    exportResult.updatePixels();
    exportResult.save(`Fluvia_v${this.version}_${renderMode}_${gridSize}x${gridSize}`, "png");
  }

  exportCSV() {
    let csv = "";
    const gridSize = this.params.gridSize;
    
    for (let y = 0; y < gridSize; y++) {
      let row = [];
      for (let x = 0; x < gridSize; x++) {
        row.push(this.grid.heightMap[y * gridSize + x].toFixed(4));
      }
      csv += row.join(",") + "\n";
    }
    
    saveStrings([csv], `Fluvia_v${this.version}_Raw_Data_${gridSize}x${gridSize}.csv`);
  }

  handleImageImport(file, onComplete) {
    if (file.type !== "image") return;

    loadImage(file.data, (importImage) => {
      importImage.loadPixels();

      this.params.gridSize = importImage.width;
      onComplete(); 

      for (let i = 0; i < this.grid.area; i++) {
        let redChannel = importImage.pixels[i * 4];
        let greenChannel = importImage.pixels[i * 4 + 1];
        let blueChannel = importImage.pixels[i * 4 + 2];
        let valueChannel = (redChannel + greenChannel + blueChannel) / 3 / 255;

        this.grid.heightMap[i] = valueChannel;
        this.grid.originalHeightMap[i] = valueChannel;
      }
    });
  }
}