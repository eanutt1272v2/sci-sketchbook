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

  static shouldIgnoreKeyboard() {
    return KeyboardUtils.isTypingTarget(document.activeElement);
  }

  static safeHandle(label, action, handler) {
    try {
      return handler();
    } catch (error) {
      console.error(`[${label}] Keyboard ${action} handling failed:`, error);
      return false;
    }
  }

  static isShiftHeld() {
    return typeof keyIsDown === "function" && keyIsDown(SHIFT);
  }

  static isCtrlHeld() {
    return typeof keyIsDown === "function" && keyIsDown(CONTROL);
  }
}

window.KeyboardUtils = KeyboardUtils;
