class Slider {
  float x, y, w, h, min, max, val;
  boolean locked = false;
  UITheme theme;

  Slider(float x, float y, float w, float h, float min, float max, float start, UITheme theme) {
    this.x=x; this.y=y; this.w=w; this.h=h;
    this.min=min; this.max=max; this.val=start;
    this.theme=theme;
  }

  void display() {
    colorMode(RGB, 255);
    float trackY = y + h / 2;
    stroke(theme.strokeTrack);
    strokeWeight(theme.swTrack);
    line(x, trackY, x + w, trackY);

    float handleX = map(val, min, max, x, x + w);
    noStroke();
    fill(locked ? theme.accentHandle : theme.textSecondary);
    ellipse(handleX, trackY, h * 0.75, h * 0.75);
  }

  boolean update() {
    if (locked) { val = constrain(map(mouseX, x, x + w, min, max), min, max); return true; }
    return false;
  }

  boolean isMouseOver() {
    return mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h;
  }
}
