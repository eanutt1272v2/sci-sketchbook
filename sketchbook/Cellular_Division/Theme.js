class Theme {
  constructor() {
    this.textSizePrimary = 16;
    this.textSizeSecondary = 13;
    this.textSizeCaption = 11;

    this.swPanel = 0.4;
    this.swWidget = 0.6;
    this.swTrack = 0.6;
    this.swSeparator = 0.75;

    this.applySystemTheme();
  }

  isDarkMode() {
    if (!window.matchMedia) return true;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  applySystemTheme() {
    if (this.isDarkMode()) {
      this.applyDarkTheme();
      return;
    }
    this.applyLightTheme();
  }

  applyDarkTheme() {
    this.bgPanel = color(18, 18, 18, 230);
    this.bgWidget = color(33, 33, 33, 240);
    this.bgHover = color(48, 48, 48, 250);
    this.bgActive = color(68, 68, 68, 255);

    this.textPrimary = color(236, 236, 236);
    this.textSecondary = color(188, 188, 188);
    this.textMuted = color(134, 134, 134);

    this.strokePanel = color(105, 105, 105);
    this.strokeWidget = color(91, 91, 91);
    this.strokeTrack = color(78, 78, 78);
    this.strokeSeparator = color(63, 63, 63);
    this.strokeFocus = color(176, 176, 176);
    this.accentHandle = color(212, 212, 212);

    this.canvasClear = color(12, 12, 12);
    this.trailFade = color(12, 12, 12, 255);
  }

  applyLightTheme() {
    this.bgPanel = color(236, 236, 236, 232);
    this.bgWidget = color(248, 248, 248, 244);
    this.bgHover = color(224, 224, 224, 248);
    this.bgActive = color(207, 207, 207, 255);

    this.textPrimary = color(31, 31, 31);
    this.textSecondary = color(72, 72, 72);
    this.textMuted = color(116, 116, 116);

    this.strokePanel = color(158, 158, 158);
    this.strokeWidget = color(170, 170, 170);
    this.strokeTrack = color(182, 182, 182);
    this.strokeSeparator = color(196, 196, 196);
    this.strokeFocus = color(94, 94, 94);
    this.accentHandle = color(82, 82, 82);

    this.canvasClear = color(242, 242, 242);
    this.trailFade = color(242, 242, 242, 255);
  }
}
