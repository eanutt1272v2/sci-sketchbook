"use strict";

if (typeof importScripts === "function") {
  importScripts(
    "WorkerShared.js",
    "WorkerStep.js",
    "WorkerAnalysis.js",
    "WorkerND.js",
    "WorkerMainHandler.js",
  );
}
