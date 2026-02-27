/*
 * PROJECT: 'Analog Strata'
 * AUTHOR: Edward N
 * DATE: 24 December 2025
 * DESCRIPTION: 
 * A generative art piece which uses nested loops and bezier curves to 
 * create a retro, 70s-inspired 'shoreline' aesthetic. Features a 
 * custom grain graphic for an 'analog' texture and a cream frame for visual balance;
 */

let colourPallete = ['#B8B58A', '#232628', '#976729', '#D1B226', '#EE8E28'];
let noiseLayer;

function setup() {
  createCanvas(800, 800);
  
  let percent = 0.1;
  noiseLayer = createGraphics(width, height);
  noiseLayer.stroke(255, 50);
  for (let i = 0; i < width * height * percent; i++) {
    noiseLayer.point(random(width), random(height));
  }
  
  noLoop();
}

function draw() {
  background(41);
  noStroke();
  
  let ct = 0;
  
  for (let j = -200; j <= height; j+= 100) {
    ct = (ct + 1) % colourPallete.length;
    fill(colourPallete[ct]);
    
    for (let i = 0; i <= width; i += 400) {
      push();
      translate(i, j);
      beginShape();
      vertex(0, 0);
      bezierVertex(-100, 0, 0, -100, -200, 0);
      vertex(-200, 200);
      bezierVertex(-100, 100, -100, 0, 0, 200);
      endShape(CLOSE);
      pop();
      
      push();
      translate(i, j);
      beginShape();
      vertex(0, 0);
      bezierVertex(100, 0, 0, 100, 200, 0);
      vertex(200, 200);
      bezierVertex(100, 100, 100, 300, 0, 200);
      endShape(CLOSE);
      pop();
    }
  }
  
  // Frame
  
  fill("#FDF1CD");
  let margin = 50;
  
  noStroke();
  rect(0, 0, width, margin);
  rect(width - margin, 0, margin, height);
  rect(0, height - margin, width, margin);
  rect(0, 0, margin, height);
  
  image(noiseLayer, 0, 0);
  
  console.log("Art generation complete.");
}