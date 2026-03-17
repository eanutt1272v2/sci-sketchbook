/**
 * @file Cellular_Division_Neo.js
 * @author @eanutt1272.v2
 * @version 2.5.8
 */

const Config = {
  GRID_SIZE: 30,
  CELLS_INTERVAL: 15,
  LEFT_PANEL_WIDTH: 260,
  RIGHT_COLUMN_WIDTH: 220,
  COLUMN_GAP: 10,
  VALUE_BOX_WIDTH: 50,
  VALUE_BOX_HEIGHT: 16,
  MIN_PARTICLES: 100,
  MAX_PARTICLES: 20000,
};

const metadata = {
  name: "Cellular Division",
  version: "v2.5.8",
  author: "@eanutt1272.v2",
};

let appcore;
let monoFont;

function preload() {
  monoFont = loadFont("monaco.ttf");
}

function setup() {
  createCanvas(1100, 800);
  textFont(monoFont);
  appcore = new AppCore();
}

function draw() {
  appcore.update();
  appcore.render();
}

function keyPressed() {
  appcore.onKeyPressed();
}