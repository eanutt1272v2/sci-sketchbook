class KeyboardUtils {
  static normaliseKey(value) {
    return typeof value === "string" ? value : "";
  }

  static toLower(value) {
    return KeyboardUtils.normaliseKey(value).toLowerCase();
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

  static isCtrlHeld() {
    return typeof keyIsDown === "function" && keyIsDown(CONTROL);
  }
}

window.KeyboardUtils = KeyboardUtils;
