"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Loads .stackrules.json from the project root.
 * All rules can call this to respect org-level configuration.
 *
 * Caches per directory so we only read the file once per lint run.
 */
const configCache = new Map();

function loadConfig(filename) {
  // Walk up from the file being linted to find .stackrules.json
  let dir = path.dirname(filename);
  const root = path.parse(dir).root;

  while (dir !== root) {
    if (configCache.has(dir)) return configCache.get(dir);

    const configPath = path.join(dir, ".stackrules.json");
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, "utf-8");
        const config = JSON.parse(raw);
        configCache.set(dir, config);
        return config;
      } catch {
        // Invalid JSON — return defaults
        configCache.set(dir, null);
        return null;
      }
    }

    dir = path.dirname(dir);
  }

  configCache.set(dir, null);
  return null;
}

/**
 * Get a config value with a fallback default.
 */
function getConfigValue(filename, key, defaultValue) {
  const config = loadConfig(filename);
  if (!config) return defaultValue;

  // Support dot notation: "codeQuality.maxFunctionLines"
  const keys = key.split(".");
  let value = config;
  for (const k of keys) {
    if (value == null || typeof value !== "object") return defaultValue;
    value = value[k];
  }

  return value !== undefined ? value : defaultValue;
}

module.exports = { loadConfig, getConfigValue };
