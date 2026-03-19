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
    const hovered = this.isMouseOver();
    fill(hovered ? this.theme.bgHover : this.theme.bgWidget);
    stroke(hovered ? this.theme.strokeFocus : this.theme.strokeWidget);
    strokeWeight(this.theme.swWidget);
    rect(this.x, this.y, this.w, this.h, 5);

    fill(hovered ? this.theme.textPrimary : this.theme.textSecondary);
    textSize(max(11, this.h * 0.45));
    textAlign(CENTER, CENTER);
    text(this.label, this.x + this.w / 2, this.y + this.h / 2 - 1);
  }

  isPressed(mx, my) {
    return (
      mx > this.x && mx < this.x + this.w && my > this.y && my < this.y + this.h
    );
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
