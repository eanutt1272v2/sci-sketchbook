class Button {
  float  x, y, w, h;
  String label;
  UITheme theme;

  Button(float x, float y, float w, float h, String label, UITheme theme) {
    this.x=x; this.y=y; this.w=w; this.h=h; this.label=label; this.theme=theme;
  }

  void display() {
    colorMode(RGB, 255);
    fill(isMouseOver() ? theme.bgHover : theme.bgWidget);
    stroke(theme.strokeWidget);
    strokeWeight(theme.swWidget);
    rect(x, y, w, h, 3);
    fill(theme.textPrimary);
    textSize(max(11, h * 0.42));
    textAlign(CENTER, CENTER);
    text(label, x + w / 2, y + h / 2);
  }

  boolean isMouseOver() {
    return mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h;
  }
}