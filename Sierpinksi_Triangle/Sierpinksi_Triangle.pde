float[] x = new float[10000];
float[] y = new float[10000];

void setup() {
   size(screenWidth, screenHeight);
   background(0);
   
   // Set initial point
   x[0] = random(width);
   y[0] = random(height);
   
   // Define transformation matrices for the IFS fractal
   float[][] transformations = {
      {0.5, 0.0, 0.0, 0.5, 0.0, 0.0},
         {0.5, 0.0, 0.0, 0.5, 400.0, 0.0},
            {0.5, 0.0, 0.0, 0.5, 200.0, 346.4}
            };
            
            // Number of iterations
            int n = 1000000;
            
            // Iterate and plot points
            for (int i = 1; i < n; i++) {
               int r = int(random(transformations.length));
               float xnew = transformations[r][0]*x[i-1] + transformations[r][1]*y[i-1] + transformations[r][4];
               float ynew = transformations[r][2]*x[i-1] + transformations[r][3]*y[i-1] + transformations[r][5];
               
               x[i] = xnew;
               y[i] = ynew;
               
               stroke(255);
               point(x[i], y[i]);
            }
         }