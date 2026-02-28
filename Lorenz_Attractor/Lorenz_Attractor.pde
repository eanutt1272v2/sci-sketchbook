
// @file Lorenz_Attractor.pde
// @author @eanutt1272.v2
// @version 1.0.0
float x = 0.01;
float y = 0;
float z = 0;
float sigma = 10;
float rho = 28;
float beta = 8.0/3;
float dt = 0.01;

float prevX, prevY;
color startColor = color(random(0, 255), random(0, 255), random(0, 255));
color endColor = color(random(0, 255), random(0, 255), random(0, 255));

void setup() {
   size(screenWidth, screenHeight);
   background(0);
   prevX = map(x, -20, 20, 0, width);
   prevY = map(y, -20, 20, height, 0);
}

void draw() {
   float dx = (sigma * (y - x)) * dt;
   float dy = (x * (rho - z) - y) * dt;
   float dz = (x * y - beta * z) * dt;
   
   x += dx;
   y += dy;
   z += dz;
   
   float px = map(x, -20, 20, 0, width);
   float py = map(y, -20, 20, height, 0);
   
   float velocity = dist(prevX, prevY, px, py);
   
   for (float t = 0; t <= 1; t += 0.01) {
      color lineColor = lerpColor(endColor, startColor, map(velocity, 0, 105, 0, 1));
      stroke(lineColor);
      strokeWeight(2);
      float interX = lerp(prevX, px, t);
      float interY = lerp(prevY, py, t);
      point(interX, interY);
   }
   
   prevX = px;
   prevY = py;
}