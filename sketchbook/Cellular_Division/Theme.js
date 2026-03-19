class Theme {
  constructor() {
    this.bgPanel = color(15, 15, 15, 230);
    this.bgWidget = color(40, 40, 40, 240);
    this.bgHover = color(65, 65, 65, 250);
    this.bgActive = color(95, 95, 95, 255);

    this.textPrimary = color(245, 245, 245);
    this.textSecondary = color(180, 180, 180);
    this.textMuted = color(120, 120, 120);

    this.textSizePrimary = 16;
    this.textSizeSecondary = 13;
    this.textSizeCaption = 11;

    this.swPanel = 0.4;
    this.swWidget = 0.6;
    this.swTrack = 0.6;
    this.swSeparator = 0.75;

    this.strokePanel = color(110, 110, 110);
    this.strokeWidget = color(90, 90, 90);
    this.strokeTrack = color(80, 80, 80);
    this.strokeSeparator = color(60, 60, 60);
    this.strokeFocus = color(180, 180, 180);
    this.accentHandle = color(220, 220, 220);
  }
}
