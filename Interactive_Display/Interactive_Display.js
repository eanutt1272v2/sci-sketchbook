let distMouse = 15;
let cols; let rows; let blocks = []; let spacing = 4;
let blockSize = 10;
let speedScalar = 4;

function setup() {
   createCanvas(400, 400);
   rectMode(CENTER);
   angleMode(DEGREES);
   cols = width/blockSize;
   rows = height/blockSize;
   
   for (let i = 0; i < cols; i++) {
      blocks[i] = [];
      for (let j = 0; j < rows; j++) {
         blocks[i][j] = new Block(i * blockSize + blockSize / 2, j * blockSize + blockSize / 2, blockSize);
      }
   }
}

function draw() {
   background(0);
   for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
         blocks[i][j].move();
         blocks[i][j].display();
      }
   }
}
