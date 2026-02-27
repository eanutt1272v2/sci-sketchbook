let colourPallete = ["#1c80b4", "#fcad2a", "#f82f1d"];
let backgroundColour = "#ffe7c1";
let gridSize = 6;
let squares = [];

function setup() {
  createCanvas(600, 600);
  background(backgroundColour);
  
  let stepX = width / gridSize;
  let stepY = height / gridSize;
  
  for (let y = stepY / 2; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      
      let colorIndex = (floor(x / stepX) + floor(y / stepY)) % colourPallete.length;
      
      let currentColour = colourPallete[colorIndex];
      squares.push(new Square(x, y, currentColour));
    }
  }
}

function draw() {
  squares.forEach((square) => {
    square.render();
    square.update();
    if (random(1) < 0.01) square.velocity = 1;
  });
}

class Square {
  constructor(x, y, colour) {
    this.start = x;
    this.x = x;
    this.y = y;
    this.velocity = 0;
    this.size = height / gridSize / 2;
    this.colour = colour;
  }
  
  
  render() {
    fill("#0d0e08");
    square(this.x - 1, this.y + 1, this.size);
    fill(this.colour);
    square(this.x, this.y, this.size);
  }
  
  update() {
    if (this.x < this.start + this.size) {
      this.x += this.velocity;
      this.y -= this.velocity;
    }
  }
}