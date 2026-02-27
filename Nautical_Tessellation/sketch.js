/*
 * PROJECT: 'Nautical Tessellation'
 * AUTHOR: Edward N
 * DATE: 24 December 2025
 * DESCRIPTION: 
 * An study of organic, instead of regular tiling. This piece uses a 
 * Perlin Noise-distorted grid to create a 'warped' tessellation. 
 * Each cell is individually masked to contain concentric circular 
 * shapes, which mimics the look of traditional stained glass with 
 * a marine-inspired colour palette.
 */

let colourPallete = ["#052F5F", "#005377", "#06A77D", "#D5C67A", "#F1A208"];
let columns = 7;
let rows = 7;

let gridCoordinates = [];
let currentColumn = 0;
let currentRow = 0;
let isFinished = false;

function setup() {
  createCanvas(800, 800);
  background("#FDF1CD");
  generateGridPoints();
}

function draw() {
  if (isFinished) return;
  
  const patternCanvas = createCellPattern(currentColumn, currentRow);
  const maskCanvas = createCellMask(currentColumn, currentRow);
  const maskedCellImage = combineContentWithMask(patternCanvas, maskCanvas);
  
  image(maskedCellImage, 0, 0);
  
  advanceCurrentGridPosition();
}

function generateGridPoints() {
  for (let i = 0; i <= columns; i++) {
    gridCoordinates[i] = [];
    for (let j = 0; j <= rows; j++) {
      const xBase = i * width / columns;
      const yBase = j * height / rows;
      
      const xOffset = noise(xBase, yBase) * 99;
      const yOffset = noise(xBase, yBase) * 123;
      
      gridCoordinates[i][j] = createVector(-40 + xBase + xOffset, -40 + yBase + yOffset);
    }
  }
}

function createCellPattern(column, row) {
  const graphic = createGraphics(width, height);
  const topLeft = gridCoordinates[column][row];
  const topRight = gridCoordinates[column + 1][row];
  const bottomRight = gridCoordinates[column + 1][row + 1];
  const bottomLeft = gridCoordinates[column][row + 1];
  
  graphic.fill(random(colourPallete));
  graphic.strokeWeight(random(1, 4));
  graphic.quad(
    topLeft.x, topLeft.y,
    topRight.x, topRight.y,  
    bottomRight.x, bottomRight.y,
    bottomLeft.x, bottomLeft.y
  )
  
  const centreX = 0.5 * (topLeft.x + topRight.x);
  const centreY = 0.5 * (topLeft.y + max(bottomRight.y, bottomLeft.y));
  const diameter = min(topRight.x, bottomRight.x) - topLeft.x;
  
  graphic.fill(random(colourPallete));
  graphic.ellipse(centreX, centreY, diameter, diameter);
  
  graphic.fill(random(colourPallete));
  graphic.ellipse(centreX, centreY, diameter / 2, diameter / 2);
  
  return graphic;
}

function createCellMask(column, row) {
  const maskGraphic = createGraphics(width, height);
  maskGraphic.noStroke();
  maskGraphic.fill(255);
  
  maskGraphic.quad(
    gridCoordinates[column][row].x, gridCoordinates[column][row].y,
    gridCoordinates[column + 1][row].x, gridCoordinates[column + 1][row].y,
    gridCoordinates[column + 1][row + 1].x, gridCoordinates[column + 1][row + 1].y,
    gridCoordinates[column][row + 1].x, gridCoordinates[column][row + 1].y,
  );
  
  return maskGraphic;
}

function combineContentWithMask(contentCanvas, maskCanvas) {
  let contentImage = contentCanvas.get();
  let maskImage = maskCanvas.get();
  
  contentImage.mask(maskImage);
  
  return contentImage;
}

function advanceCurrentGridPosition() {
  currentColumn++;
  
  if (currentColumn >= columns) {
    currentColumn = 0;
    currentRow++;
  }
  
  if (currentRow >= rows) {
    isFinished = true;
    console.log("Art generation complete.");
  }
}