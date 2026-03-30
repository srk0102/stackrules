"use strict";

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Every file in services/ must import and use a logger. AI always skips logging — this rule enforces it.",
      category: "Architecture",
      recommended: true,
    },
    messages: {
      servicesMustImportLogger:
        "Service files must import a logger (e.g., from lib/logger or a logging package). Every service function must log what was called, params, result, duration, and errors.",
      servicesMustUseLogger:
        "This service file imports a logger but never uses it. Every exported function must include logging calls.",
    },
    schema: [
      {
        type: "object",
        properties: {
          loggerNames: {
            type: "array",
            items: { type: "string" },
            default: ["logger", "log", "console", "winston", "pino", "bunyan"],
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    if (!filename.includes("/services/")) return {};

    const options = context.options[0] || {};
    const loggerNames = options.loggerNames || [
      "logger",
      "log",
      "console",
      "winston",
      "pino",
      "bunyan",
    ];

    let hasLoggerImport = false;
    let hasLoggerUsage = false;

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (
          source.includes("logger") ||
          source.includes("logging") ||
          source.includes("winston") ||
          source.includes("pino") ||
          source.includes("bunyan")
        ) {
          hasLoggerImport = true;
        }
        // Check imported specifiers
        for (const spec of node.specifiers) {
          if (loggerNames.includes(spec.local.name)) {
            hasLoggerImport = true;
          }
        }
      },
      CallExpression(node) {
        // Check for logger.info(), logger.error(), console.log(), etc.
        if (node.callee.type === "MemberExpression") {
          const objName =
            node.callee.object.type === "Identifier"
              ? node.callee.object.name
              : null;
          if (objName && loggerNames.includes(objName)) {
            hasLoggerUsage = true;
          }
        }
        // Check for log() direct calls
        if (
          node.callee.type === "Identifier" &&
          loggerNames.includes(node.callee.name)
        ) {
          hasLoggerUsage = true;
        }
      },
      "Program:exit"(node) {
        if (!hasLoggerImport) {
          context.report({
            node,
            messageId: "servicesMustImportLogger",
          });
        } else if (!hasLoggerUsage) {
          context.report({
            node,
            messageId: "servicesMustUseLogger",
          });
        }
      },
    };
  },
};
