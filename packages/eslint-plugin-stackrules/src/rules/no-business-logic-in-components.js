"use strict";

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Components should be UI only. No direct service calls, complex data transformations, or business logic.",
      category: "Architecture",
      recommended: true,
    },
    messages: {
      noServiceCallInComponent:
        "Components should not call service functions directly. Move this logic to a custom hook in hooks/ and call it from there.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    if (!filename.includes("/components/")) return {};

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        // Flag direct service imports in components
        if (
          source.includes("/services/") ||
          source.includes("@/services/")
        ) {
          context.report({ node, messageId: "noServiceCallInComponent" });
        }
      },
    };
  },
};
