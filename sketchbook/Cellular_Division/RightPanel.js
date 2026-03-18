class RightPanel {
  constructor(appcore) {
    this.sim = appcore.sim;
    this.theme = appcore.theme;
    this.columns = new Array(2);
    this.params = new ParameterSet(this.sim, this.theme);
    this.input = null;

    const totalWidth = Config.RIGHT_COLUMN_WIDTH * 2 + Config.COLUMN_GAP;
    const startX = width - totalWidth - 15;

    for (let col = 0; col < 2; col++) {
      const x = startX + col * (Config.RIGHT_COLUMN_WIDTH + Config.COLUMN_GAP);
      this.columns[col] = new AccordionPanel(x, 15, Config.RIGHT_COLUMN_WIDTH, this.theme);

      for (let pi = col * 3; pi < col * 3 + 3; pi++) {
        const grp = new AccordionGroup(this.params.getLabel(pi), false);
        grp.addRow(`val${pi}`, 16);
        grp.addRow(`slider${pi}`, 22);
        grp.addRow(`steps${pi}`, 30);
        this.columns[col].addGroup(grp);
      }
      this.columns[col].recompute();
    }

    this.params.buildWidgets(this.columns);
  }

  setInputHandler(input) {
    this.input = input;
  }

  render() {
    for (const col of this.columns) {
      col.recompute();
      col.drawBackground();
    }
    this.params.rebuildWidgets(this.columns);
    this.params.render(this.columns, this.input);
  }

  handleHeaderClick(mx, my) {
    for (const col of this.columns) {
      if (col.handleHeaderClick(mx, my)) {
        col.recompute();
        return true;
      }
    }
    return false;
  }

  handleValueClick(mx, my) {
    return this.params.handleValueClick(this.columns, mx, my);
  }

  handleSliderPress(mx, my) {
    return this.params.handleSliderPress(mx, my);
  }

  handleMinusClick(mx, my) {
    return this.params.handleMinusClick(mx, my);
  }

  handlePlusClick(mx, my) {
    return this.params.handlePlusClick(mx, my);
  }

  releaseSliders() {
    this.params.releaseSliders();
  }

  getSlider(index) {
    return this.params.getSlider(index);
  }

  getStepSize(index) {
    return this.params.getStepSize(index);
  }
}