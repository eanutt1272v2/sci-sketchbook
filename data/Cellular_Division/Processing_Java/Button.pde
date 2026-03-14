class Button {
  float x, y, w, h;
  final String label;
  final Theme theme;
  
  Button(float x, float y, float w, float h, String label, Theme theme) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.label = label;
    this.theme = theme;
  }
  
  void display() {
    colorMode(RGB, 255);
    boolean hovered = isMouseOver();
    fill(hovered ? theme.bgHover : theme.bgWidget);
    stroke(hovered ? theme.strokeFocus : theme.strokeWidget);
    strokeWeight(theme.swWidget);
    rect(x, y, w, h, 5);
    
    fill(hovered ? theme.textPrimary : theme.textSecondary);
    textSize(max(11, h * 0.45f));
    textAlign(CENTER, CENTER);
    text(label, x + w / 2, y + h / 2 - 1);
  }
  
  boolean isPressed(float mx, float my) {
    return mx > x && mx < x + w && my > y && my < y + h;
  }
  
  boolean isMouseOver() {
    return mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h;
  }
}