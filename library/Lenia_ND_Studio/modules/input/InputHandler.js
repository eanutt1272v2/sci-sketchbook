class InputHandler {
  constructor(appcore) {
    this.appcore = appcore;
    this._diagnosticsLogger =
      appcore?._diagnosticsLogger ||
      (typeof AppDiagnostics !== "undefined" &&
      typeof AppDiagnostics.resolveLogger === "function"
        ? AppDiagnostics.resolveLogger("Lenia")
        : { info() {}, warn() {}, error() {}, debug() {} });
    this._pointerActive = false;
    this._lastPointer = { x: 0, y: 0 };
  }

  handleWheel(event) {
    if (!this.appcore?.canvasInteraction?.(event)) return false;
    if ((this.appcore.params.dimension || 2) <= 2) return false;

    const delta = event?.deltaY > 0 ? 1 : -1;
    const dim = Number(this.appcore.params.dimension) || 2;
    const activeAxis =
      typeof this.appcore.getNDActiveAxis === "function"
        ? this.appcore.getNDActiveAxis()
        : "z";
    const axis =
      KeyboardUtils.isShiftHeld() && dim >= 4
        ? activeAxis === "w"
          ? "z"
          : "w"
        : activeAxis;

    this.appcore.adjustNDSlice(axis, delta);
    return false;
  }

  handlePointerPressed() {
    this._pointerActive = true;
    this._lastPointer.x = mouseX;
    this._lastPointer.y = mouseY;
    return false;
  }

  handlePointerDragged() {
    return false;
  }

  handlePointerReleased() {
    this._pointerActive = false;
    return false;
  }

  handleKeyPressed(k, kCode, event = null) {
    if (KeyboardUtils.shouldIgnoreKeyboard(event)) return false;

    const keyValue = KeyboardUtils.normaliseKey(k);
    const keyLower = KeyboardUtils.toLower(keyValue);
    const shiftHeld = Boolean(event?.shiftKey) || KeyboardUtils.isShiftHeld();
    const ctrlHeld = Boolean(event?.ctrlKey) || KeyboardUtils.isCtrlHeld();
    const altHeld = Boolean(event?.altKey);
    const { params } = this.appcore;
    const dim = params.dimension || 2;
    const leftArrow = KeyboardUtils.keyCode("LEFT_ARROW", 37);
    const rightArrow = KeyboardUtils.keyCode("RIGHT_ARROW", 39);
    const upArrow = KeyboardUtils.keyCode("UP_ARROW", 38);
    const downArrow = KeyboardUtils.keyCode("DOWN_ARROW", 40);

    if (keyValue === "#") {
      params.renderKeymapRef = !params.renderKeymapRef;
      this.appcore.refreshGUI();
      return false;
    }
    if (params.renderKeymapRef) return false;

    if (kCode === 13) {
      this.appcore.stepOnce();
      return false;
    }
    if (keyValue === " ") {
      params.running = !params.running;
      this.appcore.refreshGUI();
      return false;
    }

    if (kCode === 9) {
      this._cycleRenderMode(shiftHeld ? -1 : 1);
      this.appcore.refreshGUI();
      return false;
    }
    if (keyValue === ">" || keyValue === ".") {
      this.appcore.cycleColourMap(1);
      this.appcore.refreshGUI();
      return false;
    }
    if (keyValue === "<" || keyValue === ",") {
      this.appcore.cycleColourMap(-1);
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "q" && !ctrlHeld) {
      params.m = Math.max(
        0,
        Math.min(1, params.m + (shiftHeld ? 0.01 : 0.001)),
      );
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      return false;
    }
    if (keyLower === "a" && !ctrlHeld) {
      params.m = Math.max(
        0,
        Math.min(1, params.m - (shiftHeld ? 0.01 : 0.001)),
      );
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "w" && !ctrlHeld) {
      params.s = Math.max(0.0001, params.s + (shiftHeld ? 0.001 : 0.0001));
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      return false;
    }
    if (keyLower === "s" && !ctrlHeld) {
      params.s = Math.max(0.0001, params.s - (shiftHeld ? 0.001 : 0.0001));
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "r" && !ctrlHeld) {
      if (this.appcore?.nudgeRadius) {
        this.appcore.nudgeRadius(shiftHeld ? 1 : 10);
      }
      this.appcore.refreshGUI();
      return false;
    }
    if (keyLower === "f" && !ctrlHeld) {
      if (this.appcore?.nudgeRadius) {
        this.appcore.nudgeRadius(shiftHeld ? -1 : -10);
      }
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "t" && !ctrlHeld) {
      const maxT = this.appcore?.getMaxTimeScale
        ? this.appcore.getMaxTimeScale()
        : 1500;
      params.T = shiftHeld
        ? Math.min(maxT, params.T + 1)
        : Math.min(maxT, params.T * 2);
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      return false;
    }
    if (keyLower === "g" && !ctrlHeld) {
      params.T = shiftHeld
        ? Math.max(1, params.T - 1)
        : Math.max(1, Math.round(params.T / 2));
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "e" && !ctrlHeld) {
      params.paramP = Math.min(64, (params.paramP || 0) + (shiftHeld ? 1 : 10));
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      return false;
    }
    if (keyLower === "d" && !ctrlHeld) {
      params.paramP = Math.max(0, (params.paramP || 0) - (shiftHeld ? 1 : 10));
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      return false;
    }

    if (ctrlHeld && keyLower === "t") {
      params.h = Math.min(1, Math.round((params.h + 0.1) * 10) / 10);
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      return false;
    }
    if (ctrlHeld && keyLower === "g") {
      params.h = Math.max(0.1, Math.round((params.h - 0.1) * 10) / 10);
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "y" && !ctrlHeld) {
      this._adjustPeak(0, shiftHeld ? -1 / 12 : 1 / 12);
      return false;
    }
    if (keyLower === "u" && !ctrlHeld) {
      this._adjustPeak(1, shiftHeld ? -1 / 12 : 1 / 12);
      return false;
    }
    if (keyLower === "i" && !ctrlHeld) {
      this._adjustPeak(2, shiftHeld ? -1 / 12 : 1 / 12);
      return false;
    }
    if (keyLower === "o" && !ctrlHeld) {
      this._adjustPeak(3, shiftHeld ? -1 / 12 : 1 / 12);
      return false;
    }
    if (keyLower === "p" && !ctrlHeld) {
      this._adjustPeak(4, shiftHeld ? -1 / 12 : 1 / 12);
      return false;
    }
    if ((keyValue === ";" || keyValue === ":") && !ctrlHeld) {
      if (shiftHeld) {
        if (params.b.length > 1) params.b.pop();
      } else {
        params.b.push(0);
      }
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      return false;
    }

    if (ctrlHeld && keyLower === "y") {
      params.kn = shiftHeld
        ? ((params.kn - 2 + 4) % 4) + 1
        : (params.kn % 4) + 1;
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      return false;
    }
    if (ctrlHeld && keyLower === "u") {
      params.gn = shiftHeld
        ? ((params.gn - 2 + 3) % 3) + 1
        : (params.gn % 3) + 1;
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      return false;
    }
    if (ctrlHeld && keyLower === "i") {
      if (shiftHeld) {
        params.maskRate = ((params.maskRate || 0) + 1) % 10;
      } else {
        params.softClip = !params.softClip;
      }
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      return false;
    }
    if (ctrlHeld && keyLower === "o") {
      params.addNoise = ((params.addNoise || 0) + 1) % 11;
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      return false;
    }
    if (ctrlHeld && keyLower === "p") {
      if (shiftHeld) {
        params.maskRate = 0;
        params.addNoise = 0;
        this.appcore.updateAutomatonParams();
        this.appcore.refreshGUI();
      } else {
        params.aritaMode = !params.aritaMode;
        this.appcore.updateAutomatonParams();
        this.appcore.refreshGUI();
      }
      return false;
    }

    if (ctrlHeld && keyLower === "m") {
      params.multiStep = !params.multiStep;
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      return false;
    }

    if (ctrlHeld && keyLower === "d") {
      const dims = [2, 3, 4];
      const idx = dims.indexOf(Number(params.dimension) || 2);
      const next = dims[(idx + 1) % dims.length];
      this.appcore.setDimension(next);
      this.appcore.refreshGUI();
      return false;
    }

    if (kCode === leftArrow && !ctrlHeld) {
      this.appcore.shiftWorld(shiftHeld ? -1 : -10, 0);
      return false;
    }
    if (kCode === rightArrow && !ctrlHeld) {
      this.appcore.shiftWorld(shiftHeld ? 1 : 10, 0);
      return false;
    }
    if (kCode === upArrow && !ctrlHeld) {
      this.appcore.shiftWorld(0, shiftHeld ? -1 : -10);
      return false;
    }
    if (kCode === downArrow && !ctrlHeld) {
      this.appcore.shiftWorld(0, shiftHeld ? 1 : 10);
      return false;
    }
    if (dim > 2 && ctrlHeld && shiftHeld && kCode === 36) {
      this.appcore.cycleNDActiveAxis(1);
      return false;
    }
    if (dim > 2 && ctrlHeld && kCode === 36) {
      this.appcore.centreNDSlices({ allAxes: true });
      return false;
    }

    if (kCode === 33 && !ctrlHeld && dim > 2) {
      this.appcore.shiftNDDepth(shiftHeld ? 1 : 10);
      return false;
    }
    if (kCode === 34 && !ctrlHeld && dim > 2) {
      this.appcore.shiftNDDepth(shiftHeld ? -1 : -10);
      return false;
    }
    if (kCode === 36 && !ctrlHeld && dim > 2) {
      if (params.viewMode !== "slice") {
        this.appcore.setViewMode("slice");
      }
      this.appcore.adjustNDSlice(null, shiftHeld ? 1 : 10);
      return false;
    }
    if (kCode === 35 && !ctrlHeld && dim > 2) {
      if (params.viewMode !== "slice") {
        this.appcore.setViewMode("slice");
      }
      this.appcore.adjustNDSlice(null, shiftHeld ? -1 : -10);
      return false;
    }

    if (ctrlHeld && kCode === leftArrow) {
      this.appcore.rotateWorld(shiftHeld ? -15 : -90);
      return false;
    }
    if (ctrlHeld && kCode === rightArrow) {
      this.appcore.rotateWorld(shiftHeld ? 15 : 90);
      return false;
    }

    if ((keyValue === "=" || keyValue === "+") && !ctrlHeld) {
      this.appcore.flipWorld(shiftHeld ? 1 : 0);
      return false;
    }
    if ((keyValue === "-" || keyValue === "_") && !ctrlHeld) {
      this.appcore.flipWorld(2);
      return false;
    }

    if (dim > 2 && ctrlHeld && kCode === 35) {
      this.appcore.toggleNDSliceView();
      return false;
    }
    const quoteKey = keyValue === "'" || keyValue === '"';

    if (quoteKey && !ctrlHeld && !shiftHeld) {
      params.autoCentre = !params.autoCentre;
      this.appcore.refreshGUI();
      return false;
    }
    if (quoteKey && shiftHeld && !ctrlHeld) {
      if (this.appcore?.cycleAutoRotateMode) {
        this.appcore.cycleAutoRotateMode(1, { refreshGUI: true });
      } else {
        params.autoRotateMode =
          ((((Number(params.autoRotateMode) || 0) + 1) % 3) + 3) % 3;
        this.appcore.refreshGUI();
      }
      return false;
    }
    if (quoteKey && ctrlHeld) {
      this.appcore.cyclePolarMode(1, { refreshGUI: true });
      return false;
    }

    if (keyLower === "z" && !ctrlHeld) {
      this.appcore.loadSelectedAnimal();
      this.appcore.refreshGUI();
      return false;
    }
    if (keyLower === "c" && !ctrlHeld) {
      this._cycleAnimal(shiftHeld ? -10 : -1);
      return false;
    }
    if (keyLower === "v" && !ctrlHeld) {
      this._cycleAnimal(shiftHeld ? 10 : 1);
      return false;
    }
    if (keyLower === "x" && !ctrlHeld) {
      if (shiftHeld) {
        params.placeMode = !params.placeMode;
        this.appcore.refreshGUI();
      } else {
        const repeats = 1;
        for (let i = 0; i < repeats; i++) this.appcore.placeAnimalRandom();
        this.appcore.refreshGUI();
      }
      return false;
    }

    if (kCode === 46 || kCode === 8) {
      this.appcore.clearWorld();
      this.appcore.refreshGUI();
      return false;
    }
    if (keyLower === "n" && !ctrlHeld) {
      if (shiftHeld) {
        this.appcore.randomWorldWithSeed(null, false);
      } else {
        this.appcore.randomiseWorld();
      }
      this.appcore.refreshGUI();
      return false;
    }
    if (keyLower === "m" && !ctrlHeld) {
      if (shiftHeld) {
        this.appcore.randomiseParams(true);
      } else {
        this.appcore.randomiseParams(false);
      }
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "h" && !ctrlHeld) {
      if (this.appcore.gui && this.appcore.gui.pane) {
        this.appcore.gui.pane.hidden = !this.appcore.gui.pane.hidden;
      }
      return false;
    }

    if (altHeld && !ctrlHeld && keyLower === "j") {
      this.appcore.cycleStatsMode(shiftHeld ? -1 : 1);
      return false;
    }
    if (altHeld && !ctrlHeld && keyLower === "k") {
      this.appcore.cycleStatsAxis("x", shiftHeld ? -1 : 1);
      return false;
    }
    if (altHeld && !ctrlHeld && keyLower === "l") {
      this.appcore.cycleStatsAxis("y", shiftHeld ? -1 : 1);
      return false;
    }
    if (altHeld && ctrlHeld && keyLower === "n") {
      this.appcore.startStatsSegment();
      return false;
    }
    if (altHeld && ctrlHeld && keyLower === "j") {
      if (shiftHeld) {
        this.appcore.clearAllStatsSegments();
      } else {
        this.appcore.clearCurrentStatsSegment();
      }
      return false;
    }

    if (ctrlHeld && keyLower === "h") {
      params.renderStats = !params.renderStats;
      this.appcore.refreshGUI();
      return false;
    }
    if (ctrlHeld && keyLower === "j") {
      params.renderSymmetryOverlay = !params.renderSymmetryOverlay;
      this.appcore.refreshGUI();
      return false;
    }
    if (ctrlHeld && keyLower === "k" && !shiftHeld && !altHeld) {
      const currentMode = Math.max(
        0,
        Math.min(6, Math.floor(Number(params.statsMode) || 1)),
      );
      params.statsMode = currentMode === 5 ? 1 : 5;
      this.appcore.analyser?.updatePeriodogram?.(params, 10, true);
      this.appcore.refreshGUI();
      return false;
    }
    if (ctrlHeld && keyLower === "l") {
      if (shiftHeld) {
        params.renderMassGrowthOverlay = !params.renderMassGrowthOverlay;
      } else {
        params.renderTrajectoryOverlay = !params.renderTrajectoryOverlay;
      }
      this.appcore.refreshGUI();
      return false;
    }
    if (keyLower === "j" && !ctrlHeld) {
      if (shiftHeld) {
        params.renderAnimalName = !params.renderAnimalName;
      } else {
        params.renderMotionOverlay = !params.renderMotionOverlay;
      }
      this.appcore.refreshGUI();
      return false;
    }
    if (keyLower === "k" && !ctrlHeld) {
      params.renderCalcPanels = !params.renderCalcPanels;
      this.appcore.refreshGUI();
      return false;
    }
    if (keyLower === "l" && !ctrlHeld) {
      params.renderLegend = !params.renderLegend;
      this.appcore.refreshGUI();
      return false;
    }
    if (keyLower === "b" && !ctrlHeld) {
      params.renderScale = !params.renderScale;
      this.appcore.refreshGUI();
      return false;
    }

    if (keyValue === "`" && !ctrlHeld) {
      this._cycleGridSize();
      return false;
    }

    if (keyLower === "g" && shiftHeld && !ctrlHeld) {
      params.renderGrid = !params.renderGrid;
      this.appcore.refreshGUI();
      return false;
    }

    if (ctrlHeld && keyLower === "r") {
      try {
        if (this.appcore.media.isRecording) {
          this.appcore.media.stopRecording();
        } else {
          this.appcore.media.startRecording();
        }
      } catch (error) {
        this._diagnosticsLogger.error("Recording toggle failed:", error);
      }
      this.appcore.gui?.syncMediaControls();
      return false;
    }

    if (ctrlHeld && shiftHeld && keyLower === "z") {
      this.appcore.applySelectedAnimalParams({ refreshGUI: true });
      return false;
    }

    if (ctrlHeld && (keyValue === "[" || keyValue === "{" || kCode === 219)) {
      const bounds = this.appcore?.getPlacementScaleBounds
        ? this.appcore.getPlacementScaleBounds(
            this.appcore.params?.selectedAnimal,
          )
        : { min: 0.25, max: 4 };
      params.placeScale = constrain(
        Math.round((params.placeScale - 0.05) * 20) / 20,
        bounds.min,
        bounds.max,
      );
      this.appcore.updatePlacementScale(params.placeScale);
      this.appcore.refreshGUI();
      return false;
    }
    if (ctrlHeld && (keyValue === "]" || keyValue === "}" || kCode === 221)) {
      const bounds = this.appcore?.getPlacementScaleBounds
        ? this.appcore.getPlacementScaleBounds(
            this.appcore.params?.selectedAnimal,
          )
        : { min: 0.25, max: 4 };
      params.placeScale = constrain(
        Math.round((params.placeScale + 0.05) * 20) / 20,
        bounds.min,
        bounds.max,
      );
      this.appcore.updatePlacementScale(params.placeScale);
      this.appcore.refreshGUI();
      return false;
    }

    if (ctrlHeld && keyLower === "s") {
      this.appcore.media.exportImage();
      return false;
    }

    if (shiftHeld && ctrlHeld && keyLower === "e") {
      this.appcore.media.exportWorldJSON();
      return false;
    }
    if (shiftHeld && ctrlHeld && keyLower === "w") {
      this.appcore.media.importWorldJSON();
      return false;
    }
    if (shiftHeld && ctrlHeld && keyLower === "i") {
      this.appcore.media.importParamsJSON();
      return false;
    }
    if (shiftHeld && ctrlHeld && keyLower === "p") {
      this.appcore.media.exportParamsJSON();
      return false;
    }
    if (shiftHeld && ctrlHeld && keyLower === "j") {
      this.appcore.media.exportStatisticsJSON();
      return false;
    }
    if (shiftHeld && ctrlHeld && keyLower === "k") {
      this.appcore.media.exportStatisticsCSV();
      return false;
    }

    return false;
  }

  handleKeyReleased(k, kCode, event = null) {
    return false;
  }

  _cycleRenderMode(direction = 1) {
    const modes = ["world", "potential", "growth", "kernel"];
    const idx = modes.indexOf(this.appcore.params.renderMode);
    const safeIdx = idx >= 0 ? idx : 0;
    const next = (safeIdx + direction + modes.length) % modes.length;
    this.appcore.params.renderMode = modes[next];
  }

  _cycleGridSize() {
    const sizes = this.appcore?.getGridSizeOptions
      ? Object.values(
          this.appcore.getGridSizeOptions(this.appcore.params.dimension),
        )
      : [64, 128, 256];
    const current = this.appcore.params.latticeExtent;
    const idx = sizes.indexOf(current);
    const safeIdx = idx >= 0 ? idx : 0;
    this.appcore.params.latticeExtent = sizes[(safeIdx + 1) % sizes.length];
    this.appcore.changeResolution();
    this.appcore.refreshGUI();
  }

  _cycleAnimal(delta) {
    this.appcore.cycleAnimal(delta);
  }

  _adjustPeak(index, delta) {
    const { params } = this.appcore;
    while (params.b.length <= index) params.b.push(0);
    params.b[index] = Math.max(0, params.b[index] + delta);
    this.appcore.updateAutomatonParams();
    this.appcore.refreshGUI();
  }
}
