class SliderComponent {
  float x, y, w, h;
  final float min, max;
  float val;
  boolean locked = false;
  final Theme theme;
  
  SliderComponent(float x, float y, float w, float h, float min, float max, float val, Theme theme) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.min = min;
    this.max = max;
    this.val = val;
    this.theme = theme;
  }
  
  void display() {
    colorMode(RGB, 255);
    float trackY = y + h / 2;
    stroke(theme.strokeTrack);
    strokeWeight(theme.swTrack);
    line(x, trackY, x + w, trackY);
    
    float handleX = map(val, min, max, x, x + w);
    noStroke();
    fill(locked ? theme.accentHandle : (isMouseOver() ? theme.textPrimary : theme.textSecondary));
    ellipse(handleX, trackY, h * 0.5f, h * 0.5f);
  }
  
  boolean isPressed(float mx, float my) {
    return mx > x - 5 && mx < x + w + 5 && my > y && my < y + h;
  }
  
  boolean isMouseOver() {
    return mouseX > x - 5 && mouseX < x + w + 5 && mouseY > y && mouseY < y + h;
  }
  
  float getX() { return x; }
  float getWidth() { return w; }
  float getMin() { return min; }
  float getMax() { return max; }
}

