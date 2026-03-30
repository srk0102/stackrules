"use strict";

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Resend must only be imported in services/ files.",
      category: "Architecture",
      recommended: true,
    },
    messages: {
      noResendOutsideServices:
        "Resend cannot be imported outside services/. Create an email service in services/ and call it from here instead.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    if (filename.includes("/services/")) return {};

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (source === "resend" || source.startsWith("resend/")) {
          context.report({ node, messageId: "noResendOutsideServices" });
        }
      },
      CallExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "require"
        ) {
          const arg = node.arguments[0];
          if (
            arg &&
            arg.type === "Literal" &&
            typeof arg.value === "string" &&
            (arg.value === "resend" || arg.value.startsWith("resend/"))
          ) {
            context.report({ node, messageId: "noResendOutsideServices" });
          }
        }
      },
    };
  },
};
