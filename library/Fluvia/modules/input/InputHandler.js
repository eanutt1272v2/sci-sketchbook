class InputHandler {
  constructor(appcore) {
    this.appcore = appcore;
    this._diagnosticsLogger =
      appcore?._diagnosticsLogger ||
      (typeof AppDiagnostics !== "undefined" &&
      typeof AppDiagnostics.resolveLogger === "function"
        ? AppDiagnostics.resolveLogger("Fluvia")
        : { info() {}, warn() {}, error() {}, debug() {} });
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
      zoomIn: false,
      zoomOut: false,
    };
  }

  handleWheel(event) {
    if (this.canvasInteraction(event)) {
      this.appcore.camera.handleWheel(event);
      return false;
    }
  }

  handlePointer(event) {
    if (this.canvasInteraction(event)) {
      this.appcore.camera.handlePointer(event);
      return false;
    }
  }

  handlePointerStart(event) {
    if (this.canvasInteraction(event)) {
      this.appcore.camera.beginPointer(event);
      this.appcore.camera.handlePointer(event);
      return false;
    }
  }

  handlePointerEnd() {
    this.appcore.camera.endPointer();
    return false;
  }

  handleKeyPressed(k, kCode, event = null) {
    if (KeyboardUtils.shouldIgnoreKeyboard(event)) {
      return false;
    }

    const keyValue = KeyboardUtils.normaliseKey(k);
    const shiftHeld = Boolean(event?.shiftKey) || KeyboardUtils.isShiftHeld();
    const match = (hintId, optionIndex = null) =>
      typeof KeybindCatalogue !== "undefined" &&
      typeof KeybindCatalogue.matchHint === "function" &&
      KeybindCatalogue.matchHint(
        "fluvia",
        hintId,
        keyValue,
        kCode,
        event,
        optionIndex,
      );
    const matchedTerrainSize =
      typeof KeybindCatalogue !== "undefined" &&
      typeof KeybindCatalogue.matchHintIndex === "function"
        ? KeybindCatalogue.matchHintIndex(
            "fluvia",
            "terrainSize",
            keyValue,
            kCode,
            event,
          )
        : -1;

    if (match("keymapReference")) {
      this.appcore.params.renderKeymapRef =
        !this.appcore.params.renderKeymapRef;
      this.appcore.refreshGUI();
      return false;
    }

    if (this.appcore.params.renderKeymapRef) {
      return false;
    }

    if (match("importParams")) {
      this.appcore.media.importParamsJSON();
      return false;
    }

    if (match("exportParams")) {
      this.appcore.media.exportParamsJSON();
      return false;
    }

    if (match("exportStatistics")) {
      this.appcore.media.exportStatisticsJSON();
      return false;
    }

    if (match("exportStatisticsCsv")) {
      this.appcore.media.exportStatisticsCSV();
      return false;
    }

    if (match("importHeightmap")) {
      try {
        this.appcore.media.openImportDialog();
      } catch (error) {
        this._diagnosticsLogger.error("Import heightmap failed:", error);
      }
      return false;
    }

    if (match("toggleGUI")) {
      if (this.appcore.gui && this.appcore.gui.pane) {
        this.appcore.gui.pane.hidden = !this.appcore.gui.pane.hidden;
      }
      return false;
    }

    if (match("running")) {
      this.appcore.params.running = !this.appcore.params.running;
      this.appcore.refreshGUI();
      return false;
    }

    if (match("record")) {
      try {
        if (this.appcore.media.isRecording) {
          this.appcore.media.stopRecording();
        } else {
          this.appcore.media.startRecording();
        }
      } catch (error) {
        this._diagnosticsLogger.error("Recording toggle failed:", error);
      }
      this.appcore.refreshGUI();
      return false;
    }

    if (match("exportImage")) {
      try {
        this.appcore.media.exportImage();
      } catch (error) {
        this._diagnosticsLogger.error("Export image failed:", error);
      }
      return false;
    }

    if (match("maxAge", 0) || match("maxAge", 1)) {
      const delta = match("maxAge", 0) ? 16 : -16;
      this.appcore.params.maxAge = constrain(
        this.appcore.params.maxAge + delta,
        8,
        2048,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (match("minVolume", 0) || match("minVolume", 1)) {
      const delta = match("minVolume", 0) ? 0.001 : -0.001;
      this.appcore.params.minVolume = constrain(
        this.appcore.params.minVolume + delta,
        1e-5,
        1,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (matchedTerrainSize >= 0) {
      const terrainSizes = [128, 256, 512];
      this.appcore.params.terrainSize = terrainSizes[matchedTerrainSize] || 256;
      this.appcore.generate();
      this.appcore.refreshGUI();
      return false;
    }

    if (match("noiseScale", 0) || match("noiseScale", 1)) {
      const baseStep = shiftHeld ? 0.25 : 0.05;
      const delta = match("noiseScale", 0) ? -baseStep : baseStep;
      this.appcore.params.noiseScale = constrain(
        this.appcore.params.noiseScale + delta,
        0.01,
        10,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (match("noiseOctaves", 0) || match("noiseOctaves", 1)) {
      const delta = match("noiseOctaves", 0) ? -1 : 1;
      this.appcore.params.noiseOctaves = constrain(
        this.appcore.params.noiseOctaves + delta,
        1,
        12,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (match("specularIntensity", 0) || match("specularIntensity", 1)) {
      const delta = match("specularIntensity", 0) ? -10 : 10;
      this.appcore.params.specularIntensity = constrain(
        this.appcore.params.specularIntensity + delta,
        0,
        4096,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (match("generate")) {
      this.appcore.generate();
      this.appcore.refreshGUI();
      return false;
    }

    if (match("reset")) {
      if (Boolean(event?.repeat)) {
        return false;
      }
      this.appcore.reset();
      this.appcore.refreshGUI();
      return false;
    }

    if (match("renderMethod", 0) || match("renderMethod", 1)) {
      this.appcore.params.renderMethod = match("renderMethod", 0) ? "2D" : "3D";
      this.appcore.refreshGUI();
      return false;
    }

    if (match("overlayStatistics")) {
      this.appcore.params.renderStatistics =
        !this.appcore.params.renderStatistics;
      this.appcore.refreshGUI();
      return false;
    }

    if (match("overlayLegend")) {
      this.appcore.params.renderLegend = !this.appcore.params.renderLegend;
      this.appcore.refreshGUI();
      return false;
    }

    if (match("colourMap")) {
      this.appcore.cycleColourMap(shiftHeld ? -1 : 1);
      this.appcore.refreshGUI();
      return false;
    }

    if (match("surfaceMap")) {
      this.appcore.cycleSurfaceMap(shiftHeld ? -1 : 1);
      this.appcore.refreshGUI();
      return false;
    }

    if (match("heightScale", 0) || match("heightScale", 1)) {
      const delta = match("heightScale", 0)
        ? shiftHeld
          ? -16
          : -4
        : shiftHeld
          ? 16
          : 4;
      this.appcore.params.heightScale = constrain(
        this.appcore.params.heightScale + delta,
        1,
        256,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (match("droplets", 0) || match("droplets", 1)) {
      const delta = match("droplets", 0) ? 16 : -16;
      this.appcore.params.dropletsPerFrame = constrain(
        this.appcore.params.dropletsPerFrame + delta,
        0,
        512,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (match("exportWorld")) {
      try {
        this.appcore.media.exportWorldJSON();
      } catch (error) {
        this._diagnosticsLogger.error("Export world failed:", error);
      }
      return false;
    }

    if (match("importWorld")) {
      try {
        this.appcore.media.importWorldJSON();
      } catch (error) {
        this._diagnosticsLogger.error("Import world failed:", error);
      }
      return false;
    }

    if (match("zoomInCamera")) {
      this.keys.zoomIn = true;
      return false;
    }

    if (match("zoomOutCamera")) {
      this.keys.zoomOut = true;
      return false;
    }

    if (match("orbitUp")) this.keys.up = true;
    if (match("orbitDown")) this.keys.down = true;
    if (match("orbitLeft")) this.keys.left = true;
    if (match("orbitRight")) this.keys.right = true;

    return false;
  }

  handleKeyReleased(k, kCode, event = null) {
    const keyValue = KeyboardUtils.normaliseKey(k);
    const match = (hintId, optionIndex = null) =>
      typeof KeybindCatalogue !== "undefined" &&
      typeof KeybindCatalogue.matchHint === "function" &&
      KeybindCatalogue.matchHint(
        "fluvia",
        hintId,
        keyValue,
        kCode,
        event,
        optionIndex,
      );

    if (match("zoomInCamera")) this.keys.zoomIn = false;
    if (match("zoomOutCamera")) this.keys.zoomOut = false;
    if (match("orbitUp")) this.keys.up = false;
    if (match("orbitDown")) this.keys.down = false;
    if (match("orbitLeft")) this.keys.left = false;
    if (match("orbitRight")) this.keys.right = false;

    return false;
  }

  handleContinuousInput() {
    if (
      KeyboardUtils.shouldIgnoreKeyboard() ||
      this.appcore.params.renderKeymapRef ||
      this.appcore.params.renderMethod !== "3D"
    ) {
      return;
    }

    const shiftHeld = KeyboardUtils.isShiftHeld();
    const yawStep = shiftHeld ? 0.03 : 0.015;
    const pitchStep = shiftHeld ? 0.03 : 0.015;
    const zoomStep = shiftHeld ? 8 : 4;

    if (this.keys.left) this.appcore.camera.target.yaw -= yawStep;
    if (this.keys.right) this.appcore.camera.target.yaw += yawStep;
    if (this.keys.up)
      this.appcore.camera.target.pitch = constrain(
        this.appcore.camera.target.pitch - pitchStep,
        -1.56,
        1.56,
      );
    if (this.keys.down)
      this.appcore.camera.target.pitch = constrain(
        this.appcore.camera.target.pitch + pitchStep,
        -1.56,
        1.56,
      );
    if (this.keys.zoomIn)
      this.appcore.camera.target.zoom = max(
        20,
        this.appcore.camera.target.zoom - zoomStep,
      );
    if (this.keys.zoomOut)
      this.appcore.camera.target.zoom = max(
        20,
        this.appcore.camera.target.zoom + zoomStep,
      );
  }

  canvasInteraction(event) {
    if (!event?.target || typeof event.target.closest !== "function")
      return false;

    const { renderMethod } = this.appcore.params;
    const { target } = event;

    const is3D = renderMethod === "3D";
    const isUI = target.closest(".tp-dfwv");
    const isCanvas = target.tagName === "CANVAS";

    return is3D && !isUI && isCanvas;
  }
}
