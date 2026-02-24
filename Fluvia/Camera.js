class Camera {
  constructor(manager) {
    this.m = manager;

    this.target = {
      yaw: 0,
      pitch: 0.8,
      zoom: 750
    };

    this.current = {
      yaw: 0,
      pitch: 0.8,
      zoom: 750
    };

    this.quaternion = new Quaternion();

    this.gesture = {
      orbit: null,
      pinch: null
    };

    this.lerpWeight = 0.25;
  }

  update() {
    const { current, target, lerpWeight } = this;

    current.yaw   = lerp(current.yaw,   target.yaw,   lerpWeight);
    current.pitch = lerp(current.pitch, target.pitch, lerpWeight);
    current.zoom  = lerp(current.zoom,  target.zoom,  lerpWeight);

    this.quaternion = Quaternion.fromEuler(current.pitch, current.yaw).normalise();
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
    let points = touches.length > 0 ? touches : [];
    if (points.length === 0 && mouseIsPressed) {
      points = [{ x: mouseX, y: mouseY }];
    }

    const count = points.length;

    if (count === 1) {
      this.handleOrbit(points[0]);
    } else if (count === 2) {
      this.handlePinch(points[0], points[1]);
    } else {
      const { gesture } = this;
      gesture.orbit = null;
      gesture.pinch = null;
    }
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