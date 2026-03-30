"use strict";

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Stripe must only be imported in services/ files.",
      category: "Architecture",
      recommended: true,
    },
    messages: {
      noStripeOutsideServices:
        "Stripe cannot be imported outside services/. Create a payment service in services/ and call it from here instead.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    if (filename.includes("/services/")) return {};

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (source === "stripe" || source.startsWith("stripe/")) {
          context.report({ node, messageId: "noStripeOutsideServices" });
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
            (arg.value === "stripe" || arg.value.startsWith("stripe/"))
          ) {
            context.report({ node, messageId: "noStripeOutsideServices" });
          }
        }
      },
    };
  },
};
