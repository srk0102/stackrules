"use strict";

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "No direct fetch() or axios calls in components. All external calls must go through services/.",
      category: "Architecture",
      recommended: true,
    },
    messages: {
      noFetchInComponents:
        "Direct fetch/axios calls are not allowed in components. Create a service function in services/ and call it from here instead.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    const componentDirs = ["/components/", "/app/", "/pages/"];
    const isInComponentDir = componentDirs.some((dir) =>
      filename.includes(dir)
    );

    if (!isInComponentDir) return {};

    return {
      CallExpression(node) {
        // Check for fetch()
        if (node.callee.type === "Identifier" && node.callee.name === "fetch") {
          context.report({ node, messageId: "noFetchInComponents" });
        }

        // Check for axios.get(), axios.post(), etc.
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.object.type === "Identifier" &&
          node.callee.object.name === "axios"
        ) {
          context.report({ node, messageId: "noFetchInComponents" });
        }

        // Check for axios() direct call
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "axios"
        ) {
          context.report({ node, messageId: "noFetchInComponents" });
        }
      },
      ImportDeclaration(node) {
        if (node.source.value === "axios") {
          context.report({ node, messageId: "noFetchInComponents" });
        }
      },
    };
  },
};
