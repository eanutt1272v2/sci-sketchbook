class Dropdown {
  constructor(x, y, w, h, items, theme) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.items = items;
    this.theme = theme;

    this.isOpen = false;
  }

  display(currentIndex) {
    colorMode(RGB, 255);
    stroke(this.theme.strokeWidget);
    strokeWeight(this.theme.swWidget);

    fill(this.isHeaderOver() ? this.theme.bgHover : this.theme.bgWidget);
    rect(this.x, this.y, this.w, this.h, 3);
    fill(this.theme.textPrimary);
    textSize(this.theme.textSizeSecondary);
    textAlign(LEFT, CENTER);
    text(
      `Map: ${this.items[currentIndex].charAt(0).toUpperCase() + this.items[currentIndex].slice(1)}`,
      this.x + 8,
      this.y + this.h / 2,
    );

    if (this.isOpen) {
      for (let i = 0; i < this.items.length; i++) {
        const over =
          mouseX > this.x &&
          mouseX < this.x + this.w &&
          mouseY > this.y + this.h + i * this.h &&
          mouseY < this.y + 2 * this.h + i * this.h;
        fill(over ? this.theme.bgActive : this.theme.bgHover);
        rect(this.x, this.y + this.h + i * this.h, this.w, this.h);
        fill(this.theme.textPrimary);
        text(
          this.items[i].charAt(0).toUpperCase() + this.items[i].slice(1),
          this.x + 8,
          this.y + this.h + i * this.h + this.h / 2,
        );
      }
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
  }

  isHeaderOver() {
    return (
      mouseX > this.x &&
      mouseX < this.x + this.w &&
      mouseY > this.y &&
      mouseY < this.y + this.h
    );
  }

  getClickedIndex() {
    for (let i = 0; i < this.items.length; i++) {
      if (
        mouseX > this.x &&
        mouseX < this.x + this.w &&
        mouseY > this.y + this.h + i * this.h &&
        mouseY < this.y + 2 * this.h + i * this.h
      ) {
        return i;
      }
    }
    return -1;
  }
}
