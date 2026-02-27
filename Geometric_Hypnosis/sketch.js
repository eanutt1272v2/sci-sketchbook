const colourPallete = ["#8F4842", "#647F73", "#F7BE99", "#CFC586", "#CA7341"];

function setup() {
  createCanvas(512, 512);
  pixelDensity(1);
  noLoop();
}

function draw() {
  background(41);
  
  translate(width / 2, height / 2);
  
  noStroke();
  
  for (let theta = 0; theta < width; theta += 0.1) {
    let thetaSquared = pow(theta, 2);
    let thetaSquareRoot = sqrt(thetaSquared);
    
    let offset = 0.1 * map(thetaSquared, 0, width, 1, 0);
    
    let p1 = getPos(thetaSquared, theta);
    let p2 = getPos(thetaSquared - offset, theta - 0.1);
    let p3 = getPos(thetaSquareRoot - TWO_PI - offset, theta - TWO_PI - 0.1);
    let p4 = getPos(thetaSquareRoot - TWO_PI, theta);
    
    fill(random(colourPallete));
    
    beginShape();
    vertex(p1.x, p1.y);
    vertex(p2.x, p2.y);
    vertex(p3.x, p3.y);
    vertex(p4.x, p4.y);
    endShape(CLOSE);
  }
}

function getPos(radius, theta) {
  return {
    x: radius * cos(theta),
    y: radius * sin(theta)
  }
}