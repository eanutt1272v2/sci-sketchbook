class Slider {
  constructor(x, y, w, h, minVal, maxVal, start, theme) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.min = minVal;
    this.max = maxVal;
    this.val = start;
    this.theme = theme;

    this.locked = false;
  }

  display() {
    colorMode(RGB, 255);
    const trackY = this.y + this.h / 2;
    stroke(this.theme.strokeTrack);
    strokeWeight(this.theme.swTrack);
    line(this.x, trackY, this.x + this.w, trackY);

    const handleX = map(this.val, this.min, this.max, this.x, this.x + this.w);
    noStroke();
    fill(this.locked ? this.theme.accentHandle : this.theme.textSecondary);
    ellipse(handleX, trackY, this.h * 0.75, this.h * 0.75);
  }

  update() {
    if (this.locked) {
      this.val = constrain(map(mouseX, this.x, this.x + this.w, this.min, this.max), this.min, this.max);
      return true;
    }
    return false;
  }

  isMouseOver() {
    return mouseX > this.x && mouseX < this.x + this.w && mouseY > this.y && mouseY < this.y + this.h;
  }
}