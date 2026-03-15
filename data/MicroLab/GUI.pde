// @file GUI.pde
// @author @eanutt1272.v2
// @version 4.0.0

class GUI {
   static final String ACT_PAUSE = "pause";
   static final String ACT_MOUSE = "mouse";
   static final String ACT_BURST = "burst";
   static final String ACT_TRAILS = "trails";
   static final String ACT_HUD = "hud";
   static final String ACT_RESET_VIEW = "reset-view";

   static final String ACT_RESTART = "restart";
   static final String ACT_CLEAR = "clear";
   static final String ACT_NEW_TYPES = "new-types";
   static final String ACT_NEW_RULES = "new-rules";
   static final String ACT_EVOLVE = "evolve";
   static final String ACT_RENDER = "render";
   static final String ACT_BOUNDS = "bounds";

   static final String ACT_ZOOM_IN = "zoom-in";
   static final String ACT_ZOOM_OUT = "zoom-out";
   static final String ACT_SCREENSHOT = "screenshot";

   static final String ACT_VISC_DOWN = "viscosity-down";
   static final String ACT_VISC_UP = "viscosity-up";
   static final String ACT_BRUSH_DOWN = "brush-down";
   static final String ACT_BRUSH_UP = "brush-up";
   static final String ACT_SPEED_DOWN = "speed-down";
   static final String ACT_SPEED_UP = "speed-up";

   Manager man;

   ArrayList<UIButton> quickButtons = new ArrayList<UIButton>();
   ArrayList<UIButton> worldButtons = new ArrayList<UIButton>();
   ArrayList<UIButton> renderButtons = new ArrayList<UIButton>();
   ArrayList<UIButton> tuneButtons = new ArrayList<UIButton>();
   ArrayList<UIButton> allButtons = new ArrayList<UIButton>();

   int selected = -1;
   int fps = 0;
   int simTime = 0;
   int lastTime = millis();

   boolean running = true;
   boolean justPressed = false;
   boolean previousMouseDown = false;

   int guiStroke = 220;
   int guiStrokeWeight = 2;

   int panelFill = color(10, 14, 24, 228);
   int panelStroke = color(56, 118, 198, 180);
   int panelAccent = color(94, 212, 248, 180);
   int textPrimary = color(232, 240, 250);
   int textSecondary = color(165, 182, 206);
   int textMuted = color(122, 137, 157);

   UIFrame topBar;
   UIFrame statsPanel;
   UIFrame toolsPanel;
   UIFrame typePanel;

   float typeDotSpacing = 34;
   float typeHitRadius = 16;

   int lastWidth = -1;
   int lastHeight = -1;

   GUI(Manager man) {
      this.man = man;
      rebuildLayout();
      rebuildControls();
      syncSelectionState();
   }

   void rebuildLayout() {
      float margin = 14;
      float barH = 44;

      topBar = new UIFrame(margin, margin, width - margin * 2, barH, "Quick Tools");

      float leftW = constrain(width * 0.25, 260, 360);
      float rightW = constrain(width * 0.24, 255, 340);
      float panelsY = topBar.y + topBar.h + 10;

      float statsH = constrain(height * 0.44, 240, 360);
      statsPanel = new UIFrame(margin, panelsY, leftW, statsH, "Statistics");

      float toolsH = height - panelsY - 42;
      toolsPanel = new UIFrame(width - margin - rightW, panelsY, rightW, toolsH, "Tools");

      typePanel = new UIFrame(margin, statsPanel.y + statsPanel.h + 10, leftW, 40, "Type Palette");
   }

   void rebuildControls() {
      clearButtonLists();

      float x = topBar.x + 10;
      float y = topBar.y + 17;
      float h = 22;
      x = addButton(quickButtons, x, y, 84, h, ACT_PAUSE, "Pause", "Space");
      x = addButton(quickButtons, x, y, 86, h, ACT_MOUSE, "Mouse", "M");
      x = addButton(quickButtons, x, y, 80, h, ACT_BURST, "Burst", "G");
      x = addButton(quickButtons, x, y, 80, h, ACT_TRAILS, "Trails", "L");
      x = addButton(quickButtons, x, y, 72, h, ACT_HUD, "HUD", "U");
      addButton(quickButtons, x, y, 108, h, ACT_RESET_VIEW, "Reset View", "0");

      float px = toolsPanel.x + 10;
      float py = toolsPanel.y + 20;
      float rowH = 26;
      float rowGap = 6;
      float half = (toolsPanel.w - 30) * 0.5;

      py = addPair(worldButtons, px, py, half, rowH, ACT_RESTART, "Restart", "R", ACT_CLEAR, "Clear", "C");
      py = addPair(worldButtons, px, py, half, rowH, ACT_NEW_TYPES, "New Types", "N", ACT_NEW_RULES, "New Rules", "T");
      py = addPair(worldButtons, px, py, half, rowH, ACT_EVOLVE, "Evolve", "E", ACT_RENDER, "Render", "V");
      py = addPair(worldButtons, px, py, half, rowH, ACT_BOUNDS, "Bounds", "B", ACT_SCREENSHOT, "Shot", "P");
      py += rowGap;

      py = addPair(renderButtons, px, py, half, rowH, ACT_ZOOM_IN, "Zoom +", "]", ACT_ZOOM_OUT, "Zoom -", "[");
      py += rowGap;

      py = addPair(tuneButtons, px, py, half, rowH, ACT_VISC_DOWN, "Visc -", "-", ACT_VISC_UP, "Visc +", "=");
      py = addPair(tuneButtons, px, py, half, rowH, ACT_BRUSH_DOWN, "Brush -", ",", ACT_BRUSH_UP, "Brush +", ".");
      addPair(tuneButtons, px, py, half, rowH, ACT_SPEED_DOWN, "Speed -", "/", ACT_SPEED_UP, "Speed +", "\\");

      mergeButtonLists();
   }

   void clearButtonLists() {
      quickButtons.clear();
      worldButtons.clear();
      renderButtons.clear();
      tuneButtons.clear();
      allButtons.clear();
   }

   float addButton(ArrayList<UIButton> list, float x, float y, float w, float h, String action, String label, String hint) {
      list.add(new UIButton(x, y, w, h, action, label, hint));
      return x + w + 8;
   }

   float addPair(ArrayList<UIButton> list, float x, float y, float w, float h, String actionA, String labelA, String hintA, String actionB, String labelB, String hintB) {
      list.add(new UIButton(x, y, w, h, actionA, labelA, hintA));
      list.add(new UIButton(x + w + 10, y, w, h, actionB, labelB, hintB));
      return y + h + 6;
   }

   void mergeButtonLists() {
      allButtons.addAll(quickButtons);
      allButtons.addAll(worldButtons);
      allButtons.addAll(renderButtons);
      allButtons.addAll(tuneButtons);
   }

   void update() {
      handleResize();
      handleInput();
      updateTimers();
      syncSelectionState();
      drawUI();
   }

   void handleResize() {
      if (width != lastWidth || height != lastHeight) {
         lastWidth = width;
         lastHeight = height;
         rebuildLayout();
         rebuildControls();
      }
   }

   void handleInput() {
      justPressed = false;

      boolean leftDown = mousePressed && mouseButton == LEFT;
      boolean leftEdge = leftDown && !previousMouseDown;

      if (leftEdge) {
         if (handleTypeClick()) {
            justPressed = true;
         } else if (handleButtonClick()) {
            justPressed = true;
         } else if (canPlaceParticle()) {
            man.addParticle(selected, mouseX, mouseY);
         }
      }

      if (mousePressed && mouseButton == CENTER && canPan()) {
         panCamera();
      }

      previousMouseDown = leftDown;
   }

   boolean handleButtonClick() {
      for (UIButton b : allButtons) {
         if (b.hit(mouseX, mouseY)) {
            runAction(b.action);
            return true;
         }
      }
      return false;
   }

   boolean handleTypeClick() {
      float panelX = typePanel.x + 10;
      float panelY = typePanel.y + 21;

      for (int i = 0; i < man.types.size(); i++) {
         float cx = panelX + i * typeDotSpacing;
         float cy = panelY;
         if (dist(mouseX, mouseY, cx, cy) <= typeHitRadius) {
            selected = (selected == i) ? -1 : i;
            mouse.selected = false;
            return true;
         }
      }
      return false;
   }

   boolean canPlaceParticle() {
      return selected != -1 && !mouse.selected && !isMouseOverUI(mouseX, mouseY);
   }

   boolean canPan() {
      return !mouse.selected && selected == -1 && !isMouseOverUI(mouseX, mouseY);
   }

   boolean isMouseOverUI(float mx, float my) {
      if (topBar.contains(mx, my)) return true;
      if (statsPanel.contains(mx, my)) return true;
      if (toolsPanel.contains(mx, my)) return true;
      if (typePanel.contains(mx, my)) return true;
      return false;
   }

   void panCamera() {
      PVector now = man.reverseTranslateCoords(mouseX, mouseY);
      PVector prev = man.reverseTranslateCoords(pmouseX, pmouseY);
      offsetX -= (now.x - prev.x);
      offsetY -= (now.y - prev.y);
   }

   void updateTimers() {
      int now = millis();
      if (now - lastTime >= 1000) {
         fps = round(frameRate);
         if (running) {
            simTime++;
         }
         lastTime = now;
      }
   }

   void syncSelectionState() {
      resetButtonStates();
      markAction(ACT_PAUSE, !running);
      markAction(ACT_MOUSE, mouse != null && mouse.selected);
      markAction(ACT_TRAILS, useTrails);
      markAction(ACT_HUD, showHUD);
      markAction(ACT_EVOLVE, useEvolveRules);
      markAction(ACT_RENDER, useRect);
      markAction(ACT_BOUNDS, showBounds);
   }

   void resetButtonStates() {
      for (UIButton b : allButtons) {
         b.selected = false;
      }
   }

   void markAction(String action, boolean active) {
      if (!active) {
         return;
      }
      for (UIButton b : allButtons) {
         if (b.action.equals(action)) {
            b.selected = true;
         }
      }
   }

   void drawUI() {
      drawFrame(topBar);
      drawFrame(statsPanel);
      drawFrame(toolsPanel);
      drawFrame(typePanel);

      drawToolbar();
      drawStats();
      drawToolsSectionLabels();
      drawButtons();
      drawTypePalette();
      if (showHUD) {
         drawFooterHints();
      }
   }

   void drawFrame(UIFrame f) {
      noStroke();
      fill(panelFill);
      rect(f.x, f.y, f.w, f.h, 11);

      stroke(panelStroke);
      strokeWeight(1.1);
      noFill();
      rect(f.x, f.y, f.w, f.h, 11);

      noStroke();
      fill(panelAccent);
      rect(f.x + 1, f.y + 1, f.w - 2, 3, 11);

      fill(textPrimary);
      textAlign(LEFT, CENTER);
      textSize(12);
      text(f.title, f.x + 10, f.y + 9);
   }

   void drawToolbar() {
      fill(textMuted);
      textAlign(RIGHT, CENTER);
      textSize(10);
      text("Center mouse drag: pan", topBar.x + topBar.w - 10, topBar.y + 9);
   }

   void drawStats() {
      float x = statsPanel.x + 10;
      float y = statsPanel.y + 20;

      fill(textSecondary);
      textAlign(LEFT, TOP);
      textSize(10);
      text("Runtime", x, y);
      y += 14;

      fill(textPrimary);
      textSize(12);
      text("FPS: " + fps + "    Time: " + simTime + "s", x, y);
      y += 15;
      text("Particles: " + man.particles.size(), x, y);
      y += 15;
      text("Types: " + man.types.size(), x, y);
      y += 15;
      text("Selected: " + selectedLabel(), x, y);
      y += 19;

      fill(textSecondary);
      textSize(10);
      text("Simulation", x, y);
      y += 14;

      fill(textPrimary);
      textSize(12);
      text("Viscosity: " + nfc(viscosity, 3), x, y);
      y += 15;
      text("Max Speed: " + nfc(maxSpeed, 1), x, y);
      y += 15;
      text("Interaction R: " + nfc(man.interactionRadius, 1), x, y);
      y += 15;
      text("Grid: " + man.gridCols + " x " + man.gridRows, x, y);
      y += 19;

      fill(textSecondary);
      textSize(10);
      text("Camera", x, y);
      y += 14;

      fill(textPrimary);
      textSize(12);
      text("Zoom: " + nfc(zoom, 2) + "x", x, y);
      y += 15;
      text("Offset: " + nfc(offsetX, 1) + ", " + nfc(-offsetY, 1), x, y);
      y += 15;
      text("Brush: " + nfc(mouse.radius, 1), x, y);
   }

   void drawToolsSectionLabels() {
      float x = toolsPanel.x + 10;
      fill(textMuted);
      textAlign(LEFT, TOP);
      textSize(10);
      text("World", x, toolsPanel.y + 14);
      text("Camera", x, toolsPanel.y + 130);
      text("Tuning", x, toolsPanel.y + 198);
   }

   void drawButtons() {
      for (UIButton b : allButtons) {
         b.draw();
      }
   }

   void drawTypePalette() {
      float baseX = typePanel.x + 10;
      float cy = typePanel.y + 21;

      for (int i = 0; i < man.types.size(); i++) {
         float cx = baseX + i * typeDotSpacing;

         noStroke();
         fill(man.types.get(i).c);
         ellipse(cx, cy, 23, 23);

         if (selected == i) {
            noFill();
            stroke(panelAccent);
            strokeWeight(2);
            ellipse(cx, cy, 30, 30);
         }

         fill(245);
         textAlign(CENTER, CENTER);
         textSize(9);
         text(str((i + 1) % 10), cx, cy + 1);
      }
   }

   void drawFooterHints() {
      float h = 22;
      noStroke();
      fill(6, 10, 18, 184);
      rect(0, height - h, width, h);

      fill(textSecondary);
      textAlign(LEFT, CENTER);
      textSize(11);
      text("1-9 type  |  Space pause  |  M mouse  |  [ ] zoom  |  , . brush  |  - = visc  |  / \\ speed", 10, height - h * 0.5);
   }

   String selectedLabel() {
      if (selected < 0) {
         return "none";
      }
      return "type " + (selected + 1);
   }

   void runAction(String action) {
      if (action.equals(ACT_PAUSE)) {
         running = !running;
         return;
      }
      if (action.equals(ACT_MOUSE)) {
         mouse.selected = !mouse.selected;
         if (mouse.selected) {
            selected = -1;
         }
         return;
      }
      if (action.equals(ACT_BURST)) {
         int typeIndex = selected >= 0 ? selected : 0;
         man.addBurst(200, typeIndex, mouseX, mouseY, 60 * worldScale);
         return;
      }
      if (action.equals(ACT_TRAILS)) {
         useTrails = !useTrails;
         return;
      }
      if (action.equals(ACT_HUD)) {
         showHUD = !showHUD;
         return;
      }
      if (action.equals(ACT_RESET_VIEW)) {
         zoom = 1;
         offsetX = 0;
         offsetY = 0;
         return;
      }

      if (action.equals(ACT_RESTART)) {
         man.particles.clear();
         simTime = 0;
         useInitialParticles = true;
         return;
      }
      if (action.equals(ACT_CLEAR)) {
         man.particles.clear();
         simTime = 0;
         useInitialParticles = false;
         return;
      }
      if (action.equals(ACT_NEW_TYPES)) {
         man.particles.clear();
         man.types.clear();
         man.randomTypes();
         simTime = 0;
         useInitialParticles = true;
         return;
      }
      if (action.equals(ACT_NEW_RULES)) {
         man.newRules();
         return;
      }
      if (action.equals(ACT_EVOLVE)) {
         useEvolveRules = !useEvolveRules;
         return;
      }
      if (action.equals(ACT_RENDER)) {
         useRect = !useRect;
         return;
      }
      if (action.equals(ACT_BOUNDS)) {
         showBounds = !showBounds;
         return;
      }

      if (action.equals(ACT_ZOOM_IN)) {
         zoom *= zoomRate;
         return;
      }
      if (action.equals(ACT_ZOOM_OUT)) {
         zoom /= zoomRate;
         return;
      }
      if (action.equals(ACT_SCREENSHOT)) {
         saveFrame("microlab-######.png");
         return;
      }

      if (action.equals(ACT_VISC_DOWN)) {
         viscosity = max(0.05, viscosity - 0.03);
         return;
      }
      if (action.equals(ACT_VISC_UP)) {
         viscosity = min(1.35, viscosity + 0.03);
         return;
      }
      if (action.equals(ACT_BRUSH_DOWN)) {
         mouse.radius = max(8, mouse.radius - 6);
         return;
      }
      if (action.equals(ACT_BRUSH_UP)) {
         mouse.radius = min(260, mouse.radius + 6);
         return;
      }
      if (action.equals(ACT_SPEED_DOWN)) {
         maxSpeed = max(10, maxSpeed - 20);
         return;
      }
      if (action.equals(ACT_SPEED_UP)) {
         maxSpeed = min(1500, maxSpeed + 20);
         return;
      }
   }

   void mouseDragged() {
      if (canPan()) {
         panCamera();
      }
   }

   void handleKey(char rawKey, int keyCode) {
      char k = Character.toLowerCase(rawKey);

      if (k == ' ') { runAction(ACT_PAUSE); return; }
      if (k == 'm') { runAction(ACT_MOUSE); return; }
      if (k == 'g') { runAction(ACT_BURST); return; }
      if (k == 'l') { runAction(ACT_TRAILS); return; }
      if (k == 'u') { runAction(ACT_HUD); return; }
      if (k == '0') { runAction(ACT_RESET_VIEW); return; }

      if (k == 'r') { runAction(ACT_RESTART); return; }
      if (k == 'c') { runAction(ACT_CLEAR); return; }
      if (k == 'n') { runAction(ACT_NEW_TYPES); return; }
      if (k == 't') { runAction(ACT_NEW_RULES); return; }
      if (k == 'e') { runAction(ACT_EVOLVE); return; }
      if (k == 'v') { runAction(ACT_RENDER); return; }
      if (k == 'b') { runAction(ACT_BOUNDS); return; }

      if (k == '[') { runAction(ACT_ZOOM_OUT); return; }
      if (k == ']') { runAction(ACT_ZOOM_IN); return; }
      if (k == 'p') { runAction(ACT_SCREENSHOT); return; }

      if (k == '-') { runAction(ACT_VISC_DOWN); return; }
      if (k == '=') { runAction(ACT_VISC_UP); return; }
      if (k == ',') { runAction(ACT_BRUSH_DOWN); return; }
      if (k == '.') { runAction(ACT_BRUSH_UP); return; }
      if (k == '/') { runAction(ACT_SPEED_DOWN); return; }
      if (k == '\\') { runAction(ACT_SPEED_UP); return; }

      if (k >= '1' && k <= '9') {
         int index = (int) (k - '1');
         if (index < man.types.size()) {
            selected = index;
            mouse.selected = false;
         }
         return;
      }

      if (keyCode == UP) {
         runAction(ACT_ZOOM_IN);
         return;
      }
      if (keyCode == DOWN) {
         runAction(ACT_ZOOM_OUT);
         return;
      }
   }
}

class UIFrame {
   float x;
   float y;
   float w;
   float h;
   String title;

   UIFrame(float x, float y, float w, float h, String title) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.title = title;
   }

   boolean contains(float px, float py) {
      return px >= x && px <= x + w && py >= y && py <= y + h;
   }
}

class UIButton {
   float x;
   float y;
   float w;
   float h;

   String action;
   String label;
   String hint;

   boolean selected = false;

   UIButton(float x, float y, float w, float h, String action, String label, String hint) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.action = action;
      this.label = label;
      this.hint = hint;
   }

   void draw() {
      boolean hover = hit(mouseX, mouseY);

      if (selected) {
         fill(84, 148, 220, 232);
      } else if (hover) {
         fill(56, 76, 108, 214);
      } else {
         fill(20, 28, 44, 210);
      }

      if (selected) {
         stroke(gui.panelAccent);
         strokeWeight(gui.guiStrokeWeight);
      } else {
         stroke(72, 94, 128, 142);
         strokeWeight(1);
      }

      rect(x, y, w, h, 7);

      fill(gui.textPrimary);
      textAlign(LEFT, CENTER);
      textSize(11);
      text(label, x + 8, y + h * 0.52);

      fill(gui.textSecondary);
      textAlign(RIGHT, CENTER);
      textSize(10);
      text(hint, x + w - 7, y + h * 0.52);
   }

   boolean hit(float px, float py) {
      return px >= x && px <= x + w && py >= y && py <= y + h;
   }
}
