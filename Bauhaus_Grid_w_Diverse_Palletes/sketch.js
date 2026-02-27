let palettes = {
  "Classic": {
    bg: "#ffe7c1",
    shadow: "#0d0e08",
    accents: ["#1c80b4", "#fcad2a", "#f82f1d"]
  },
  
  "Retro": {
    bg: "#f2e9e4",
    shadow: "#22223b",
    accents: ["#8c1c13", "#2f4550", "#a39171"]
  },
  
  "Midnight": {
    bg: "#000814",
    shadow: "#003566",
    accents: ["#ffc300", "#ffd60a", "#001d3d"]
  },
  
  "Weimar": {
    bg: "#e9e4d7",
    shadow: "#252525",
    accents: ["#00539c", "#ffd700", "#d62828"] 
  },
  
  "Dessau": {
    bg: "#f8f9fa",
    shadow: "#343a40",
    accents: ["#e9c46a", "#f4a261", "#e76f51"]
  },

  "Industrial": {
    bg: "#ced4da",
    shadow: "#212529",
    accents: ["#6c757d", "#343a40", "#adb5bd"]
  },

  "Kandinsky": {
    bg: "#1b263b",
    shadow: "#0d1b2a",
    accents: ["#e0e1dd", "#778da9", "#415a77"]
  },

  "Technic": {
    bg: "#fffaef",
    shadow: "#1a1a1a",
    accents: ["#00a896", "#02c39a", "#f0f3bd"]
  },
  
  "Electric": {
    bg: "#0b090a",
    shadow: "#161a1d",
    accents: ["#f52f57", "#00f5d4", "#f7ea48"]
  },

  "Textile": {
    bg: "#d4a373", 
    shadow: "#333d29",
    accents: ["#faedcd", "#ccd5ae", "#e9edc7"]
  },

  "Helvetica": {
    bg: "#ffffff",
    shadow: "#e5e5e5",
    accents: ["#ef233c", "#2b2d42", "#8d99ae"]
  }
};

let currentPalette = palettes["Classic"];
let gridSize = 4;
let squares = [];
let dropdown;

function setup() {
  //const canvasSize = min(windowWidth, windowHeight);
  createCanvas(400, 400);
  
  dropdown = createSelect();
  dropdown.position(10, height + 10);
  Object.keys(palettes).forEach(key => dropdown.option(key));
  dropdown.changed(changePalette);
  
  generateSketch();
}

function changePalette() {
  let selected = dropdown.value();
  currentPalette = palettes[selected];
  generateSketch();
}

function generateSketch() {
  squares = [];
  let stepX = width / gridSize;
  let stepY = height / gridSize;
  
  for (let y = stepY / 2; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      let colors = currentPalette.accents;
      let colorIndex = (floor(x / stepX) + floor(y / stepY)) % colors.length;
      
      squares.push(new Square(x, y, colors[colorIndex]));
    }
  }
  
  background(currentPalette.bg); 
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
    noStroke();

    fill(currentPalette.shadow);
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