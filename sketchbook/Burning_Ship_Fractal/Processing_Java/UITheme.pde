/**
 * @fileoverview UITheme.pde - Visual styling and theming utilities
 * @description Color schemes, fonts, and styling constants for UI components
 * @version 3.0.0
 * @author @eanutt1272.v2
 * @license MIT
 * 
 * @class UITheme
 * @description Centralized theme configuration for UI aesthetics
 */
class UITheme {
  color bgPanel = color(20, 20, 20, 210);
  color bgWidget = color(42, 42, 42, 220);
  color bgHover = color(68, 68, 68, 230);
  color bgActive = color(100, 100, 100, 245);

  color textPrimary = color(240);
  color textSecondary = color(180);
  color textMuted = color(110);

  float textSizePrimary = 16;
  float textSizeSecondary = 14;
  float textSizeCaption = 10;

  float swPanel = 1.4;
  float swWidget = 1.0;
  float swTrack = 0.8;
  float swSeparator = 0.6;

  color strokePanel = color(105);
  color strokeWidget = color(82);
  color strokeTrack = color(65);
  color strokeSeparator = color(50);
  color strokeFocus = color(190);

  color accentHandle = color(220);
}