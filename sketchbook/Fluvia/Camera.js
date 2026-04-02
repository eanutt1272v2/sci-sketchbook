class Camera {
  constructor(appcore) {
    this.appcore = appcore;

    this.target = {
      yaw: 0,
      pitch: 0.8,
      zoom: 750,
    };

    this.current = {
      yaw: 0,
      pitch: 0.8,
      zoom: 750,
    };

    this.quaternion = new Quaternion();

    this.gesture = {
      orbit: null,
      pinch: null,
    };

    this.singlePointer = { x: 0, y: 0 };

    this.defaultSmoothing = 0.82;
    this.maxOrbitStep = 0.25;
  }

  _getMotionAlpha() {
    const smoothingRaw = Number(this.appcore?.params?.cameraSmoothing);
    const smoothing = Number.isFinite(smoothingRaw)
      ? constrain(smoothingRaw, 0, 0.98)
      : this.defaultSmoothing;

    const baseAlpha = 1 - smoothing;
    const dtMs = Number(globalThis.deltaTime);
    const frameScale = constrain(
      (Number.isFinite(dtMs) ? dtMs : 16.6667) / 16.6667,
      0.25,
      4,
    );

    return 1 - Math.pow(1 - baseAlpha, frameScale);
  }

  _getOrbitSensitivity() {
    const raw = Number(this.appcore?.params?.cameraOrbitSensitivity);
    return Number.isFinite(raw) ? constrain(raw, 0.001, 0.03) : 0.007;
  }

  _getZoomSensitivity() {
    const raw = Number(this.appcore?.params?.cameraZoomSensitivity);
    return Number.isFinite(raw) ? constrain(raw, 0.05, 3) : 0.5;
  }

  update() {
    const { current, target } = this;
    const alpha = this._getMotionAlpha();

    current.yaw = lerp(current.yaw, target.yaw, alpha);
    current.pitch = lerp(current.pitch, target.pitch, alpha);
    current.zoom = lerp(current.zoom, target.zoom, alpha);

    this.quaternion = Quaternion.fromEuler(
      current.pitch,
      current.yaw,
    ).normalise();
  }

  getEyePosition() {
    const { zoom } = this.current;
    return this.quaternion.applyToVector({ x: 0, y: zoom, z: 0 });
  }

  getUpVector() {
    return this.quaternion.applyToVector({ x: 0, y: 0, z: -1 });
  }

  getViewDirection() {
    return this.quaternion.applyToVector({ x: 0, y: 1, z: 0 });
  }

  handleWheel(event) {
    const rawDelta =
      Number(event?.delta) ||
      Number(event?.deltaY) ||
      Number(event?.wheelDelta) ||
      0;
    this.target.zoom = max(
      20,
      this.target.zoom + rawDelta * this._getZoomSensitivity(),
    );
  }

  beginPointer(event) {
    const touchCount = touches.length;
    const { gesture } = this;

    if (touchCount === 1) {
      gesture.orbit = { x: touches[0].x, y: touches[0].y };
      gesture.pinch = null;
      return;
    }

    if (touchCount === 2) {
      gesture.pinch = {
        distance: max(1, dist(touches[0].x, touches[0].y, touches[1].x, touches[1].y)),
      };
      gesture.orbit = null;
      return;
    }

    const x = Number(event?.offsetX);
    const y = Number(event?.offsetY);
    gesture.orbit = {
      x: Number.isFinite(x) ? x : mouseX,
      y: Number.isFinite(y) ? y : mouseY,
    };
    gesture.pinch = null;
  }

  endPointer() {
    this.gesture.orbit = null;
    this.gesture.pinch = null;
  }

  handlePointer(event) {
    const touchCount = touches.length;

    if (touchCount === 1) {
      this.handleOrbit(touches[0]);
      return;
    }

    if (touchCount === 2) {
      this.handlePinch(touches[0], touches[1]);
      return;
    }

    if (touchCount === 0 && mouseIsPressed) {
      const movementX = Number(event?.movementX);
      const movementY = Number(event?.movementY);
      if (Number.isFinite(movementX) && Number.isFinite(movementY)) {
        this.applyOrbitDelta(movementX, movementY);
        return;
      }

      this.singlePointer.x = mouseX;
      this.singlePointer.y = mouseY;
      this.handleOrbit(this.singlePointer);
      return;
    }

    this.endPointer();
  }

  applyOrbitDelta(deltaX, deltaY) {
    const sensitivity = this._getOrbitSensitivity();
    const dx = constrain(
      deltaX * sensitivity,
      -this.maxOrbitStep,
      this.maxOrbitStep,
    );
    const dy = constrain(
      deltaY * sensitivity,
      -this.maxOrbitStep,
      this.maxOrbitStep,
    );

    this.target.yaw += dx;
    this.target.pitch = constrain(this.target.pitch + dy, -1.56, 1.56);
  }

  handleOrbit(touch) {
    const { gesture } = this;

    if (!gesture.orbit) {
      gesture.orbit = { x: touch.x, y: touch.y };
      gesture.pinch = null;
      return;
    }

    const dx = touch.x - gesture.orbit.x;
    const dy = touch.y - gesture.orbit.y;
    this.applyOrbitDelta(dx, dy);

    gesture.orbit.x = touch.x;
    gesture.orbit.y = touch.y;
  }

  handlePinch(t1, t2) {
    const { gesture, target } = this;
    const distance = dist(t1.x, t1.y, t2.x, t2.y);

    if (!gesture.pinch) {
      gesture.pinch = { distance };
      gesture.orbit = null;
      return;
    }

    const ratio = constrain(distance / max(1, gesture.pinch.distance), 0.5, 2);
    const zoomFactor = Math.pow(ratio, this._getZoomSensitivity());
    target.zoom = max(20, target.zoom / zoomFactor);

    gesture.pinch.distance = max(1, distance);
  }
}
