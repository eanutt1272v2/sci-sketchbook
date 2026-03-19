class Button {
  constructor(x, y, w, h, label, theme) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.label = label;
    this.theme = theme;
  }

  display() {
    colorMode(RGB, 255);
    fill(this.isMouseOver() ? this.theme.bgHover : this.theme.bgWidget);
    stroke(this.theme.strokeWidget);
    strokeWeight(this.theme.swWidget);
    rect(this.x, this.y, this.w, this.h, 3);
    fill(this.theme.textPrimary);
    textSize(max(11, this.h * 0.42));
    textAlign(CENTER, CENTER);
    text(this.label, this.x + this.w / 2, this.y + this.h / 2);
  }

  isMouseOver() {
    return (
      mouseX > this.x &&
      mouseX < this.x + this.w &&
      mouseY > this.y &&
      mouseY < this.y + this.h
    );
  }
}
