class KeyboardUtils {
  static normalizeKey(value) {
    return typeof value === "string" ? value : "";
  }

  static toLower(value) {
    return KeyboardUtils.normalizeKey(value).toLowerCase();
  }

  static isTypingTarget(element) {
    if (!element) return false;

    const tag = (element.tagName || "").toUpperCase();
    return (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      !!element.isContentEditable
    );
  }

  static isShiftHeld() {
    return typeof keyIsDown === "function" && keyIsDown(SHIFT);
  }
}

window.KeyboardUtils = KeyboardUtils;