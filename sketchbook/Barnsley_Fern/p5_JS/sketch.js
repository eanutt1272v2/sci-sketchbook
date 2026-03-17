/**
 * @file sketch.js
 * @author @eanutt1272.v2
 * @version 2.1.0
 */

let x = 0;
let y = 0;
const pointsPerFrame = 8000;

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  createCanvas(canvasSize, canvasSize);
  background(10, 15, 10);
  smooth();
}

function windowResized() {
  const canvasSize = min(windowWidth, windowHeight);
  resizeCanvas(canvasSize, canvasSize);
  background(10, 15, 10);
}

function draw() {
  for (let i = 0; i < pointsPerFrame; i++) {
    nextPoint();
    drawPoint();
  }
}

function nextPoint() {
  let nextX;
  let nextY;
  const r = random(1);

  if (r < 0.01) {
    nextX = 0;
    nextY = 0.16 * y;
  } else if (r < 0.86) {
    nextX = 0.85 * x + 0.04 * y;
    nextY = -0.04 * x + 0.85 * y + 1.6;
  } else if (r < 0.93) {
    nextX = 0.2 * x - 0.26 * y;
    nextY = 0.23 * x + 0.22 * y + 1.6;
  } else {
    nextX = -0.15 * x + 0.28 * y;
    nextY = 0.26 * x + 0.24 * y + 0.44;
  }

  x = nextX;
  y = nextY;
}

function drawPoint() {
  const px = map(x, -2.182, 2.6558, 50, width - 50);
  const py = map(y, 0, 9.9983, height - 50, 50);

  const normY = map(y, 0, 9.9983, 0, 1);
  const r = lerp(20, 180, normY * normY);
  const g = lerp(60, 255, normY);
  const b = lerp(20, 100, normY);

  stroke(r, g, b, 120);
  strokeWeight(1.2);
  point(px, py);
}

function keyPressed() {
  if (key === "r" || key === "R") {
    background(10, 15, 10);
  }

  if (key === "s" || key === "S") {
    const filename =
      "Fern_" +
      year() +
      month() +
      day() +
      "_" +
      hour() +
      minute() +
      second();
    saveCanvas(filename, "png");
    print("Saved image to: " + filename + ".png");
  }
}

function mouseClicked() {
  background(10, 15, 10);
}
