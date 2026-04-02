class KeyboardUtils {
  static keyCode(name, fallback) {
    const maybe = globalThis[name];
    const numeric = Number(maybe);
    if (Number.isFinite(numeric)) return numeric;
    return fallback;
  }

  static isKeyCode(code, name, fallback) {
    return Number(code) === KeyboardUtils.keyCode(name, fallback);
  }

  static isKeyDown(name, fallback) {
    if (typeof keyIsDown !== "function") return false;
    return keyIsDown(KeyboardUtils.keyCode(name, fallback));
  }

  static isEnterOrReturn(code) {
    const numeric = Number(code);
    return (
      numeric === 13 ||
      KeyboardUtils.isKeyCode(numeric, "ENTER", 13) ||
      KeyboardUtils.isKeyCode(numeric, "RETURN", 13)
    );
  }

  static isBackspaceOrDelete(code) {
    const numeric = Number(code);
    return (
      KeyboardUtils.isKeyCode(numeric, "BACKSPACE", 8) ||
      KeyboardUtils.isKeyCode(numeric, "DELETE", 46)
    );
  }

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
    return KeyboardUtils.isKeyDown("SHIFT", 16);
  }

  static isCtrlHeld() {
    return KeyboardUtils.isKeyDown("CONTROL", 17);
  }
}

window.KeyboardUtils = KeyboardUtils;
