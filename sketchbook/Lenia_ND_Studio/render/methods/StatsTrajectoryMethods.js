class StatsTrajectoryMethods {
  _renderTrajectoryPath(history, colour, cellPx, viewShiftX, viewShiftY) {
    if (!Array.isArray(history) || history.length < 2) return;

    const denom = Math.max(1, history.length - 1);

    push();
    noFill();
    strokeWeight(1);

    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1];
      const curr = history[i];
      if (!prev || !curr) continue;

      const px = Number(prev.x);
      const py = Number(prev.y);
      const cx = Number(curr.x);
      const cy = Number(curr.y);
      if (
        !Number.isFinite(px) ||
        !Number.isFinite(py) ||
        !Number.isFinite(cx) ||
        !Number.isFinite(cy)
      ) {
        continue;
      }

      const p0 = this._toViewWrappedPoint(px, py, viewShiftX, viewShiftY);
      const p1Base = this._toViewWrappedPoint(cx, cy, viewShiftX, viewShiftY);
      const p1 = this._nearestWrappedPoint(p0.x, p0.y, p1Base.x, p1Base.y);

      const alpha = Math.round(30 + (200 * i) / denom);
      stroke(colour[0], colour[1], colour[2], alpha);
      for (let sx = -1; sx <= 1; sx++) {
        for (let sy = -1; sy <= 1; sy++) {
          const tx = sx * this.size;
          const ty = sy * this.size;
          line(
            (p0.x + tx) * cellPx,
            (p0.y + ty) * cellPx,
            (p1.x + tx) * cellPx,
            (p1.y + ty) * cellPx,
          );
        }
      }
    }

    const last = history[history.length - 1];
    const lx = Number(last?.x);
    const ly = Number(last?.y);
    if (Number.isFinite(lx) && Number.isFinite(ly)) {
      const tail = this._toViewWrappedPoint(lx, ly, viewShiftX, viewShiftY);
      noStroke();
      fill(colour[0], colour[1], colour[2], 225);
      ellipse(tail.x * cellPx, tail.y * cellPx, 5, 5);
    }

    pop();
  }

  renderTrajectoryOverlay(statistics, params = {}) {
    const massHistory = statistics?.trajectoryMass;
    const growthHistory = statistics?.trajectoryGrowth;
    if (!Array.isArray(massHistory) || massHistory.length < 2) return;

    const mass = Number(statistics?.mass);
    if (!Number.isFinite(mass) || mass <= 1e-10) return;

    const cellPx = width / this.size;
    const vsx = this._viewOffsetActive ? this._viewShiftX : 0;
    const vsy = this._viewOffsetActive ? this._viewShiftY : 0;
    const growthTrailColour = [190, 190, 190];
    const massTrailColour = [255, 255, 255];

    if (Array.isArray(growthHistory) && growthHistory.length >= 2) {
      this._renderTrajectoryPath(
        growthHistory,
        growthTrailColour,
        cellPx,
        vsx,
        vsy,
      );
    }
    this._renderTrajectoryPath(massHistory, massTrailColour, cellPx, vsx, vsy);

    const showLabel = params.renderStats !== true;
    if (!showLabel) return;
    push();
    this._applyTextFont();
    noStroke();
    fill(255, 180);
    textSize(11);
    textAlign(LEFT, TOP);
    text("trajectory", 20, 20);
    pop();
  }

  renderMassGrowthOverlay(statistics, params = {}) {
    const mass = Number(statistics?.mass);
    const centreX = Number(statistics?.centreX);
    const centreY = Number(statistics?.centreY);
    const growthX = Number(statistics?.growthCentreX);
    const growthY = Number(statistics?.growthCentreY);

    if (
      !Number.isFinite(mass) ||
      mass <= 1e-10 ||
      !Number.isFinite(centreX) ||
      !Number.isFinite(centreY) ||
      !Number.isFinite(growthX) ||
      !Number.isFinite(growthY)
    ) {
      return;
    }

    const cellPx = width / this.size;
    const vsx = this._viewOffsetActive ? this._viewShiftX : 0;
    const vsy = this._viewOffsetActive ? this._viewShiftY : 0;

    const massPoint = this._toViewWrappedPoint(centreX, centreY, vsx, vsy);
    const growthBase = this._toViewWrappedPoint(growthX, growthY, vsx, vsy);
    const growthPoint = this._nearestWrappedPoint(
      massPoint.x,
      massPoint.y,
      growthBase.x,
      growthBase.y,
    );
    const lineShade = [220, 220, 220, 220];
    const massDotShade = [255, 255, 255, 235];
    const growthDotShade = [190, 190, 190, 235];

    push();
    stroke(lineShade[0], lineShade[1], lineShade[2], lineShade[3]);
    strokeWeight(1.5);
    for (let sx = -1; sx <= 1; sx++) {
      for (let sy = -1; sy <= 1; sy++) {
        const tx = sx * this.size;
        const ty = sy * this.size;
        line(
          (massPoint.x + tx) * cellPx,
          (massPoint.y + ty) * cellPx,
          (growthPoint.x + tx) * cellPx,
          (growthPoint.y + ty) * cellPx,
        );
      }
    }

    noStroke();
    fill(massDotShade[0], massDotShade[1], massDotShade[2], massDotShade[3]);
    ellipse(massPoint.x * cellPx, massPoint.y * cellPx, 6, 6);
    fill(
      growthDotShade[0],
      growthDotShade[1],
      growthDotShade[2],
      growthDotShade[3],
    );
    ellipse(growthPoint.x * cellPx, growthPoint.y * cellPx, 6, 6);

    if (!params.renderStats) {
      this._applyTextFont();
      noStroke();
      fill(220, 200);
      textSize(10);
      textAlign(LEFT, TOP);
      text("mass centroid -> growth centroid", 20, 34);
    }
    pop();
  }
}

for (const name of Object.getOwnPropertyNames(
  StatsTrajectoryMethods.prototype,
)) {
  if (name === "constructor") continue;
  Renderer.prototype[name] = StatsTrajectoryMethods.prototype[name];
}
