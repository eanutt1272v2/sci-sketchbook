/**
 * @file sketch.js
 * @description A p5.js implementation of a Burning Ship fractal explorer with a custom UI for adjusting parameters and colour maps.
 * @author @eanutt1272.v2
 * @version 3.0.0
 */

let appcore;

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  createCanvas(canvasSize, canvasSize);
  pixelDensity(1);
  appcore = new AppCore();
  appcore.setup();
}

function windowResized() {
  const canvasSize = min(windowWidth, windowHeight);
  resizeCanvas(canvasSize, canvasSize);

  if (appcore !== null) {
    appcore.renderer.buffer = createGraphics(width, height);
    appcore.renderer.buffer.pixelDensity(1);
    appcore.panel = new UIPanel(appcore);
    appcore.needsRedraw = true;
  }
}

function draw() { appcore.draw();}
function mousePressed() { appcore.input.onMousePressed(); return false; }
function mouseReleased() { appcore.input.onMouseReleased(); return false; }
function mouseDragged() { appcore.input.onMouseDragged(); return false; }
function touchStarted() { appcore.input.onMousePressed(); return false;}
function touchEnded() { appcore.input.onMouseReleased(); return false; }
function touchMoved() { appcore.input.onMouseDragged(); return false; }
function mouseWheel(event) { appcore.input.onMouseWheel(event); return false; }
function keyPressed() { appcore.input.onKeyPressed(); return false; }
function keyReleased() { appcore.input.onKeyReleased(); return false; }