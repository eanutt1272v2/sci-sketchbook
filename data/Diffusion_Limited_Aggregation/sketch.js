/**
 * @file sketch.js
 * @author @eanutt1272.v2
 * @version 1.0.0
 */

let grid = [];
let wanderers = [];
let stuckWanderers = [];
let cols, rows;
let scl = 2;
let maxWanderers = 500;
let newWanderers = 50;
let fps = 60;

function setup() {
  createCanvas(512, 512);

  cols = width / scl;
  rows = height / scl;

  let index = floor(cols / 2) + floor(rows / 2) * cols;
  grid[index] = 1;
  stuckWanderers.push(createVector(floor(cols / 2), floor(rows / 2)));

  for (let i = 0; i < maxWanderers; i++) {
    spawnWanderers();
  }

  frameRate(fps);
}

function draw() {
  background(0);

  for (let i = 0; i < newWanderers; i++) {
    updateWanderers();
  }

  drawGrid();
  //drawWanderers();
}

function updateWanderers() {
  for (let i = wanderers.length - 1; i >= 0; i--) {
    wanderer = wanderers[i];
    wanderer.x += floor(random(-1, 2));
    wanderer.y += floor(random(-1, 2));
    wanderer.x = constrain(wanderer.x, 0, cols - 1);
    wanderer.y = constrain(wanderer.y, 0, rows - 1);

    let stuck = false;

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        let newX = floor(wanderer.x) + x;
        let newY = floor(wanderer.y) + y;

        if (newX >= 0 && newX < cols && newY >= 0 && newY < rows) {
          let index = newX + newY * cols;
          if (grid[index] === 1) {
            let nextIndex = wanderer.x + wanderer.y * cols;
            grid[nextIndex] = 1;
            stuckWanderers.push(createVector(wanderer.x, wanderer.y));
            wanderers.splice(i, 1);
            stuck = true;
            break;
          }
        }
      }
      if (stuck) {
        break;
      }
    }
  }

  while (wanderers.length < maxWanderers) {
    spawnWanderers();
  }
}

function drawGrid() {
  for (let stuckWanderer of stuckWanderers) {
    let index = stuckWanderer.x + stuckWanderer.y * cols;
    fill(255);
    noStroke();
    rect(stuckWanderer.x * scl, stuckWanderer.y * scl, scl, scl);
  }
}

function spawnWanderers() {
  let edge = floor(random(4));
  let x, y;
  if (edge === 0) {
    x = floor(random(cols));
    y = 0;
  } else if (edge === 1) {
    x = floor(random(cols));
    y = rows;
  } else if (edge === 2) {
    x = 0;
    y = floor(random(rows));
  } else {
    x = cols;
    y = floor(random(rows));
  }
  
  wanderers.push(createVector(x, y));
}
