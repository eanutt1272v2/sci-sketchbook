class SliderComponent {
  constructor(x, y, w, h, minValue, maxValue, val, theme) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.min = minValue;
    this.max = maxValue;
    this.val = val;
    this.locked = false;
    this.theme = theme;
  }

  display() {
    colorMode(RGB, 255);
    const trackY = this.y + this.h / 2;
    stroke(this.theme.strokeTrack);
    strokeWeight(this.theme.swTrack);
    line(this.x, trackY, this.x + this.w, trackY);

    const handleX = map(this.val, this.min, this.max, this.x, this.x + this.w);
    noStroke();
    fill(
      this.locked
        ? this.theme.accentHandle
        : this.isMouseOver()
          ? this.theme.textPrimary
          : this.theme.textSecondary
    );
    ellipse(handleX, trackY, this.h * 0.5, this.h * 0.5);
  }

  isPressed(mx, my) {
    return mx > this.x - 5 && mx < this.x + this.w + 5 && my > this.y && my < this.y + this.h;
  }

  isMouseOver() {
    return (
      mouseX > this.x - 5 &&
      mouseX < this.x + this.w + 5 &&
      mouseY > this.y &&
      mouseY < this.y + this.h
    );
  }

  getX() {
    return this.x;
  }

  getWidth() {
    return this.w;
  }

  getMin() {
    return this.min;
  }

  getMax() {
    return this.max;
  }
}