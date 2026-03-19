class AccordionPanel {
  static HEADER_HEIGHT = 25;
  static INTRA_GAP = 5;
  static INTER_GAP = 2;

  constructor(x, y, w, theme) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.padding = 7;
    this.theme = theme;

    this.groups = [];
    this.rowY = new Map();
    this.headerY = new Map();
    this.totalHeight = 0;
  }

  addGroup(group) {
    this.groups.push(group);
  }

  recompute() {
    this.rowY.clear();
    this.headerY.clear();
    let cursor = this.y + this.padding;

    for (const g of this.groups) {
      this.headerY.set(g.name, cursor);
      cursor += AccordionPanel.HEADER_HEIGHT + AccordionPanel.INTRA_GAP;
      if (!g.collapsed) {
        for (let i = 0; i < g.rowNames.length; i++) {
          this.rowY.set(g.rowNames[i], cursor);
          cursor += g.rowHeights[i] + AccordionPanel.INTRA_GAP;
        }
      }
      cursor += AccordionPanel.INTER_GAP;
    }

    this.totalHeight =
      cursor -
      this.y -
      AccordionPanel.INTRA_GAP -
      AccordionPanel.INTER_GAP +
      this.padding;
  }

  getY(row) {
    return this.rowY.has(row) ? this.rowY.get(row) : this.y;
  }

  getTotalHeight() {
    return this.totalHeight;
  }

  contentX() {
    return this.x + this.padding * 1.25;
  }

  contentW() {
    return this.w - this.padding * 2.5;
  }

  getGroup(name) {
    for (const g of this.groups) {
      if (g.name === name) {
        return g;
      }
    }
    return null;
  }

  handleHeaderClick(mx, my) {
    for (const g of this.groups) {
      if (!this.headerY.has(g.name)) {
        continue;
      }
      const hy = this.headerY.get(g.name);
      if (
        mx > this.x &&
        mx < this.x + this.w &&
        my > hy &&
        my < hy + AccordionPanel.HEADER_HEIGHT
      ) {
        g.collapsed = !g.collapsed;
        return true;
      }
    }
    return false;
  }

  drawBackground() {
    colorMode(RGB, 255);
    fill(this.theme.bgPanel);
    stroke(this.theme.strokePanel);
    strokeWeight(this.theme.swPanel);
    rect(this.x, this.y, this.w, this.totalHeight, 6);

    for (const g of this.groups) {
      if (!this.headerY.has(g.name)) {
        continue;
      }
      const hy = this.headerY.get(g.name);
      const hovered =
        mouseX > this.x &&
        mouseX < this.x + this.w &&
        mouseY > hy &&
        mouseY < hy + AccordionPanel.HEADER_HEIGHT;

      fill(hovered ? this.theme.bgHover : this.theme.bgWidget);
      stroke(this.theme.strokeSeparator);
      strokeWeight(this.theme.swSeparator);
      rect(
        this.x + this.padding,
        hy,
        this.w - this.padding * 2,
        AccordionPanel.HEADER_HEIGHT,
        4,
      );

      noStroke();
      fill(g.collapsed ? this.theme.textMuted : this.theme.textSecondary);
      textSize(12);
      textAlign(LEFT, CENTER);
      text(
        g.name,
        this.x + this.padding * 2,
        hy + AccordionPanel.HEADER_HEIGHT / 2,
      );

      this.drawCollapseIndicator(
        this.x + this.w - this.padding * 2,
        hy + AccordionPanel.HEADER_HEIGHT / 2,
        g.collapsed,
      );
    }
  }

  drawCollapseIndicator(cx, cy, collapsed) {
    stroke(this.theme.textMuted);
    strokeWeight(1.5);
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
