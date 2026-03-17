class UILayout {
  constructor(x, y, w, padding, intraGap, interGap) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.padding = padding;
    this.intraGap = intraGap;
    this.interGap = interGap;
    this.totalHeight = 0;

    this.names = [];
    this.heights = [];
    this.groups = [];
    this.gaps = [];

    this.yPositions = new Map();
    this._separatorYs = [];
  }

  add(name, h, group) {
    this.names.push(name);
    this.heights.push(h);
    this.groups.push(group);
  }

  finish() {
    this.gaps = [];
    for (let i = 0; i < this.names.length; i++) {
      const lastInGroup = i === this.names.length - 1 || this.groups[i] !== this.groups[i + 1];
      this.gaps.push(lastInGroup ? this.interGap : this.intraGap);
    }

    let cursor = this.y + this.padding;
    for (let i = 0; i < this.names.length; i++) {
      this.yPositions.set(this.names[i], cursor);
      cursor += this.heights[i] + this.gaps[i];
    }
    this.totalHeight = cursor - this.y - this.interGap + this.padding;

    this._separatorYs = [];
    for (let i = 0; i < this.names.length - 1; i++) {
      if (this.groups[i] !== this.groups[i + 1]) {
        const rowBottom = this.yPositions.get(this.names[i]) + this.heights[i];
        const nextTop = this.yPositions.get(this.names[i + 1]);
        this._separatorYs.push((rowBottom + nextTop) / 2.0);
      }
    }
  }

  getY(name) {
    const v = this.yPositions.get(name);
    return v !== undefined ? v : this.y;
  }

  contentX() {
    return this.x + this.padding;
  }

  contentW() {
    return this.w - this.padding * 2;
  }

  separatorYs() {
    return this._separatorYs;
  }
}