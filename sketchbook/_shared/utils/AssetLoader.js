class AssetLoader {
  static _fallbackLogger() {
    return { info() {}, warn() {}, error() {}, debug() {} };
  }

  static _resolveLogger(logger) {
    if (logger && typeof logger.warn === "function") {
      return logger;
    }
    return AssetLoader._fallbackLogger();
  }

  static async loadPreferredFont({
    family = "Iosevka",
    woff2Path = "",
    ttfPath = "",
    logger = null,
  } = {}) {
    const safeLogger = AssetLoader._resolveLogger(logger);
    const safeFamily = String(family || "Iosevka");

    const canUseFontFace =
      typeof window !== "undefined" &&
      typeof window.FontFace === "function" &&
      typeof document !== "undefined" &&
      !!document.fonts &&
      typeof document.fonts.add === "function";

    if (canUseFontFace && woff2Path) {
      try {
        if (
          typeof document.fonts.check === "function" &&
          document.fonts.check(`400 12px "${safeFamily}"`)
        ) {
          return safeFamily;
        }

        const face = new FontFace(
          safeFamily,
          `url("${woff2Path}") format("woff2")`,
          {
            style: "normal",
            weight: "400",
          },
        );

        const loadedFace = await face.load();
        document.fonts.add(loadedFace);

        if (typeof document.fonts.load === "function") {
          await document.fonts.load(`400 12px "${safeFamily}"`);
        }

        return safeFamily;
      } catch (error) {
        safeLogger.warn(
          `WOFF2 FontFace load failed for ${safeFamily}; falling back to TTF loadFont:`,
          error,
        );
      }
    }

    if (typeof loadFont === "function" && ttfPath) {
      try {
        return await loadFont(ttfPath);
      } catch (error) {
        safeLogger.warn(
          `TTF loadFont fallback failed for ${safeFamily}; using family string fallback:`,
          error,
        );
      }
    }

    return safeFamily;
  }

  static async loadJSONAsset(
    path,
    { logger = null, label = "JSON asset" } = {},
  ) {
    const safeLogger = AssetLoader._resolveLogger(logger);

    if (typeof loadJSON !== "function") {
      const error = new Error("p5 loadJSON is unavailable");
      safeLogger.error(`${label} loader unavailable:`, error);
      throw error;
    }

    try {
      return await loadJSON(path);
    } catch (error) {
      safeLogger.error(`${label} load failed:`, error);
      throw error;
    }
  }

  static async loadShaderSource(
    path,
    { logger = null, label = "Shader source" } = {},
  ) {
    const safeLogger = AssetLoader._resolveLogger(logger);

    if (typeof loadStrings !== "function") {
      const error = new Error("p5 loadStrings is unavailable");
      safeLogger.error(`${label} loader unavailable:`, error);
      throw error;
    }

    try {
      const lines = await loadStrings(path);
      return Array.isArray(lines) ? lines.join("\n") : "";
    } catch (error) {
      safeLogger.error(`${label} load failed:`, error);
      throw error;
    }
  }
}
