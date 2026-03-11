class AccordionPanel {
  final float x, y, w;
  final float padding;
  final Theme theme;
  
  static final float HEADER_HEIGHT = 25;
  static final float INTRA_GAP = 5;
  static final float INTER_GAP = 2;
  
  final ArrayList<AccordionGroup> groups = new ArrayList<AccordionGroup>();
  private final HashMap<String, Float> rowY = new HashMap<String, Float>();
  private final HashMap<String, Float> headerY = new HashMap<String, Float>();
  private float totalHeight = 0;
  
  AccordionPanel(float x, float y, float w, Theme theme) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.padding = 7;
    this.theme = theme;
  }
  
  void addGroup(AccordionGroup group) {
    groups.add(group);
  }
  
  void recompute() {
    rowY.clear();
    headerY.clear();
    float cursor = y + padding;
    
    for (AccordionGroup g : groups) {
      headerY.put(g.name, cursor);
      cursor += HEADER_HEIGHT + INTRA_GAP;
      if (!g.collapsed) {
        for (int i = 0; i < g.rowNames.size(); i++) {
          rowY.put(g.rowNames.get(i), cursor);
          cursor += g.rowHeights.get(i) + INTRA_GAP;
        }
      }
      cursor += INTER_GAP;
    }
    totalHeight = cursor - y - INTRA_GAP - INTER_GAP + padding;
  }
  
  float getY(String row) {
    Float v = rowY.get(row);
    return v != null ? v : y;
  }
  
  float getTotalHeight() { return totalHeight; }
  float contentX() { return x + padding * 1.25; }
  float contentW() { return w - padding * 2.5; }
  
  AccordionGroup getGroup(String name) {
    for (AccordionGroup g : groups) {
      if (g.name.equals(name)) return g;
    }
    return null;
  }
  
  boolean handleHeaderClick(float mx, float my) {
    for (AccordionGroup g : groups) {
      Float hy = headerY.get(g.name);
      if (hy == null) continue;
      if (mx > x && mx < x + w && my > hy && my < hy + HEADER_HEIGHT) {
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
    rect(x, y, w, totalHeight, 6);
    
    for (AccordionGroup g : groups) {
      Float hy = headerY.get(g.name);
      if (hy == null) continue;
      
      boolean hovered = mouseX > x && mouseX < x + w && mouseY > hy && mouseY < hy + HEADER_HEIGHT;
      
      fill(hovered ? theme.bgHover : theme.bgWidget);
      stroke(theme.strokeSeparator);
      strokeWeight(theme.swSeparator);
      rect(x + padding, hy, w - padding * 2, HEADER_HEIGHT, 4);
      
      noStroke();
      fill(g.collapsed ? theme.textMuted : theme.textSecondary);
      textSize(12);
      textAlign(LEFT, CENTER);
      text(g.name, x + padding * 2, hy + HEADER_HEIGHT / 2);
      
      drawCollapseIndicator(x + w - padding * 2, hy + HEADER_HEIGHT / 2, g.collapsed);
    }
  }
  
  private void drawCollapseIndicator(float cx, float cy, boolean collapsed) {
    stroke(theme.textMuted);
    strokeWeight(1.5f);
    noFill();
    
    if (collapsed) {
      line(cx - 6, cy - 4, cx - 2, cy);
      line(cx - 2, cy, cx - 6, cy + 4);
    } else {
      line(cx - 8, cy - 2, cx - 4, cy + 2);
      line(cx - 4, cy + 2, cx, cy - 2);
    }
  }
}

