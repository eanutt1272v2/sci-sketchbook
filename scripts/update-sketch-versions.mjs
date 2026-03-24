#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VERSION_RE = /^v\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/;
const DEFAULT_CONFIG_PATH = "scripts/sketch-versions.json";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG_ABS_PATH = path.resolve(SCRIPT_DIR, "sketch-versions.json");
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

function fail(message) {
  console.error(`[version-sync] ${message}`);
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`Unable to read JSON from ${filePath}: ${error.message}`);
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const options = {
    check: false,
    setPairs: [],
    configPath: DEFAULT_CONFIG_PATH,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--check") {
      options.check = true;
      continue;
    }

    if (arg === "--config") {
      const value = argv[i + 1];
      if (!value) fail("Missing value after --config");
      options.configPath = value;
      i += 1;
      continue;
    }

    if (arg === "--set") {
      const value = argv[i + 1];
      if (!value) fail("Missing value after --set (expected '<Sketch>=<version>')");
      options.setPairs.push(value);
      i += 1;
      continue;
    }

    fail(`Unknown argument: ${arg}`);
  }

  return options;
}

function parseSetPair(raw) {
  const equalsIndex = raw.indexOf("=");
  if (equalsIndex <= 0 || equalsIndex === raw.length - 1) {
    fail(`Invalid --set argument '${raw}'. Expected '<Sketch>=<version>'`);
  }

  const sketch = raw.slice(0, equalsIndex).trim();
  const version = raw.slice(equalsIndex + 1).trim();

  if (!VERSION_RE.test(version)) {
    fail(`Invalid version '${version}' for '${sketch}'. Expected format 'vX.Y.Z[-suffix]'`);
  }

  return { sketch, version };
}

function applySetPairs(config, setPairs) {
  for (const raw of setPairs) {
    const { sketch, version } = parseSetPair(raw);
    if (!config[sketch]) {
      fail(`Unknown sketch '${sketch}'. Add it first to the version config.`);
    }
    config[sketch].version = version;
  }
}

function updateFileVersion(filePath, version) {
  const contents = fs.readFileSync(filePath, "utf8");
  const pattern = /(const\s+metadata\s*=\s*\{[\s\S]*?\bversion\s*:\s*")([^"]+)(")/m;

  const match = contents.match(pattern);
  if (!match) {
    fail(`Could not find metadata version field in ${filePath}`);
  }

  const currentVersion = match[2];
  if (currentVersion === version) {
    return { changed: false, currentVersion };
  }

  const nextContents = contents.replace(pattern, `$1${version}$3`);
  fs.writeFileSync(filePath, nextContents, "utf8");
  return { changed: true, currentVersion };
}

function checkFileVersion(filePath, expectedVersion) {
  const contents = fs.readFileSync(filePath, "utf8");
  const pattern = /const\s+metadata\s*=\s*\{[\s\S]*?\bversion\s*:\s*"([^"]+)"/m;
  const match = contents.match(pattern);

  if (!match) {
    return { ok: false, currentVersion: "<missing>" };
  }

  return {
    ok: match[1] === expectedVersion,
    currentVersion: match[1],
  };
}

function run() {
  const options = parseArgs(process.argv.slice(2));
  const configPath =
    options.configPath === DEFAULT_CONFIG_PATH
      ? DEFAULT_CONFIG_ABS_PATH
      : path.resolve(process.cwd(), options.configPath);
  const config = readJson(configPath);

  if (options.setPairs.length > 0) {
    applySetPairs(config, options.setPairs);
    writeJson(configPath, config);
    console.log(`[version-sync] Updated ${options.setPairs.length} entries in ${options.configPath}`);
  }

  const entries = Object.entries(config);
  if (entries.length === 0) {
    fail("Version config is empty.");
  }

  if (options.check) {
    let mismatches = 0;

    for (const [name, entry] of entries) {
      const filePath = path.resolve(REPO_ROOT, entry.file);
      const result = checkFileVersion(filePath, entry.version);

      if (result.ok) {
        console.log(`[check] OK   ${name}: ${entry.version}`);
      } else {
        mismatches += 1;
        console.log(
          `[check] FAIL ${name}: expected ${entry.version}, found ${result.currentVersion} (${entry.file})`,
        );
      }
    }

    if (mismatches > 0) {
      process.exitCode = 2;
    }
    return;
  }

  let changedCount = 0;

  for (const [name, entry] of entries) {
    if (!VERSION_RE.test(entry.version)) {
      fail(`Invalid version '${entry.version}' configured for '${name}'`);
    }

    const filePath = path.resolve(REPO_ROOT, entry.file);
    if (!fs.existsSync(filePath)) {
      fail(`Configured file not found for '${name}': ${entry.file}`);
    }

    const result = updateFileVersion(filePath, entry.version);
    if (result.changed) {
      changedCount += 1;
      console.log(`[sync] Updated ${name}: ${result.currentVersion} -> ${entry.version}`);
    } else {
      console.log(`[sync] Unchanged ${name}: ${entry.version}`);
    }
  }

  console.log(`[version-sync] Complete. ${changedCount} file(s) updated.`);
}

run();
