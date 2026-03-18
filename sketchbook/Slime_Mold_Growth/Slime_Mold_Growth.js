



let molds = []; 
let num = 10000;
let d; 
let world_scale = 0.5;
let steps_per_frame = 1;
let rotAngle = 45;
let sensorAngle = 45;
let radius = 0.4;
let initialSize = 10;

function setup() {
   createCanvas(windowWidth, windowHeight);
   
   angleMode(DEGREES);
   
   frameRate(1000);
   
   d = pixelDensity();
   
   for (let i = 0; i < num; i++) {
      molds[i] = new Mold();
   }
}

function draw() {
   background(0, 25);
   loadPixels();
   overclockUpdate();
}

class Mold {
   constructor() {
      this.size = initialSize * world_scale;
      let rad = random(0, initialSize); 
      let angle = random(360);
      let r = rad * sqrt(random()); 
      let x = r * cos(angle);
      let y = r * sin(angle);
      
      this.x = width / 2 + x;
      this.y = height / 2 + y;
      this.r = radius * world_scale;
      
      this.heading = random(360);
      this.vx = cos(this.heading);
      this.vy = sin(this.heading);
      this.rotAngle = rotAngle + random(-45, 45);
      this.rSensorPos = createVector(0, 0);
      this.lSensorPos = createVector(0, 0);
      this.fSensorPos = createVector(0, 0);
      this.sensorAngle = sensorAngle;
      this.sensorDist = 10 * world_scale;
   }
   
   update() {           
      this.vx = cos(this.heading);
      this.vy = sin(this.heading);
      this.x = (this.x + this.vx + width) % width;
      this.y = (this.y + this.vy + height) % height;
      this.getSensorPos(this.rSensorPos, this.heading + this.sensorAngle);
      this.getSensorPos(this.lSensorPos, this.heading - this.sensorAngle);
      this.getSensorPos(this.fSensorPos, this.heading);
      let index, l, r, f;
      index = 4*(d * floor(this.rSensorPos.y)) * (d * width) + 4*(d * floor(this.rSensorPos.x));
      r = pixels[index];
      
      index = 4*(d * floor(this.lSensorPos.y)) * (d * width) + 4*(d * floor(this.lSensorPos.x));
      l = pixels[index];
      
      index = 4*(d * floor(this.fSensorPos.y)) * (d * width) + 4*(d * floor(this.fSensorPos.x));
      f = pixels[index];
      if (f > l && f > r) {
         this.heading += 0;
      } else if (f < l && f < r) {
         if (random(1) < 0.5) {
            this.heading += this.rotAngle;
         } else {
            this.heading -= this.rotAngle;
         }
      } else if (l > r) {
         this.heading += -this.rotAngle;
      } else if (r > l) {
         this.heading += this.rotAngle;
      }
   }
   
   display() {
      noStroke();
      fill(sqrt(this.vx*this.vx + this.vy*this.vy) * 5000);
      ellipse(this.x, this.y, this.r*2, this.r*2);
   }
   
   getSensorPos(sensor, angle) {
      sensor.x = (this.x + this.sensorDist*cos(angle) + width) % width;
      sensor.y = (this.y + this.sensorDist*sin(angle) + height) % height;
   }
}

function overclockUpdate() {
   for (let i = 0; i < num; i++) {
      for (let j = 0; j < steps_per_frame; j++) {
         molds[i].update();
      }
      molds[i].display();
   }
}

