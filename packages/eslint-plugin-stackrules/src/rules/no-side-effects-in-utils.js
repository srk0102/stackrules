"use strict";

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "utils/ folder is for pure helper functions only. No side effects, no API calls, no imports of services or external clients.",
      category: "Architecture",
      recommended: true,
    },
    messages: {
      noSideEffectsInUtils:
        "utils/ files must be pure helper functions. No API calls, service imports, or side effects. Move this to services/ instead.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    if (!filename.includes("/utils/")) return {};

    const forbiddenImports = [
      "@supabase",
      "supabase",
      "stripe",
      "resend",
      "axios",
      "/services/",
      "@/services/",
      "node-fetch",
    ];

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        for (const forbidden of forbiddenImports) {
          if (source.includes(forbidden)) {
            context.report({ node, messageId: "noSideEffectsInUtils" });
            return;
          }
        }
      },
      CallExpression(node) {
        // Ban fetch() in utils
        if (node.callee.type === "Identifier" && node.callee.name === "fetch") {
          context.report({ node, messageId: "noSideEffectsInUtils" });
        }
        // Ban axios calls
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.object.type === "Identifier" &&
          node.callee.object.name === "axios"
        ) {
          context.report({ node, messageId: "noSideEffectsInUtils" });
        }
      },
    };
  },
};
