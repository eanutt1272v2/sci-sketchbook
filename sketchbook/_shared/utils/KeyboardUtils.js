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
    if (!!element.isContentEditable) return true;
    if (tag === "TEXTAREA") {
      return !element.disabled && !element.readOnly;
    }
    if (tag !== "INPUT") return false;

    if (element.disabled || element.readOnly) return false;

    const type = String(element.type || "text").toLowerCase();
    return (
      type === "text" ||
      type === "search" ||
      type === "url" ||
      type === "tel" ||
      type === "email" ||
      type === "password" ||
      type === "number"
    );
  }

  static shouldIgnoreKeyboard(event = null) {
    if (event && KeyboardUtils.isTypingTarget(event.target)) return true;
    return KeyboardUtils.isTypingTarget(document.activeElement);
  }

  static _safeFocus(element) {
    if (!element || typeof element.focus !== "function") return;
    try {
      element.focus({ preventScroll: true });
    } catch {
      element.focus();
    }
  }

  static installCanvasFocusBridge(canvasElement) {
    if (!canvasElement || typeof document === "undefined") return () => {};

    if (!KeyboardUtils._canvasFocusBridges) {
      KeyboardUtils._canvasFocusBridges = new WeakMap();
    }

    const existing = KeyboardUtils._canvasFocusBridges.get(canvasElement);
    if (existing) return existing;

    const isCanvasTarget = (target) =>
      target === canvasElement ||
      (typeof canvasElement.contains === "function" &&
        canvasElement.contains(target));

    const isTypingTargetOrAncestor = (target) => {
      if (KeyboardUtils.isTypingTarget(target)) return true;
      if (!target || typeof target.closest !== "function") return false;
      const editableAncestor = target.closest(
        "input,textarea,[contenteditable]",
      );
      return KeyboardUtils.isTypingTarget(editableAncestor);
    };

    const isMenuControlTargetOrAncestor = (target) => {
      if (!target || typeof target.closest !== "function") return false;
      return Boolean(
        target.closest(
          "select,option,button,[aria-haspopup],[role='button'],[role='listbox'],[role='menu'],[role='option']",
        ),
      );
    };

    const refocusCanvas = () => {
      const active = document.activeElement;
      if (active === canvasElement) return;
      if (KeyboardUtils.isTypingTarget(active)) return;
      KeyboardUtils._safeFocus(canvasElement);
    };

    const onPointerUp = (event) => {
      const target = event?.target;
      if (isCanvasTarget(target)) return;
      if (isTypingTargetOrAncestor(target)) return;
      if (isMenuControlTargetOrAncestor(target)) return;
      requestAnimationFrame(refocusCanvas);
    };

    document.addEventListener("pointerup", onPointerUp, true);

    const cleanup = () => {
      document.removeEventListener("pointerup", onPointerUp, true);
      KeyboardUtils._canvasFocusBridges.delete(canvasElement);
    };

    KeyboardUtils._canvasFocusBridges.set(canvasElement, cleanup);
    return cleanup;
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
