
// @file DLA_Growth.pde
// @author @eanutt1272.v2
// @version 1.0.0
int[][] grid;
int cols, rows;
int scl = 5;
int maxWalkers = 500;
int newWalkers = 10;
int fps = 60;
int growth = 0;

ArrayList<PVector> walkers;

void setup() {
  size(800, 800);
  cols = width / scl;
  rows = height / scl;
  grid = new int[cols][rows];
  grid[cols / 2][rows / 2] = 1;

  walkers = new ArrayList<PVector>();
  for (int i = 0; i < maxWalkers; i++) {
    walkers.add(new PVector(floor(random(cols)), floor(random(rows))));
  }
  frameRate(fps);
}

void draw() {
  frameRate(fps);
  background(0);
  for (int i = 0; i < newWalkers; i++) {
    updateWalkers();
  }
  drawGrid();
}

void updateWalkers() {
  for (int i = walkers.size() - 1; i >= 0; i--) {
    PVector walker = walkers.get(i);
    walker.x += floor(random(-1, 2));
    walker.y += floor(random(-1, 2));
    walker.x = constrain(walker.x, 0, cols - 1);
    walker.y = constrain(walker.y, 0, rows - 1);

    boolean stuck = false;
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        int newX = int(walker.x) + x;
        int newY = int(walker.y) + y;
        if (newX >= 0 && newX < cols && newY >= 0 && newY < rows) {
          if (grid[newX][newY] == 1) {
            grid[int(walker.x)][int(walker.y)] = 1;
            walkers.remove(i);
            stuck = true;
            growth += 1;
            break;
          }
        }
      }
      if (stuck) {
        break;
      }
    }
  }

  while (walkers.size() < maxWalkers) {
    walkers.add(new PVector(floor(random(cols)), floor(random(rows))));
  }
}

void drawGrid() {
  for (int i = 0; i < cols; i++) {
    for (int j = 0; j < rows; j++) {
      if (grid[i][j] == 1) {
        fill(170, 172, 190);
        noStroke();
        rect(i * scl, j * scl, scl, scl);
      } else {
        fill(18, 18, 22, 218);
        noStroke();
        rect(i * scl, j * scl, scl, scl);
      }
    }
  }
}
