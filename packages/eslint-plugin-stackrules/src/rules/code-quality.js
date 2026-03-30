"use strict";

const { getConfigValue } = require("../config-loader");

/**
 * Enforces developer-readable code quality in AI-generated files.
 *
 * AI writes code that works but is messy. This rule ensures:
 * - Exported functions have comments explaining what they do
 * - Functions aren't too long (extract to smaller functions)
 * - No magic numbers (use named constants)
 * - No single-letter variables (except i, j, k in loops)
 * - Proper error handling (no empty catch blocks)
 *
 * The goal: even vibe-coded code should be readable by a developer.
 *
 * Reads from .stackrules.json for org-level overrides.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Enforces developer-readable code quality in AI-generated files. Exported functions need comments, no magic numbers, no single-letter vars, proper error handling.",
      category: "Architecture",
      recommended: true,
    },
    messages: {
      missingExportComment:
        'Exported function "{{name}}" has no comment. Add a brief comment above it explaining what it does, what params it takes, and what it returns. Developers reading this code need to understand it without running it.',
      functionTooLong:
        'Function "{{name}}" is {{lines}} lines long (max {{max}}). Break it into smaller functions with descriptive names. Each function should do one thing.',
      magicNumber:
        "Magic number {{value}} — extract to a named constant (e.g., const MAX_RETRIES = {{value}}) so developers know what this number means.",
      singleLetterVar:
        'Variable "{{name}}" is a single letter. Use a descriptive name so developers can understand the code without tracing the variable back to its source.',
      emptyCatch:
        "Empty catch block — at minimum, log the error. Silent failures are the hardest bugs to debug. Add: console.error('{{context}} failed:', error) or use your logger.",
      noErrorParam:
        "Catch block without an error parameter — always capture the error (catch (error) { ... }) so you can log or handle it.",
    },
    schema: [
      {
        type: "object",
        properties: {
          requireCommentsOnExports: { type: "boolean", default: true },
          maxFunctionLines: { type: "number", default: 40 },
          noMagicNumbers: { type: "boolean", default: true },
          noSingleLetterVars: { type: "boolean", default: true },
          requireErrorHandling: { type: "boolean", default: true },
          // Numbers that are OK without a constant
          allowedNumbers: {
            type: "array",
            items: { type: "number" },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    const ruleOptions = context.options[0] || {};

    // Load from .stackrules.json, fall back to rule options, fall back to defaults
    const requireComments =
      ruleOptions.requireCommentsOnExports ??
      getConfigValue(filename, "codeQuality.requireCommentsOnExports", true);
    const maxFunctionLines =
      ruleOptions.maxFunctionLines ??
      getConfigValue(filename, "codeQuality.maxFunctionLines", 40);
    const noMagicNumbers =
      ruleOptions.noMagicNumbers ??
      getConfigValue(filename, "codeQuality.noMagicNumbers", true);
    const noSingleLetterVars =
      ruleOptions.noSingleLetterVars ??
      getConfigValue(filename, "codeQuality.noSingleLetterVars", true);
    const requireErrorHandling =
      ruleOptions.requireErrorHandling ??
      getConfigValue(filename, "codeQuality.requireErrorHandling", true);

    // Numbers that don't need a constant
    const allowedNumbers = new Set(
      ruleOptions.allowedNumbers || [
        -1, 0, 1, 2, 3, 4, 5, 10, 100, 1000, 24, 60, 1024,
      ]
    );

    // Skip generated files, config files, type files
    if (
      filename.includes("/components/ui/") ||
      filename.includes(".config.") ||
      filename.includes(".d.ts") ||
      filename.includes("/types/")
    ) {
      return {};
    }

    // Loop variable tracker
    const loopVarScopes = new Set();

    return {
      // ── Exported functions must have comments ──────
      ExportNamedDeclaration(node) {
        if (!requireComments) return;
        if (!node.declaration) return;

        let funcName = null;
        if (
          node.declaration.type === "FunctionDeclaration" &&
          node.declaration.id
        ) {
          funcName = node.declaration.id.name;
        } else if (node.declaration.type === "VariableDeclaration") {
          for (const decl of node.declaration.declarations) {
            if (
              decl.id.type === "Identifier" &&
              decl.init &&
              (decl.init.type === "ArrowFunctionExpression" ||
                decl.init.type === "FunctionExpression")
            ) {
              funcName = decl.id.name;
            }
          }
        }

        if (!funcName) return;

        // Check for a comment immediately before the export
        const sourceCode = context.sourceCode || context.getSourceCode();
        const comments = sourceCode.getCommentsBefore(node);
        const hasComment = comments.length > 0;

        if (!hasComment) {
          context.report({
            node,
            messageId: "missingExportComment",
            data: { name: funcName },
          });
        }
      },

      // Also check default exports
      ExportDefaultDeclaration(node) {
        if (!requireComments) return;

        let funcName = null;
        if (node.declaration.type === "FunctionDeclaration" && node.declaration.id) {
          funcName = node.declaration.id.name;
        }
        if (!funcName) return;

        // Skip React components (PascalCase) — they're self-documenting via JSX
        if (funcName.match(/^[A-Z]/)) return;

        const sourceCode = context.sourceCode || context.getSourceCode();
        const comments = sourceCode.getCommentsBefore(node);
        if (comments.length === 0) {
          context.report({
            node,
            messageId: "missingExportComment",
            data: { name: funcName },
          });
        }
      },

      // ── Function length ────────────────────────────
      FunctionDeclaration(node) {
        if (!node.id) return;
        const name = node.id.name;
        // Skip React components
        if (name.match(/^[A-Z]/)) return;
        checkFunctionLength(node, name);
      },

      "VariableDeclarator:exit"(node) {
        if (
          node.init &&
          (node.init.type === "ArrowFunctionExpression" ||
            node.init.type === "FunctionExpression") &&
          node.id.type === "Identifier"
        ) {
          const name = node.id.name;
          if (name.match(/^[A-Z]/)) return;
          checkFunctionLength(node.init, name);
        }
      },

      // ── Magic numbers ──────────────────────────────
      Literal(node) {
        if (!noMagicNumbers) return;
        if (typeof node.value !== "number") return;
        if (allowedNumbers.has(node.value)) return;

        // Skip array indices, object properties, default params
        const parent = node.parent;
        if (!parent) return;

        // Allow in variable declarations (const X = 42)
        if (parent.type === "VariableDeclarator") return;
        // Allow in comparisons (x > 5) — sometimes OK
        if (parent.type === "BinaryExpression" && ["===", "!==", "==", "!="].includes(parent.operator)) return;
        // Allow in array access
        if (parent.type === "MemberExpression" && parent.computed) return;
        // Allow in JSX attributes (className, key, etc.)
        if (parent.type === "JSXAttribute") return;
        // Allow in template literals
        if (parent.type === "TemplateLiteral") return;
        // Allow in return statements
        if (parent.type === "ReturnStatement") return;
        // Allow in property assignments
        if (parent.type === "Property") return;
        // Allow in switch cases
        if (parent.type === "SwitchCase") return;

        // Flag magic numbers in function calls, math operations, etc.
        if (
          parent.type === "CallExpression" ||
          (parent.type === "BinaryExpression" &&
            ["*", "/", "+", "-", "%"].includes(parent.operator))
        ) {
          context.report({
            node,
            messageId: "magicNumber",
            data: { value: String(node.value) },
          });
        }
      },

      // ── Track loop variables ──────────────────────
      ForStatement(node) {
        if (node.init && node.init.type === "VariableDeclaration") {
          for (const decl of node.init.declarations) {
            if (decl.id.type === "Identifier") {
              loopVarScopes.add(decl.id.name);
            }
          }
        }
      },

      ForInStatement(node) {
        if (node.left.type === "VariableDeclaration") {
          for (const decl of node.left.declarations) {
            if (decl.id.type === "Identifier") {
              loopVarScopes.add(decl.id.name);
            }
          }
        }
      },

      ForOfStatement(node) {
        if (node.left.type === "VariableDeclaration") {
          for (const decl of node.left.declarations) {
            if (decl.id.type === "Identifier") {
              loopVarScopes.add(decl.id.name);
            }
          }
        }
      },

      // ── Single letter variables ────────────────────
      VariableDeclarator(node) {
        if (!noSingleLetterVars) return;
        if (node.id.type !== "Identifier") return;

        const name = node.id.name;
        if (name.length !== 1) return;

        // Allow loop variables (i, j, k)
        if (loopVarScopes.has(name)) return;

        // Allow destructuring with rename (const { x: longName })
        // Allow _ as intentional ignore
        if (name === "_") return;

        // Allow e for event handlers (onChange={(e) => ...})
        if (name === "e") return;

        context.report({
          node,
          messageId: "singleLetterVar",
          data: { name },
        });
      },

      // ── Arrow function params ──────────────────────
      "ArrowFunctionExpression > Identifier.params"(node) {
        if (!noSingleLetterVars) return;
        const name = node.name;
        if (name.length !== 1) return;
        if (name === "_" || name === "e") return;

        // Check if inside a loop's callback (.map, .filter, .forEach)
        // These are OK: arr.map(x => x * 2)
        const parent = node.parent;
        if (parent && parent.parent && parent.parent.type === "CallExpression") {
          const callee = parent.parent.callee;
          if (
            callee.type === "MemberExpression" &&
            callee.property.type === "Identifier"
          ) {
            const method = callee.property.name;
            if (
              [
                "map",
                "filter",
                "forEach",
                "reduce",
                "find",
                "findIndex",
                "some",
                "every",
                "sort",
                "flatMap",
              ].includes(method)
            ) {
              return; // Allow single-letter in array methods
            }
          }
        }
      },

      // ── Empty catch blocks ─────────────────────────
      CatchClause(node) {
        if (!requireErrorHandling) return;

        // Check for missing error param
        if (!node.param) {
          // Get some context for the error message
          const funcName = getEnclosingFunctionName(node);
          context.report({
            node,
            messageId: "noErrorParam",
          });
          return;
        }

        // Check for empty catch body
        if (node.body.body.length === 0) {
          const funcName = getEnclosingFunctionName(node);
          context.report({
            node,
            messageId: "emptyCatch",
            data: { context: funcName || "operation" },
          });
        }
      },
    };

    function checkFunctionLength(node, name) {
      const lines = node.loc.end.line - node.loc.start.line + 1;
      if (lines > maxFunctionLines) {
        context.report({
          node,
          messageId: "functionTooLong",
          data: {
            name,
            lines: String(lines),
            max: String(maxFunctionLines),
          },
        });
      }
    }

    function getEnclosingFunctionName(node) {
      let current = node.parent;
      while (current) {
        if (current.type === "FunctionDeclaration" && current.id) {
          return current.id.name;
        }
        if (
          current.type === "VariableDeclarator" &&
          current.id &&
          current.id.type === "Identifier"
        ) {
          return current.id.name;
        }
        current = current.parent;
      }
      return null;
    }
  },
};
