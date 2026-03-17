class Dropdown {
  float    x, y, w, h;
  String[] items;
  boolean  isOpen = false;
  UITheme theme;

  Dropdown(float x, float y, float w, float h, String[] items, UITheme theme) {
    this.x=x; this.y=y; this.w=w; this.h=h; this.items=items; this.theme=theme;
  }

  void display(int currentIndex) {
    colorMode(RGB, 255);
    stroke(theme.strokeWidget);
    strokeWeight(theme.swWidget);

    fill(isHeaderOver() ? theme.bgHover : theme.bgWidget);
    rect(x, y, w, h, 3);
    fill(theme.textPrimary);
    textSize(theme.textSizeSecondary);
    textAlign(LEFT, CENTER);
    text("Map: " + items[currentIndex], x + 8, y + h / 2);

    if (isOpen) {
      for (int i = 0; i < items.length; i++) {
        boolean over = mouseX > x && mouseX < x + w && mouseY > y + h + i * h && mouseY < y + 2 * h + i * h;
        fill(over ? theme.bgActive : theme.bgHover);
        rect(x, y + h + i * h, w, h);
        fill(theme.textPrimary);
        text(items[i], x + 8, y + h + i * h + h / 2);
      }
    }
  }

  void toggle() { isOpen = !isOpen; }

  boolean isHeaderOver() {
    return mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h;
  }

  int getClickedIndex() {
    for (int i = 0; i < items.length; i++) {
      if (mouseX > x && mouseX < x + w
       && mouseY > y + h + i * h && mouseY < y + 2 * h + i * h) return i;
    }
    return -1;
  }
}