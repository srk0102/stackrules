"use strict";

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "No duplicate function names across utils/ files. Prevents AI from recreating existing helpers.",
      category: "Architecture",
      recommended: true,
    },
    messages: {
      duplicateUtil:
        'Function "{{name}}" may already exist in another utils/ file. Check existing utils before creating new ones to avoid duplication.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    if (!filename.includes("/utils/")) return {};

    // This rule flags exported functions in utils/ files.
    // The CLI `clean` command performs cross-file duplicate detection.
    // At the ESLint level, we flag when a utils file exports too many
    // functions with generic names that are likely duplicated.
    const commonDuplicateNames = new Set([
      "formatDate",
      "formatCurrency",
      "formatNumber",
      "capitalize",
      "truncate",
      "debounce",
      "throttle",
      "deepClone",
      "deepMerge",
      "isEmpty",
      "isEmail",
      "isUrl",
      "slugify",
      "generateId",
      "generateUUID",
      "classNames",
      "cn",
      "sleep",
      "retry",
      "chunk",
      "unique",
      "flatten",
      "groupBy",
      "sortBy",
      "pick",
      "omit",
    ]);

    return {
      ExportNamedDeclaration(node) {
        if (node.declaration) {
          if (node.declaration.type === "FunctionDeclaration" && node.declaration.id) {
            const name = node.declaration.id.name;
            if (commonDuplicateNames.has(name)) {
              context.report({
                node,
                messageId: "duplicateUtil",
                data: { name },
              });
            }
          }
          if (node.declaration.type === "VariableDeclaration") {
            for (const declarator of node.declaration.declarations) {
              if (declarator.id.type === "Identifier") {
                const name = declarator.id.name;
                if (commonDuplicateNames.has(name)) {
                  context.report({
                    node,
                    messageId: "duplicateUtil",
                    data: { name },
                  });
                }
              }
            }
          }
        }
      },
    };
  },
};
