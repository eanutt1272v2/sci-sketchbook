class AccordionGroup {
  final String name;
  boolean collapsed;
  final ArrayList<String> rowNames = new ArrayList<String>();
  final ArrayList<Float> rowHeights = new ArrayList<Float>();
  
  AccordionGroup(String name, boolean collapsed) {
    this.name = name;
    this.collapsed = collapsed;
  }
  
  void addRow(String name, float height) {
    rowNames.add(name);
    rowHeights.add(height);
  }
}

