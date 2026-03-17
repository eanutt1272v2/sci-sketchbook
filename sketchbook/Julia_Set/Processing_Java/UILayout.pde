class UILayout {
  float x, y, w, padding, intraGap, interGap, totalHeight;

  ArrayList<String> names = new ArrayList<String>();
  ArrayList<Float> heights = new ArrayList<Float>();
  ArrayList<String> groups = new ArrayList<String>();
  ArrayList<Float> gaps = new ArrayList<Float>();

  HashMap<String, Float> yPositions = new HashMap<String, Float>();
  ArrayList<Float> _separatorYs = new ArrayList<Float>();

  UILayout(float x, float y, float w, float padding, float intraGap, float interGap) {
    this.x = x; this.y = y; this.w = w;
    this.padding = padding;
    this.intraGap = intraGap;
    this.interGap = interGap;
  }

  void add(String name, float h, String group) {
    names.add(name); heights.add(h); groups.add(group);
  }

  void finish() {
    gaps.clear();
    for (int i = 0; i < names.size(); i++) {
      boolean lastInGroup = (i == names.size() - 1) || !groups.get(i).equals(groups.get(i + 1));
      gaps.add(lastInGroup ? interGap : intraGap);
    }

    float cursor = y + padding;
    for (int i = 0; i < names.size(); i++) {
      yPositions.put(names.get(i), cursor);
      cursor += heights.get(i) + gaps.get(i);
    }
    totalHeight = cursor - y - interGap + padding;

    _separatorYs.clear();
    for (int i = 0; i < names.size() - 1; i++) {
      if (!groups.get(i).equals(groups.get(i + 1))) {
        float rowBottom = yPositions.get(names.get(i)) + heights.get(i);
        float nextTop = yPositions.get(names.get(i + 1));
        _separatorYs.add((rowBottom + nextTop) / 2.0);
      }
    }
  }

  float getY(String name) {
    Float v = yPositions.get(name);
    return v != null ? v : y;
  }

  float contentX() { return x + padding; }
  float contentW() { return w - padding * 2; }
  ArrayList<Float> separatorYs() { return _separatorYs; }
}