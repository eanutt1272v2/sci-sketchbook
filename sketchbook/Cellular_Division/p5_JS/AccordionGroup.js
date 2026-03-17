class AccordionGroup {
  constructor(name, collapsed) {
    this.name = name;
    this.collapsed = collapsed;
    this.rowNames = [];
    this.rowHeights = [];
  }

  addRow(name, height) {
    this.rowNames.push(name);
    this.rowHeights.push(height);
  }
}