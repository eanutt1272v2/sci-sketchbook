class FractalRenderer {
  AppCore appcore;
  PGraphics buffer;

  static final int LUT_SIZE = 2048;
  int[] colorLUT = new int[LUT_SIZE];

  String[] mapNames = {
    "cividis", "inferno", "magma", "mako",
    "plasma", "rocket", "turbo", "viridis", "greyscale"
  };
  int currentMapIndex = 2;

  FractalRenderer(AppCore appcore) {
    this.appcore = appcore;
    buffer = createGraphics(width, height, P2D);
  }

  void render() {
    buffer.beginDraw();
    buffer.loadPixels();
    buffer.colorMode(RGB, 1.0);

    float ar = (float) width / height;
    double invZoom = 1.0 / appcore.zoom;

    for (int x = 0; x < width; x++) {
      for (int y = 0; y < height; y++) {
        double cx = map(x, 0, width, -2.1f * ar, 1.1f * ar) * invZoom + appcore.offsetX;
        double cy = map(y, 0, height, -2.1f, 1.1f) * invZoom + appcore.offsetY;
        double zx = cx, zy = cy;
        int n = 0;

        while (n < appcore.maxIterations) {
          double zx2 = zx * zx, zy2 = zy * zy;
          if (zx2 + zy2 > 16.0) break;
          double nextZx = zx2 - zy2 + cx;
          zy = Math.abs(2.0 * zx * zy) + cy;
          zx = nextZx;
          n++;
        }

        if (n == appcore.maxIterations) {
          buffer.pixels[x + y * width] = buffer.color(0);
        } else {
          float log_zn = (float) Math.log(zx * zx + zy * zy) / 2.0f;
          float nu = (float) Math.log(log_zn / (float) Math.log(2)) / (float) Math.log(2);
          float t = (n + 1 - nu) / appcore.maxIterations;
          buffer.pixels[x + y * width] = colorLUT[floor(constrain(t, 0, 1) * (LUT_SIZE - 1))];
        }
      }
    }

    buffer.updatePixels();
    buffer.endDraw();
  }

  void setMap(int index) {
    currentMapIndex = index;
    generateLUT();
  }

  void generateLUT() {
    double[][] c = getCoefficients(mapNames[currentMapIndex]);
    colorMode(RGB, 1.0);
    for (int i = 0; i < LUT_SIZE; i++) {
      float t = (float) i / (LUT_SIZE - 1);
      colorLUT[i] = color(
        (float) applyPoly(t, c[0]),
        (float) applyPoly(t, c[1]),
        (float) applyPoly(t, c[2])
      );
    }
    colorMode(RGB, 255);
  }

  private double applyPoly(float t, double[] c) {
    return c[0] + c[1]*t + c[2]*t*t + c[3]*t*t*t + c[4]*t*t*t*t + c[5]*t*t*t*t*t + c[6]*t*t*t*t*t*t;
  }

  private double[][] getCoefficients(String name) {
    if (name.equals("cividis")) return new double[][]{{-0.008973,-0.384689,15.429210,-58.977031,102.370492,-83.187239,25.776070},{0.136756,0.639494,0.385562,-1.404197,2.600914,-2.140750,0.688122},{0.294170,2.982654,-22.363760,74.863561,-121.303164,93.974216,-28.262533}};
    if (name.equals("inferno")) return new double[][]{{0.000214,0.105874,11.617115,-41.709277,77.157454,-71.287667,25.092619},{0.001635,0.566364,-3.947723,17.457724,-33.415679,32.553880,-12.222155},{-0.037130,4.117926,-16.257323,44.645117,-82.253923,73.588132,-23.115650}};
    if (name.equals("magma")) return new double[][]{{-0.002067,0.250486,8.345901,-27.666969,52.170684,-50.758572,18.664253},{-0.000688,0.694455,-3.596031,14.253853,-27.944584,29.053880,-11.490027},{-0.009548,2.495287,0.329057,-13.646583,12.881091,4.269936,-5.570769}};
    if (name.equals("mako")) return new double[][]{{0.032987,1.620032,-5.833466,19.266730,-48.335836,57.794682,-23.674380},{0.013232,0.848348,-1.651402,8.153931,-12.793640,8.555513,-2.172825},{0.040283,0.292971,12.702365,-44.241782,65.176477,-47.319049,14.259791}};
    if (name.equals("plasma")) return new double[][]{{0.064053,2.142438,-2.653255,6.094711,-11.065106,9.974645,-3.623823},{0.024812,0.244749,-7.461101,42.308428,-82.644718,71.408341,-22.914405},{0.534900,0.742966,3.108382,-28.491792,60.093584,-54.020563,18.193381}};
    if (name.equals("rocket")) return new double[][]{{-0.003174,1.947267,-6.401815,30.376433,-57.268147,44.789992,-12.453563},{0.037717,-0.476821,15.073064,-81.403784,173.768416,-158.313952,52.250665},{0.112123,0.400542,6.253872,-21.550609,14.869938,11.402042,-10.648435}};
    if (name.equals("turbo")) return new double[][]{{0.080545,7.008980,-66.727306,228.660253,-334.841257,220.424075,-54.095540},{0.069393,3.147611,-4.927799,25.101273,-69.296265,67.510842,-21.578703},{0.219622,7.655918,-10.162980,-91.680678,288.708703,-305.386975,110.735079}};
    if (name.equals("viridis")) return new double[][]{{0.274455,0.107708,-0.327241,-4.599932,6.203736,4.751787,-5.432077},{0.005768,1.396470,0.214814,-5.758238,14.153965,-13.749439,4.641571},{0.332664,1.386771,0.091977,-19.291809,56.656300,-65.320968,26.272108}};
    return new double[][]{{0,1,0,0,0,0,0},{0,1,0,0,0,0,0},{0,1,0,0,0,0,0}};
  }
}