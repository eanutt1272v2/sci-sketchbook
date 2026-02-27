// Global rotation angles for each 4D plane:
// Using mouse-only, we directly control XY and XW rotations.
// The remaining rotations (YZ, XZ, ZW, YW) 
float angleXY = 0, angleXW = 0, angleYW = 0, angleZW = 0;
float CamAngleXZ = PI/4, CamAngleYZ = -PI/8;

float axesLength = 500;

float q = 0.5;

// Perspective projection from 4D to 3D:
float d = 2;

float r = 0.005;

P4Vector[][][][] cube;

P4Vector[][][][] makeCube4(float r) {
   P4Vector[][][][] cube = new P4Vector[2][2][2][2];
   for (int x = 0; x < 2; x++) {
      for (int y = 0; y < 2; y++) {
         for (int z = 0; z < 2; z++) {
            for (int w = 0; w < 2; w++) {
               cube[x][y][z][w] = new P4Vector((x - q) * r, (y - q) * r, (z - q) * r, (w - q) * r);
            }
         }
      }
   }
   return cube;
}

void setup() {
   size(screenWidth, screenHeight, P3D);
   cube = makeCube4(1.5);
}

void draw() {
   background(0);
   
   translate(width/2, height/2);
   // Slowly animate the other rotations, so the 4D object has continuous motion.
   angleXY += sin(0.001 * r) * r;
   angleXW -= cos(0.002 * r) * r;
   angleYW += tan(0.003 * r) * r;
   angleZW -= cos(0.004 * r) * r;
   
   // ----- BUILD ROTATION MATRICES FOR EVERY 4D PLANE -----
   // The indices for the rotation matrix: 0: x, 1: y, 2: z, 3: w.
   Matrix rotXY = getRotationMatrix(0, 1, angleXY);
   
   Matrix rotXW = getRotationMatrix(0, 3, angleXW);
   Matrix rotYW = getRotationMatrix(1, 3, angleYW);
   Matrix rotZW = getRotationMatrix(2, 3, angleZW);
   
   // Multiply rotations in a particular order.
   // Note: Changing the order will change the overall behavior.
   Matrix rotationMatrix = rotZW.mult(rotYW)
   .mult(rotXW)
   .mult(rotXY);
   
   drawAxes();
   
   // ----- PROJECT 4D POINTS INTO 3D SPACE -----
   PVector[][][][] projected3d = new PVector[2][2][2][2];
   for (int x = 0; x < 2; x++) {
      for (int y = 0; y < 2; y++) {
         for (int z = 0; z < 2; z++) {
            for (int w = 0; w < 2; w++) {
               Matrix p = new Matrix(new float[][] {
                  {cube[x][y][z][w].x},
                     {cube[x][y][z][w].y},
                        {cube[x][y][z][w].z},
                           {cube[x][y][z][w].w}
                           });
                           Matrix rotated = rotationMatrix.mult(p);
                           
                           float factor = d / (d - rotated.data[3][0]);
                           Matrix proj = new Matrix(new float[][] {
                              {factor, 0, 0, 0},
                                 {0, factor, 0, 0},
                                    {0, 0, factor, 0}
                                    });
                                    Matrix projected = proj.mult(rotated);
                                    // Multiply by a scale factor for visualization.
                                    projected3d[x][y][z][w] = new PVector(projected.data[0][0] * 100,
                                    projected.data[1][0] * 100,
                                    projected.data[2][0] * 100);
                                 }
                              }
                           }
                        }
                        
                        // ----- DRAW VERTICES AND EDGES -----
                        // Draw vertices. Colors here depend on the w-index.
                        strokeWeight(15);
                        for (int x = 0; x < 2; x++) {
                           for (int y = 0; y < 2; y++) {
                              for (int z = 0; z < 2; z++) {
                                 for (int w = 0; w < 2; w++) {
                                    stroke(255);
                                    point(projected3d[x][y][z][w].x,
                                    projected3d[x][y][z][w].y,
                                    projected3d[x][y][z][w].z);
                                 }
                              }
                           }
                        }
                        
                        connections(projected3d);
                        //swedishGoat();
                     }
                     
                     // Helper function that returns a rotation matrix for a rotation in the plane spanned by axis i and j.
                     // Axes indices: 0 = x, 1 = y, 2 = z, 3 = w.
                     Matrix getRotationMatrix(int i, int j, float theta) {
                        float[][] m = new float[4][4];
                        // Initialize to identity.
                        for (int a = 0; a < 4; a++) {
                           for (int b = 0; b < 4; b++) {
                              m[a][b] = (a == b) ? 1 : 0;
                           }
                        }
                        m[i][i] = cos(theta);
                        m[j][j] = cos(theta);
                        m[i][j] = -sin(theta);
                        m[j][i] = sin(theta);
                        return new Matrix(m);
                     }
                     
                     void connect(PVector a, PVector b) {
                        line(a.x, a.y, a.z, b.x, b.y, b.z);
                     }
                     
                     void connections(PVector[][][][] projected3d) {
                        stroke(255);
                        
                        // Example connections for a 4D hypercube.
                        connect(projected3d[0][0][0][0], projected3d[1][0][0][0]);
                        connect(projected3d[0][0][0][0], projected3d[0][1][0][0]);
                        connect(projected3d[0][0][0][0], projected3d[0][0][1][0]);
                        connect(projected3d[0][0][0][0], projected3d[0][0][0][1]);
                        
                        connect(projected3d[1][0][0][0], projected3d[1][1][0][0]);
                        connect(projected3d[1][0][0][0], projected3d[1][0][1][0]);
                        connect(projected3d[1][0][0][0], projected3d[1][0][0][1]);
                        
                        connect(projected3d[0][1][0][0], projected3d[1][1][0][0]);
                        connect(projected3d[0][1][0][0], projected3d[0][1][1][0]);
                        connect(projected3d[0][1][0][0], projected3d[0][1][0][1]);
                        
                        connect(projected3d[0][0][1][0], projected3d[1][0][1][0]);
                        connect(projected3d[0][0][1][0], projected3d[0][1][1][0]);
                        connect(projected3d[0][0][1][0], projected3d[0][0][1][1]);
                        
                        connect(projected3d[0][0][0][1], projected3d[1][0][0][1]);
                        connect(projected3d[0][0][0][1], projected3d[0][1][0][1]);
                        connect(projected3d[0][0][0][1], projected3d[0][0][1][1]);
                        
                        connect(projected3d[1][1][0][0], projected3d[1][1][1][0]);
                        connect(projected3d[1][1][0][0], projected3d[1][1][0][1]);
                        
                        connect(projected3d[1][0][1][0], projected3d[1][1][1][0]);
                        connect(projected3d[1][0][1][0], projected3d[1][0][1][1]);
                        
                        connect(projected3d[1][0][0][1], projected3d[1][1][0][1]);
                        connect(projected3d[1][0][0][1], projected3d[1][0][1][1]);
                        
                        connect(projected3d[0][1][1][0], projected3d[1][1][1][0]);
                        connect(projected3d[0][1][1][0], projected3d[0][1][1][1]);
                        
                        connect(projected3d[0][0][1][1], projected3d[1][0][1][1]);
                        connect(projected3d[0][0][1][1], projected3d[0][1][1][1]);
                        
                        connect(projected3d[0][1][0][1], projected3d[1][1][0][1]);
                        connect(projected3d[0][1][0][1], projected3d[0][1][1][1]);
                        
                        connect(projected3d[0][1][1][1], projected3d[1][1][1][1]);
                        connect(projected3d[1][0][1][1], projected3d[1][1][1][1]);
                        connect(projected3d[1][1][0][1], projected3d[1][1][1][1]);
                        connect(projected3d[1][1][1][0], projected3d[1][1][1][1]);
                     }
                     
                     void mouseDragged() {
                        float sensitivity = 0.005; // adjust mouse sensitivity here
                        float dx = (mouseX - pmouseX) * sensitivity;
                        float dy = (mouseY - pmouseY) * sensitivity;
                        
                        CamAngleXZ -= dx;
                        CamAngleYZ -= dy;
                        
                        CamAngleYZ = constrain(CamAngleYZ, -HALF_PI, HALF_PI);
                     }
                     
                     void drawAxes() {
                        rotateX(CamAngleYZ);
                        rotateY(-CamAngleXZ);
                        strokeWeight(2);
                        stroke(255, 0, 0);
                        line(-axesLength / 2, 0, 0, axesLength / 2, 0, 0); // X-axis
                        stroke(0, 255, 0);
                        line(0, -axesLength / 2, 0, 0, axesLength / 2, 0); // Y-axis
                        stroke(0, 0, 255);
                        line(0, 0, -axesLength / 2, 0, 0, axesLength / 2); // Z-axis
                        textSize(20);
                        noStroke();
                        fill(255, 0, 0);
                        text("X", (axesLength/2) + 10, 0, 10);
                        text("-X", -(axesLength/2) - 10, 0, 10);
                        fill(0, 255, 0);
                        text("Y", 0, (axesLength/2) + 10, 10);
                        text("-Y", 0, -(axesLength/2) - 10, 10);
                        fill(0, 0, 255);
                        text("Z", 0, 0, (axesLength/2) + 20);
                        text("-Z", 0, 0, -(axesLength/2) - 10);
                     }
                     
                     