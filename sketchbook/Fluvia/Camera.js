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

    this.lerpWeight = 0.25;
  }

  update() {
    const { current, target, lerpWeight } = this;

    current.yaw = lerp(current.yaw, target.yaw, lerpWeight);
    current.pitch = lerp(current.pitch, target.pitch, lerpWeight);
    current.zoom = lerp(current.zoom, target.zoom, lerpWeight);

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

  handleWheel(e) {
    this.target.zoom = max(20, this.target.zoom + e.delta * 0.5);
  }

  handlePointer() {
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
      this.singlePointer.x = mouseX;
      this.singlePointer.y = mouseY;
      this.handleOrbit(this.singlePointer);
      return;
    }

    const { gesture } = this;
    gesture.orbit = null;
    gesture.pinch = null;
  }

  handleOrbit(touch) {
    const { gesture, target } = this;

    if (!gesture.orbit) {
      gesture.orbit = { x: touch.x, y: touch.y };
      gesture.pinch = null;
      return;
    }

    const dx = (touch.x - gesture.orbit.x) * 0.007;
    const dy = (touch.y - gesture.orbit.y) * 0.007;

    target.yaw += dx;
    target.pitch = constrain(target.pitch + dy, -1.56, 1.56);

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

    const ratio = distance / gesture.pinch.distance;
    target.zoom = max(20, target.zoom / ratio);

    gesture.pinch.distance = distance;
  }
}
