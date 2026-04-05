class AppDiagnostics {
  static createNoopLogger() {
    return {
      info() {},
      warn() {},
      error() {},
      debug() {},
    };
  }

  static resolveLogger(tag = "App", existingLogger = null) {
    if (existingLogger && typeof existingLogger.error === "function") {
      return existingLogger;
    }

    if (typeof AppDiagnostics.createLogger === "function") {
      return AppDiagnostics.createLogger(tag);
    }

    return AppDiagnostics.createNoopLogger();
  }

  static createLogger(tag = "App") {
    const label = `[${String(tag || "App")}]`;
    const debugEnabled = AppDiagnostics.isDebugEnabled();

    return {
      info(message, ...rest) {
        console.info(`${label} ${message}`, ...rest);
      },
      warn(message, ...rest) {
        console.warn(`${label} ${message}`, ...rest);
      },
      error(message, ...rest) {
        console.error(`${label} ${message}`, ...rest);
      },
      debug(message, ...rest) {
        if (!debugEnabled) return;
        console.debug(`${label} ${message}`, ...rest);
      },
    };
  }

  static isDebugEnabled() {
    try {
      const stored = globalThis.localStorage?.getItem("sciSketchDebug");
      if (stored === "1" || stored === "true") {
        return true;
      }
    } catch {
      // Access to localStorage can fail in private contexts.
    }

    try {
      const search = String(globalThis.location?.search || "");
      if (!search) return false;
      const params = new URLSearchParams(search);
      const value = String(params.get("debug") || "").toLowerCase();
      return value === "1" || value === "true" || value === "yes";
    } catch {
      // URL parsing may fail in some restricted environments.
      return false;
    }
  }

  static installGlobalErrorHandlers(tag = "App", options = {}) {
    if (typeof globalThis.addEventListener !== "function") {
      return () => {};
    }

    const key = `__appDiagnosticsCleanup_${String(tag)}`;
    const existingCleanup = globalThis[key];
    if (typeof existingCleanup === "function") {
      return existingCleanup;
    }

    const logger =
      options.logger && typeof options.logger.error === "function"
        ? options.logger
        : AppDiagnostics.createLogger(tag);

    const onError = (event) => {
      const payload = {
        source: event?.filename || "",
        line: Number(event?.lineno) || 0,
        column: Number(event?.colno) || 0,
      };
      const error = event?.error;
      if (error && typeof error === "object") {
        payload.name = String(error.name || "Error");
        payload.message = String(error.message || "Unknown error");
        payload.stack = String(error.stack || "");
      } else {
        payload.message = String(event?.message || "Unknown runtime error");
      }
      logger.error("Unhandled runtime error", payload);
      if (typeof options.onFatal === "function") {
        try {
          options.onFatal(payload);
        } catch (hookError) {
          logger.error("Global error hook failed", hookError);
        }
      }
    };

    const onUnhandledRejection = (event) => {
      const reason = event?.reason;
      if (reason && typeof reason === "object") {
        logger.error("Unhandled promise rejection", {
          name: String(reason.name || "Error"),
          message: String(reason.message || "Promise rejected"),
          stack: String(reason.stack || ""),
        });
      } else {
        logger.error(
          "Unhandled promise rejection",
          String(reason || "Promise rejected"),
        );
      }
    };

    globalThis.addEventListener("error", onError);
    globalThis.addEventListener("unhandledrejection", onUnhandledRejection);

    const cleanup = () => {
      globalThis.removeEventListener("error", onError);
      globalThis.removeEventListener(
        "unhandledrejection",
        onUnhandledRejection,
      );
      if (globalThis[key] === cleanup) {
        delete globalThis[key];
      }
    };

    globalThis[key] = cleanup;
    return cleanup;
  }

  static safePostMessage(worker, message, transfers = [], logger, context) {
    if (!worker || typeof worker.postMessage !== "function") {
      if (logger && typeof logger.warn === "function") {
        logger.warn(`Skipped ${context || "worker post"}: worker unavailable`);
      }
      return false;
    }

    const transferList = Array.isArray(transfers) ? transfers : [];

    try {
      worker.postMessage(message, transferList);
      return true;
    } catch (error) {
      if (logger && typeof logger.error === "function") {
        logger.error(`Failed ${context || "worker post"}`, error);
      } else {
        console.error("[AppDiagnostics] Worker post failed", error);
      }
      return false;
    }
  }

  static consumeWorkerError(data, logger, fallbackTag = "Worker") {
    if (!data || typeof data !== "object" || data.type !== "workerError") {
      return false;
    }

    const stage =
      typeof data.stage === "string" && data.stage
        ? data.stage
        : "unknown stage";
    const message =
      typeof data.message === "string" && data.message
        ? data.message
        : "unknown worker failure";

    if (logger && typeof logger.error === "function") {
      logger.error(`Worker failure (${stage}): ${message}`, data);
    } else {
      console.error(`[${fallbackTag}] Worker failure (${stage}): ${message}`);
    }

    return true;
  }
}

window.AppDiagnostics = AppDiagnostics;
