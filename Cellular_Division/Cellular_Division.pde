/**
 * @file Cellular_Division.pde
 * @author @eanutt1272.v2
 * @version 2.3.0
 */

float custom_pi = PI;

int   NUM_PARTICLES     = 7000;
int   GRID_SIZE         = 30;
float TRAIL_ALPHA       = 200;
float ALPHA             = 180;
float BETA              = 17;
float GAMMA             = 13.4;
float RADIUS            = 15;
int   DENSITY_THRESHOLD = 20;

Species                 species;
ArrayList<Particle>     particles;
ArrayList<Particle>[][] grid;
int                     cols, rows, startMillis;

int                CELLS_INTERVAL = 25;
int                frameCounter   = 0;
int                lastCellPopulation  = 0;
ArrayList<Integer> cellHistory    = new ArrayList<Integer>();

boolean showUI       = true;
boolean needsRebuild = false;
UITheme theme;

AccordionPanel   leftPanel;
Button           restartButton;
float            leftParticleInputX, leftParticleInputY, leftParticleInputW;
AccordionPanel[] rightCol = new AccordionPanel[2];

static final int COL_W   = 200;
static final int COL_GAP = 8;

static final int PARAM_COUNT = 6;
String[] paramLabels = {"Alpha (α)", "Beta (β)", "Gamma (γ)", "Radius (r)", "Trail Alpha (0-255)", "Density Threshold (1-60)"};
float[]  paramMins   = {0, 0, 0, 5, 0, 1};
float[]  paramMaxes  = {360, 90, 50, 50, 255, 60};
float[]  paramStepSm = {1, 1, 0.1, 1, 5, 1};

Slider[] paramSliders  = new Slider[PARAM_COUNT];
Button[] paramMinusBtn = new Button[PARAM_COUNT];
Button[] paramPlusBtn  = new Button[PARAM_COUNT];
float[]  paramValX     = new float[PARAM_COUNT];
float[]  paramValY     = new float[PARAM_COUNT];

static final float VAL_W = 46;
static final float VAL_H = 13;

int     activeTypingParam = -1;
boolean isTypingParticles = false;
String  typingBuffer      = "";

static final int LEFT_W = 255;

void settings() {
  size(1100, 800, P2D);
  pixelDensity(displayDensity());
}

void setup() {
  surface.setResizable(false);
  javax.swing.SwingUtilities.invokeLater(new Runnable() {
    public void run() {
      com.jogamp.newt.opengl.GLWindow w = (com.jogamp.newt.opengl.GLWindow) surface.getNative();
      w.setUndecorated(false);
      w.setSize(width, height);
    }
  });
  
  theme = new UITheme();
  buildPanels();
  initSimulation();
  startMillis = millis();
  background(0);
}

void initSimulation() {
  species   = new Species(ALPHA, BETA, GAMMA, RADIUS);
  particles = new ArrayList<Particle>();
  for (int i = 0; i < NUM_PARTICLES; i++) {
    particles.add(new Particle());
  }
  rebuildGrid();
  cellHistory.clear();
  frameCounter = 0;
  lastCellPopulation = 0;
  startMillis  = millis();
}

void rebuildGrid() {
  cols = ceil(width / (float) GRID_SIZE);
  rows = ceil(height / (float) GRID_SIZE);
  grid = new ArrayList[cols][rows];
  for (int i = 0; i < cols; i++) {
    for (int j = 0; j < rows; j++) {
      grid[i][j] = new ArrayList<Particle>();
    }
  }
}

void buildPanels() {
  leftPanel = new AccordionPanel(10, 10, LEFT_W, theme);
  AccordionGroup stats = new AccordionGroup("Stats", false);
  stats.addRow("fpsRow", 18);
  stats.addRow("timeRow", 18);
  stats.addRow("cellRow", 18);
  leftPanel.addGroup(stats);

  AccordionGroup sim = new AccordionGroup("Simulation", false);
  sim.addRow("particleCaption", 13);
  sim.addRow("particleInput", 24);
  sim.addRow("restartRow", 28);
  leftPanel.addGroup(sim);

  leftPanel.recompute();
  restartButton = new Button(
    leftPanel.contentX(), leftPanel.getY("restartRow"),
    leftPanel.contentW(), 26, "Restart Simulation"
  );
  
  cacheLeftHitBoxes();
  
  int totalRightW = COL_W * 2 + COL_GAP;
  int rightStartX = width - totalRightW - 10;

  for (int col = 0; col < 2; col++) {
    int colX = rightStartX + col * (COL_W + COL_GAP);
    rightCol[col] = new AccordionPanel(colX, 10, COL_W, theme);

    for (int pi = col * 3; pi < col * 3 + 3; pi++) {
      AccordionGroup grp = new AccordionGroup(paramLabels[pi], false);
      grp.addRow("val" + pi, 13);
      grp.addRow("slider" + pi, 18);
      grp.addRow("steps" + pi, 26);
      rightCol[col].addGroup(grp);
    }
    rightCol[col].recompute();
  }

  buildParamWidgets();
}

void buildParamWidgets() {
  float[] initVals = {ALPHA, BETA, GAMMA, RADIUS, TRAIL_ALPHA, DENSITY_THRESHOLD};
  for (int p = 0; p < PARAM_COUNT; p++) {
    AccordionPanel panel = rightCol[p < 3 ? 0 : 1];
    float sx = panel.contentX();
    float sw = panel.contentW();
    float sy = panel.getY("slider" + p);
    float by = panel.getY("steps" + p);
    float vy = panel.getY("val" + p);
    
    if (paramSliders[p] == null) {
      paramSliders[p]  = new Slider(sx, sy, sw, 18, paramMins[p], paramMaxes[p], initVals[p]);
      paramMinusBtn[p] = new Button(sx, by, 26, 24, "\u2212");
      paramPlusBtn[p]  = new Button(sx + 30, by, 26, 24, "+");
    } else {
      paramSliders[p].x  = sx;
      paramSliders[p].y  = sy;
      paramSliders[p].w  = sw;
      paramMinusBtn[p].x = sx;
      paramMinusBtn[p].y = by;
      paramPlusBtn[p].x  = sx + 30;
      paramPlusBtn[p].y  = by;
    }

    paramValX[p] = panel.x + panel.w - panel.padding - VAL_W;
    paramValY[p] = vy;
  }
}

void cacheLeftHitBoxes() {
  leftParticleInputX = leftPanel.contentX();
  leftParticleInputY = leftPanel.getY("particleInput");
  leftParticleInputW = leftPanel.contentW();
}

void draw() {
  frameCounter++;
  if (needsRebuild) {
    initSimulation();
    needsRebuild = false;
  }

  if (showUI) {
    leftPanel.recompute();
    for (AccordionPanel col : rightCol) col.recompute();
    buildParamWidgets();
    cacheLeftHitBoxes();
    restartButton.y = leftPanel.getY("restartRow");
  }

  noStroke();
  fill(0, 255 - TRAIL_ALPHA);
  rect(0, 0, width, height);

  for (int i = 0; i < cols; i++) {
    for (int j = 0; j < rows; j++) {
      grid[i][j].clear();
    }
  }
    
  for (Particle p : particles) {
    int gx = constrain(floor(p.x / GRID_SIZE), 0, cols - 1);
    int gy = constrain(floor(p.y / GRID_SIZE), 0, rows - 1);
    grid[gx][gy].add(p);
    p.visited = false;
  }

  strokeWeight(1);
  for (Particle p : particles) {
    p.countNeighbors();
    p.highDensity = (p.N >= DENSITY_THRESHOLD);
    p.move();
    p.display();
  }

  if (frameCounter % CELLS_INTERVAL == 0) {
    lastCellPopulation = computeCells();
  }
  
  cellHistory.add(lastCellPopulation);
  if (cellHistory.size() > width) {
    cellHistory.remove(0);
  }
  
  if (showUI) {
    drawGraph();
    drawLeftPanel();
    drawRightPanel();
  }
}

void drawLeftPanel() {
  colorMode(RGB, 255);
  leftPanel.drawBackground();
  float px = leftPanel.contentX();

  if (!leftPanel.getGroup("Stats").collapsed) {
    int e = (millis() - startMillis) / 1000;
    fill(theme.textSecondary);
    textSize(theme.textSizeSecondary);
    textAlign(LEFT, TOP);
    text("FPS: " + nf(frameRate, 1, 1), px, leftPanel.getY("fpsRow"));
    text("Time: " + (e / 3600) + "h " + ((e / 60) % 60) + "m " + (e % 60) + "s", px, leftPanel.getY("timeRow"));
    fill(theme.textPrimary);
    text("Cells: " + lastCellPopulation, px, leftPanel.getY("cellRow"));
  }

  if (!leftPanel.getGroup("Simulation").collapsed) {
    fill(theme.textMuted);
    textSize(theme.textSizeCaption);
    textAlign(LEFT, TOP);
    text("Particles (restart to apply)", px, leftPanel.getY("particleCaption"));

    float iy = leftParticleInputY, iw = leftParticleInputW;
    fill(isTypingParticles ? theme.bgActive : theme.bgWidget);
    stroke(isTypingParticles ? theme.strokeFocus : theme.strokeWidget);
    strokeWeight(theme.swWidget);
    rect(px, iy, iw, 22, 3);
    
    fill(theme.textPrimary);
    textSize(theme.textSizeSecondary);
    textAlign(LEFT, TOP);
    text(isTypingParticles ? typingBuffer + "_" : str(NUM_PARTICLES), px + 5, iy + 4);

    restartButton.display();
  }
}

void drawRightPanel() {
  colorMode(RGB, 255);
  for (AccordionPanel col : rightCol) col.drawBackground();
  float[] cur = {ALPHA, BETA, GAMMA, RADIUS, TRAIL_ALPHA, DENSITY_THRESHOLD};

  for (int p = 0; p < PARAM_COUNT; p++) {
    AccordionPanel panel = rightCol[p < 3 ? 0 : 1];
    if (panel.getGroup(paramLabels[p]).collapsed) continue;

    boolean typingThis = (activeTypingParam == p);
    float vy = paramValY[p];
    
    fill(theme.textMuted);
    textSize(theme.textSizeCaption);
    textAlign(LEFT, TOP);
    noStroke();
    text("Value:", panel.contentX(), vy + 1);

    fill(typingThis ? theme.bgActive : theme.bgWidget);
    stroke(typingThis ? theme.strokeFocus : theme.strokeWidget);
    strokeWeight(typingThis ? theme.swWidget : 0.6);
    rect(paramValX[p], vy, VAL_W, VAL_H, 2);
    
    fill(typingThis ? theme.textPrimary : theme.textSecondary);
    textSize(theme.textSizeCaption);
    textAlign(RIGHT, TOP);
    text(typingThis ? typingBuffer + "_" : nf(cur[p], 1, 1), paramValX[p] + VAL_W - 3, vy + 1);
    
    paramSliders[p].val = constrain(cur[p], paramMins[p], paramMaxes[p]);
    paramSliders[p].display();
    paramMinusBtn[p].display();
    paramPlusBtn[p].display();
  }
}

void drawGraph() {
  float gh = 110, gw = LEFT_W;
  float x0 = leftPanel.x;
  float y0 = min(leftPanel.y + leftPanel.totalHeight() + 12, height - gh - 5);

  colorMode(RGB, 255);
  noStroke();
  fill(theme.bgPanel);
  rect(x0, y0, gw, gh, 4);

  int hs = cellHistory.size();
  if (hs < 2) return;

  int rawMax = 0;
  for (int v : cellHistory) rawMax = max(rawMax, v);
  int maxC = max(1, rawMax);

  stroke(theme.strokeSeparator);
  strokeWeight(theme.swSeparator);
  line(x0 + 2, y0, x0 + 2, y0 + gh);
  line(x0 + 2, y0 + gh, x0 + gw, y0 + gh);

  fill(theme.textMuted);
  textSize(9);
  textAlign(RIGHT, CENTER);
  text("0", x0 - 2, y0 + gh);
  text(str(maxC), x0 - 2, y0);
  textAlign(CENTER, TOP);
  text("Cell population over time", x0 + gw / 2, y0 + gh + 3);

  stroke(180, 60, 60);
  strokeWeight(1);
  noFill();
  beginShape();
  for (int i = 0; i < hs; i++) {
    vertex(map(i, 0, hs - 1, x0 + 3, x0 + gw - 2),
           map(cellHistory.get(i), 0, maxC, y0 + gh - 2, y0 + 2));
  }
  endShape();
}

int computeCells() {
  int count = 0;
  for (Particle p : particles) {
    if (p.highDensity && !p.visited) {
      floodFill(p);
      count++;
    }
  }
  for (Particle p : particles) p.visited = false;
  return count;
}

void floodFill(Particle seed) {
  ArrayList<Particle> stack = new ArrayList<Particle>();
  seed.visited = true;
  stack.add(seed);
  
  while (!stack.isEmpty()) {
    Particle cur = stack.remove(stack.size() - 1);
    int gx = floor(cur.x / GRID_SIZE);
    int gy = floor(cur.y / GRID_SIZE);
    
    for (int i = -1; i <= 1; i++) {
      for (int j = -1; j <= 1; j++) {
        int nx = (gx + i + cols) % cols;
        int ny = (gy + j + rows) % rows;
        for (Particle q : grid[nx][ny]) {
          if (!q.visited && q.highDensity) {
            float dx = q.x - cur.x;
            float dy = q.y - cur.y;
            if (dx > width / 2)   dx -= width;
            if (dx < -width / 2)  dx += width;
            if (dy > height / 2)  dy -= height;
            if (dy < -height / 2) dy += height;
            
            if (dx * dx + dy * dy <= species.r2) {
              q.visited = true;
              stack.add(q);
            }
          }
        }
      }
    }
  }
}

void mousePressed() {
  if (showUI && leftPanel.handleHeaderClick(mouseX, mouseY)) {
    leftPanel.recompute();
    cacheLeftHitBoxes();
    restartButton.y = leftPanel.getY("restartRow");
    return;
  }
  
  for (int col = 0; col < 2; col++) {
    if (showUI && rightCol[col].handleHeaderClick(mouseX, mouseY)) {
      rightCol[col].recompute();
      buildParamWidgets();
      return;
    }
  }

  if (!showUI) return;

  if (!leftPanel.getGroup("Simulation").collapsed && restartButton.isMouseOver()) {
    commitTyping();
    needsRebuild = true;
    return;
  }

  if (!leftPanel.getGroup("Simulation").collapsed
      && mouseX > leftParticleInputX && mouseX < leftParticleInputX + leftParticleInputW
      && mouseY > leftParticleInputY && mouseY < leftParticleInputY + 22) {
    commitTyping();
    isTypingParticles = true;
    typingBuffer = "";
    return;
  }

  for (int p = 0; p < PARAM_COUNT; p++) {
    AccordionPanel panel = rightCol[p < 3 ? 0 : 1];
    if (panel.getGroup(paramLabels[p]).collapsed) continue;

    if (mouseX > paramValX[p] && mouseX < paramValX[p] + VAL_W
        && mouseY > paramValY[p] && mouseY < paramValY[p] + VAL_H) {
      commitTyping();
      activeTypingParam = p;
      typingBuffer = nf(getParam(p), 1, 1);
      return;
    }
    
    if (paramSliders[p].isMouseOver()) {
      commitTyping();
      paramSliders[p].locked = true;
      applyParam(p, map(mouseX, paramSliders[p].x, paramSliders[p].x + paramSliders[p].w, paramSliders[p].min, paramSliders[p].max));
      return;
    }
    
    if (paramMinusBtn[p].isMouseOver()) {
      commitTyping();
      applyParam(p, getParam(p) - paramStepSm[p]);
      return;
    }
    
    if (paramPlusBtn[p].isMouseOver()) {
      commitTyping();
      applyParam(p, getParam(p) + paramStepSm[p]);
      return;
    }
  }

  commitTyping();
}

void mouseReleased() {
  for (Slider s : paramSliders) {
    if (s != null) s.locked = false;
  }
}

void mouseDragged() {
  for (int p = 0; p < PARAM_COUNT; p++) {
    if (paramSliders[p] != null && paramSliders[p].locked) {
      applyParam(p, map(mouseX, paramSliders[p].x, paramSliders[p].x + paramSliders[p].w, paramSliders[p].min, paramSliders[p].max));
      return;
    }
  }
}

void keyPressed() {
  if (activeTypingParam >= 0 || isTypingParticles) {
    if (key >= '0' && key <= '9') {
      typingBuffer += key;
      return;
    }
    if (key == '.' && !typingBuffer.contains(".")) {
      typingBuffer += '.';
      return;
    }
    if (keyCode == BACKSPACE && typingBuffer.length() > 0) {
      typingBuffer = typingBuffer.substring(0, typingBuffer.length() - 1);
      return;
    }
    if (keyCode == ENTER || keyCode == RETURN) {
      commitTyping();
      return;
    }
    if (keyCode == ESC) {
      activeTypingParam = -1;
      isTypingParticles = false;
      typingBuffer = "";
      return;
    }
    return;
  }
  
  if (key == 'h' || key == 'H') showUI = !showUI;
  if (key == 'r' || key == 'R') needsRebuild = true;
}

void commitTyping() {
  if (isTypingParticles && typingBuffer.length() > 0) {
    NUM_PARTICLES = constrain(int(typingBuffer), 100, 20000);
  } else if (activeTypingParam >= 0 && typingBuffer.length() > 0) {
    applyParam(activeTypingParam, float(typingBuffer));
  }
  activeTypingParam = -1;
  isTypingParticles = false;
  typingBuffer = "";
}

float getParam(int p) {
  switch(p) {
    case 0: return ALPHA;
    case 1: return BETA;
    case 2: return GAMMA;
    case 3: return RADIUS;
    case 4: return TRAIL_ALPHA;
    case 5: return DENSITY_THRESHOLD;
  }
  return 0;
}

void applyParam(int p, float val) {
  val = constrain(val, paramMins[p], paramMaxes[p]);
  switch(p) {
    case 0: ALPHA = val; break;
    case 1: BETA = val; break;
    case 2: GAMMA = val; break;
    case 3: RADIUS = val; break;
    case 4: TRAIL_ALPHA = val; break;
    case 5: DENSITY_THRESHOLD = (int) val; break;
  }
  if (p <= 3) {
    species = new Species(ALPHA, BETA, GAMMA, RADIUS);
  }
  if (paramSliders[p] != null) {
    paramSliders[p].val = val;
  }
}

class Species {
  float alphaRad, betaRad, v, r2;
  
  Species(float a, float b, float g, float r) {
    alphaRad = radians(a);
    betaRad  = radians(b);
    v        = r * g / 100.0;
    r2       = sq(r);
  }
}

class Particle {
  float x, y, phi, phiSin, phiCos;
  int N, L, R, N_small;
  boolean highDensity, visited;
  
  Particle() {
    x      = random(width);
    y      = random(height);
    phi    = random(TWO_PI);
    phiSin = sin(phi);
    phiCos = cos(phi);
  }

  void countNeighbors() {
    N = L = R = N_small = 0;
    int gx = floor(x / GRID_SIZE);
    int gy = floor(y / GRID_SIZE);
    
    for (int i = -1; i <= 1; i++) {
      for (int j = -1; j <= 1; j++) {
        int nx = (gx + i + cols) % cols;
        int ny = (gy + j + rows) % rows;
        for (Particle q : grid[nx][ny]) {
          if (q == this) continue;
          float dx = q.x - x;
          float dy = q.y - y;
          if (dx > width / 2)   dx -= width;
          if (dx < -width / 2)  dx += width;
          if (dy > height / 2)  dy -= height;
          if (dy < -height / 2) dy += height;
          
          float d2 = dx * dx + dy * dy;
          if (d2 <= species.r2) {
            if (dx * phiSin - dy * phiCos > 0) L++;
            else R++;
            N++;
          }
          if (d2 <= sq(3.9)) N_small++;
        }
      }
    }
  }

  void move() {
    float turn = species.alphaRad + species.betaRad * N * (R > L ? 1 : (R < L ? -1 : 0));
    phi    = (phi + turn) % TWO_PI;
    phiSin = sin(phi);
    phiCos = cos(phi);
    x      = (x + species.v * phiCos + width) % width;
    y      = (y + species.v * phiSin + height) % height;
  }

  void display() {
    colorMode(RGB, 255);
    if      (N_small > 15) stroke(255, 0, 255);
    else if (N > 35)       stroke(255, 255, 0);
    else if (N > 15)       stroke(0, 0, 255);
    else if (N >= 13)      stroke(139, 69, 19);
    else                   stroke(0, 255, 0);
    point(x, y);
  }
}

class AccordionGroup {
  String            name;
  boolean           collapsed;
  ArrayList<String> rowNames   = new ArrayList<String>();
  ArrayList<Float>  rowHeights = new ArrayList<Float>();

  AccordionGroup(String n, boolean c) {
    name      = n;
    collapsed = c;
  }
  
  void addRow(String n, float h) {
    rowNames.add(n);
    rowHeights.add(h);
  }
}

class AccordionPanel {
  float                     x, y, w, padding;
  UITheme                   theme;
  static final float        HEADER_H  = 22;
  static final float        INTRA_GAP = 5;
  static final float        INTER_GAP = 4;
  ArrayList<AccordionGroup> groups    = new ArrayList<AccordionGroup>();
  HashMap<String, Float>    _rowY     = new HashMap<String, Float>();
  HashMap<String, Float>    _headY    = new HashMap<String, Float>();
  float                     _totalH   = 0;
  
  AccordionPanel(float x, float y, float w, UITheme t) {
    this.x  = x;
    this.y  = y;
    this.w  = w;
    padding = 12;
    theme   = t;
  }

  void addGroup(AccordionGroup g) {
    groups.add(g);
  }

  void recompute() {
    _rowY.clear();
    _headY.clear();
    float cursor = y + padding;
    
    for (AccordionGroup g : groups) {
      _headY.put(g.name, cursor);
      cursor += HEADER_H + INTRA_GAP;
      if (!g.collapsed) {
        for (int ri = 0; ri < g.rowNames.size(); ri++) {
          _rowY.put(g.rowNames.get(ri), cursor);
          cursor += g.rowHeights.get(ri) + INTRA_GAP;
        }
      }
      cursor += INTER_GAP;
    }
    _totalH = cursor - y - INTER_GAP + padding;
  }

  float getY(String row) {
    Float v = _rowY.get(row);
    return v != null ? v : y;
  }
  
  float totalHeight() { return _totalH; }
  float contentX()    { return x + padding; }
  float contentW()    { return w - padding * 2; }

  AccordionGroup getGroup(String name) {
    for (AccordionGroup g : groups) {
      if (g.name.equals(name)) return g;
    }
    return null;
  }

  boolean handleHeaderClick(float mx, float my) {
    for (AccordionGroup g : groups) {
      Float hy = _headY.get(g.name);
      if (hy == null) continue;
      if (mx > x && mx < x + w && my > hy && my < hy + HEADER_H) {
        g.collapsed = !g.collapsed;
        return true;
      }
    }
    return false;
  }

  void drawBackground() {
    colorMode(RGB, 255);
    fill(theme.bgPanel);
    stroke(theme.strokePanel);
    strokeWeight(theme.swPanel);
    rect(x, y, w, _totalH, 4);
    
    for (AccordionGroup g : groups) {
      Float _hy = _headY.get(g.name);
      if (_hy == null) continue;
      float hy = _hy;
      boolean hov = mouseX > x && mouseX < x + w && mouseY > hy && mouseY < hy + HEADER_H;

      fill(hov ? theme.bgHover : theme.bgWidget);
      stroke(theme.strokeSeparator);
      strokeWeight(theme.swSeparator);
      rect(x + 1, hy, w - 2, HEADER_H, 3);

      noStroke();
      fill(g.collapsed ? theme.textMuted : theme.textSecondary);
      textSize(11);
      textAlign(LEFT, CENTER);
      text(g.name, x + padding, hy + HEADER_H / 2);
      
      float cx = x + w - padding;
      float cy = hy + HEADER_H / 2;
      stroke(theme.textMuted);
      strokeWeight(1.2);
      noFill();
      
      if (g.collapsed) {
        line(cx - 6, cy - 3, cx - 2, cy);
        line(cx - 2, cy, cx - 6, cy + 3);
      } else {
        line(cx - 6, cy - 2, cx - 2, cy + 2);
        line(cx - 2, cy + 2, cx + 2, cy - 2);
      }
    }
  }
}

class UITheme {
  color bgPanel  = color(18, 18, 22, 218);
  color bgWidget = color(38, 38, 50, 228);
  color bgHover  = color(62, 62, 80, 238);
  color bgActive = color(90, 90, 112, 248);
  
  color textPrimary   = color(238, 238, 238);
  color textSecondary = color(170, 172, 190);
  color textMuted     = color(108, 110, 128);
  
  float textSizePrimary   = 16;
  float textSizeSecondary = 13;
  float textSizeCaption   = 10;
  
  float swPanel = 1.4, swWidget = 1.0, swTrack = 0.8, swSeparator = 0.6;

  color strokePanel     = color(100, 102, 120);
  color strokeWidget    = color(80, 82, 100);
  color strokeTrack     = color(70, 72, 90);
  color strokeSeparator = color(55, 57, 72);
  color strokeFocus     = color(160, 162, 190);
  color accentHandle    = color(210, 212, 235);
}

class Slider {
  float   x, y, w, h, min, max, val;
  boolean locked = false;
  
  Slider(float x, float y, float w, float h, float mn, float mx, float s) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    min    = mn;
    max    = mx;
    val    = s;
  }
  
  void display() {
    colorMode(RGB, 255);
    float ty = y + h / 2;
    stroke(theme.strokeTrack);
    strokeWeight(theme.swTrack);
    line(x, ty, x + w, ty);
    noStroke();
    fill(locked ? theme.accentHandle : theme.textSecondary);
    ellipse(map(val, min, max, x, x + w), ty, h * 0.85, h * 0.85);
  }
  
  boolean isMouseOver() {
    return mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h;
  }
}

class Button {
  float  x, y, w, h;
  String label;
  
  Button(float x, float y, float w, float h, String l) {
    this.x    = x;
    this.y    = y;
    this.w    = w;
    this.h    = h;
    label     = l;
  }
  
  void display() {
    colorMode(RGB, 255);
    fill(isMouseOver() ? theme.bgHover : theme.bgWidget);
    stroke(theme.strokeWidget);
    strokeWeight(theme.swWidget);
    rect(x, y, w, h, 3);
    fill(theme.textPrimary);
    textSize(max(10, h * 0.42));
    textAlign(CENTER, CENTER);
    text(label, x + w / 2, y + h / 2);
  }
  
  boolean isMouseOver() {
    return mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h;
  }
}