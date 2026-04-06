class InputHandler {
  constructor(appcore) {
    this.appcore = appcore;
    this._diagnosticsLogger =
      appcore?._diagnosticsLogger ||
      (typeof AppDiagnostics !== "undefined" &&
      typeof AppDiagnostics.resolveLogger === "function"
        ? AppDiagnostics.resolveLogger("Psi")
        : { info() {}, warn() {}, error() {}, debug() {} });
    this.gesture = {
      pan: null,
      pinch: null,
    };
    this._heldKeys = new Set();
  }

  handleContinuousInput() {
    if (
      KeyboardUtils.shouldIgnoreKeyboard() ||
      this.appcore.params.renderKeymapRef
    ) {
      this._heldKeys.clear();
      return;
    }

    const { params } = this.appcore;
    const shiftHeld = KeyboardUtils.isShiftHeld();
    let needsRender = false;
    let syncViewConstraints = false;

    const leftDown = KeyboardUtils.isKeyDown("LEFT_ARROW", 37);
    const rightDown = KeyboardUtils.isKeyDown("RIGHT_ARROW", 39);
    const upDown = KeyboardUtils.isKeyDown("UP_ARROW", 38);
    const downDown = KeyboardUtils.isKeyDown("DOWN_ARROW", 40);

    if (leftDown || rightDown) {
      if (shiftHeld) {
        const step = max(0.25, params.viewRadius * 0.03);
        const delta = rightDown ? step : -step;
        this.panCurrentPlane(delta, 0);
      } else {
        params.sliceOffset = constrain(
          params.sliceOffset + (rightDown ? 0.5 : -0.5),
          -params.viewRadius,
          params.viewRadius,
        );
      }

      needsRender = true;
    }

    if (upDown || downDown) {
      if (shiftHeld) {
        const step = max(0.25, params.viewRadius * 0.03);
        const delta = upDown ? -step : step;
        this.panCurrentPlane(0, delta);
        needsRender = true;
      } else {
        const zoomIn = upDown;
        const zoomOut = downDown;

        if (zoomIn !== zoomOut) {
          const zoomScale = zoomOut ? 1.02 : 0.98;
          if (this.applyZoomAtNormalisedPoint(0.5, 0.5, zoomScale)) {
            needsRender = true;
            syncViewConstraints = true;
          }
        }
      }
    }

    const exposureDown = keyIsDown(219) || this._isKeyHeld("[", "{");
    const exposureUp = keyIsDown(221) || this._isKeyHeld("]", "}");

    if (exposureDown || exposureUp) {
      params.exposure = constrain(
        params.exposure + (exposureUp ? 0.01 : -0.01),
        0,
        2,
      );
      needsRender = true;
    }

    const isPlus =
      keyIsDown(187) ||
      keyIsDown(61) ||
      keyIsDown(107) ||
      this._isKeyHeld("=", "+");
    const isMinus =
      keyIsDown(189) ||
      keyIsDown(173) ||
      keyIsDown(109) ||
      this._isKeyHeld("-", "_");

    if (isPlus || isMinus) {
      params.resolution = constrain(
        params.resolution + (isPlus ? 2 : -2),
        64,
        512,
      );
      needsRender = true;
    }

    if (!needsRender) {
      return;
    }

    if (syncViewConstraints) {
      this.appcore.syncViewConstraints();
    } else {
      this.appcore.requestRender();
    }
  }

  handleKeyPressed(k, kCode, event = null) {
    const keyValue = KeyboardUtils.normaliseKey(k);
    this._setHeldKey(keyValue, true);

    if (keyValue === "#") {
      this.appcore.toggleKeymapRef();
      this.appcore.refreshGUI();
      this._diagnosticsLogger.info(
        `Keymap Reference: ${this.appcore.params.renderKeymapRef}`,
      );
      return false;
    }

    if (KeyboardUtils.shouldIgnoreKeyboard(event)) {
      return false;
    }

    if (this.appcore.params.renderKeymapRef) {
      return false;
    }

    const keyLower = KeyboardUtils.toLower(keyValue);
    const shiftHeld = Boolean(event?.shiftKey) || KeyboardUtils.isShiftHeld();
    const ctrlHeld = Boolean(event?.ctrlKey) || KeyboardUtils.isCtrlHeld();

    if (ctrlHeld && keyLower === "s" && !shiftHeld) {
      this.appcore.exportImage();
      return false;
    }

    if (ctrlHeld && keyLower === "r" && !shiftHeld) {
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

    if (shiftHeld && ctrlHeld && keyLower === "i") {
      this.appcore.media.importParamsJSON();
      return false;
    }

    if (shiftHeld && ctrlHeld && keyLower === "p") {
      this.appcore.media.exportParamsJSON();
      return false;
    }

    if (shiftHeld && ctrlHeld && keyLower === "s") {
      this.appcore.media.exportStatisticsJSON();
      return false;
    }

    if (shiftHeld && ctrlHeld && keyLower === "c") {
      this.appcore.media.exportStatisticsCSV();
      return false;
    }

    let logMsg = "";
    let shouldRefreshGUI = true;

    if (keyLower === "r" && !shiftHeld && !ctrlHeld) {
      this.appcore.params.nuclearCharge = Math.max(
        1,
        Math.min(20, Math.round(this.appcore.params.nuclearCharge + 1)),
      );
      this.appcore.requestRender();
      logMsg = `Z changed to ${this.appcore.params.nuclearCharge}`;
    } else if (keyLower === "t" && !shiftHeld && !ctrlHeld) {
      this.appcore.params.nuclearCharge = Math.max(
        1,
        Math.min(20, Math.round(this.appcore.params.nuclearCharge - 1)),
      );
      this.appcore.requestRender();
      logMsg = `Z changed to ${this.appcore.params.nuclearCharge}`;
    } else if (keyLower === "p" && !shiftHeld && !ctrlHeld) {
      this.appcore.params.useReducedMass = !this.appcore.params.useReducedMass;
      this.appcore.requestRender();
      logMsg = `Reduced mass: ${this.appcore.params.useReducedMass}`;
    } else if (keyLower === "g" && !shiftHeld && !ctrlHeld) {
      const current = Math.log10(this.appcore.params.nucleusMassKg);
      const next = constrain(current + 0.01, -30, -24);
      this.appcore.params.nucleusMassKg = Math.pow(10, next);
      this.appcore.requestRender();
      logMsg = `Nucleus mass log10 = ${next.toFixed(2)}`;
    } else if (keyLower === "b" && !shiftHeld && !ctrlHeld) {
      const current = Math.log10(this.appcore.params.nucleusMassKg);
      const next = constrain(current - 0.01, -30, -24);
      this.appcore.params.nucleusMassKg = Math.pow(10, next);
      this.appcore.requestRender();
      logMsg = `Nucleus mass log10 = ${next.toFixed(2)}`;
    } else if ((keyLower === "w" || keyLower === "s") && !ctrlHeld) {
      this.appcore.updateQuantumNumbers("n", keyLower === "w" ? 1 : -1);
      logMsg = `n changed to ${this.appcore.params.n}`;
    } else if ((keyLower === "d" || keyLower === "a") && !ctrlHeld) {
      this.appcore.updateQuantumNumbers("l", keyLower === "d" ? 1 : -1);
      logMsg = `l changed to ${this.appcore.params.l}`;
    } else if ((keyLower === "e" || keyLower === "q") && !ctrlHeld) {
      this.appcore.updateQuantumNumbers("m", keyLower === "e" ? 1 : -1);
      logMsg = `m changed to ${this.appcore.params.m}`;
    }

    const planes = { 1: "xy", 2: "xz", 3: "yz" };
    if (planes[keyValue]) {
      this.appcore.changePlane(planes[keyValue]);
      logMsg = `Plane switched to ${this.appcore.params.slicePlane.toUpperCase()}`;
    }

    if (!ctrlHeld) {
      switch (keyLower) {
        case "c":
          this.appcore.cycleColourMap();
          logMsg = `Map switched to ${this.appcore.params.colourMap}`;
          break;
        case "o":
          this.appcore.toggleOverlay();
          logMsg = `Overlay: ${this.appcore.params.renderOverlay}`;
          break;
        case "n":
          this.appcore.toggleNodeOverlay();
          logMsg = `Node Overlay: ${this.appcore.params.renderNodeOverlay}`;
          break;
        case "l":
          this.appcore.toggleLegend();
          logMsg = `Legend: ${this.appcore.params.renderLegend}`;
          break;
        case "m":
          this.appcore.toggleSmoothing();
          logMsg = `Smoothing: ${this.appcore.params.pixelSmoothing}`;
          break;
        case "h":
          this.appcore.toggleGUI();
          shouldRefreshGUI = false;
          break;
        case "x":
          this.appcore.resetViewCentre();
          logMsg = "View centre reset";
          break;
        case "z":
          this.appcore.resetViewRadius();
          logMsg = "View radius reset";
          break;
      }
    }

    if (keyValue === " " && !ctrlHeld) {
      this.appcore.resetSliceOffset();
      logMsg = "Offset reset to 0";
    }

    if (logMsg) {
      this._diagnosticsLogger.info(logMsg);
    }

    if (shouldRefreshGUI) {
      this.appcore.refreshGUI();
    }

    return false;
  }

  handleKeyReleased(k, kCode, event = null) {
    const keyValue = KeyboardUtils.normaliseKey(k);
    this._setHeldKey(keyValue, false);
    return false;
  }

  handleWheel(event) {
    if (!this.appcore.canvasInteraction(event)) {
      return;
    }

    const wheelDelta = constrain(event.delta || 0, -80, 80);
    const zoomScale = Math.exp(wheelDelta * 0.001);
    if (
      !this.applyZoomAtNormalisedPoint(
        mouseX / max(1, width),
        mouseY / max(1, height),
        zoomScale,
      )
    ) {
      return false;
    }

    this.appcore.requestRender();
    return false;
  }

  handlePointer(event) {
    if (!this.appcore.canvasInteraction(event)) {
      return;
    }

    const touchCount = touches.length;

    if (touchCount === 2) {
      this.handlePinch(touches[0], touches[1]);
      return false;
    }

    if (touchCount === 1) {
      this.handlePan(touches[0]);
      return false;
    }

    if (mouseIsPressed) {
      this.handlePan({ x: mouseX, y: mouseY });
      return false;
    }

    this.resetGesture();
  }

  handlePointerEnd(event) {
    const isCanvasInteraction = this.appcore.canvasInteraction(event);
    this.resetGesture();
    if (isCanvasInteraction) {
      return false;
    }
  }

  handlePan(pointer) {
    if (!this.gesture.pan) {
      this.gesture.pan = { x: pointer.x, y: pointer.y };
      this.gesture.pinch = null;
      return;
    }

    const dx = pointer.x - this.gesture.pan.x;
    const dy = pointer.y - this.gesture.pan.y;
    const worldScale = (this.appcore.params.viewRadius * 2) / max(1, width);

    this.panCurrentPlane(-dx * worldScale, -dy * worldScale);

    this.gesture.pan.x = pointer.x;
    this.gesture.pan.y = pointer.y;

    this.appcore.requestRender();
  }

  handlePinch(t1, t2) {
    const distance = dist(t1.x, t1.y, t2.x, t2.y);
    const cx = (t1.x + t2.x) / 2;
    const cy = (t1.y + t2.y) / 2;

    if (!this.gesture.pinch) {
      this.gesture.pinch = { distance };
      this.gesture.pan = null;
      return;
    }

    const ratio = distance / this.gesture.pinch.distance;
    const zoomScale = 1 / max(ratio, 1e-6);
    if (
      !this.applyZoomAtNormalisedPoint(
        cx / max(1, width),
        cy / max(1, height),
        zoomScale,
      )
    ) {
      return;
    }

    this.gesture.pinch.distance = distance;
    this.appcore.requestRender();
  }

  applyZoomAtNormalisedPoint(nx, ny, zoomScale) {
    const { params } = this.appcore;
    const oldRadius = params.viewRadius;
    const newRadius = constrain(oldRadius * zoomScale, 1, 256);

    if (newRadius === oldRadius) {
      return false;
    }

    const clampedNx = constrain(nx, 0, 1);
    const clampedNy = constrain(ny, 0, 1);
    const { axis1, axis2 } = this.appcore.getPlaneAxes();
    params.viewCentre[axis1] += (clampedNx - 0.5) * (oldRadius - newRadius) * 2;
    params.viewCentre[axis2] += (clampedNy - 0.5) * (oldRadius - newRadius) * 2;
    params.viewRadius = newRadius;

    return true;
  }

  panCurrentPlane(delta1, delta2) {
    const { axis1, axis2 } = this.appcore.getPlaneAxes();
    this.appcore.params.viewCentre[axis1] += delta1;
    this.appcore.params.viewCentre[axis2] += delta2;
  }

  _setHeldKey(value, isHeld) {
    const keyValue = KeyboardUtils.normaliseKey(value);
    if (!keyValue) return;
    const keyLower = KeyboardUtils.toLower(keyValue);

    if (isHeld) {
      this._heldKeys.add(keyValue);
      this._heldKeys.add(keyLower);
      return;
    }

    this._heldKeys.delete(keyValue);
    this._heldKeys.delete(keyLower);
  }

  _isKeyHeld(...values) {
    return values.some((value) => this._heldKeys.has(value));
  }

  resetGesture() {
    this.gesture.pan = null;
    this.gesture.pinch = null;
  }
}
