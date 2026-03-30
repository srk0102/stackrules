"use strict";

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Ban all eslint-disable comments. AI must fix violations, not suppress them.",
      category: "Architecture",
      recommended: true,
    },
    messages: {
      noEslintDisable:
        "eslint-disable is banned. Fix the violation instead of suppressing it. StackRules enforces this so AI cannot bypass architecture rules.",
    },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        const sourceCode = context.sourceCode || context.getSourceCode();
        const comments = sourceCode.getAllComments();

        for (const comment of comments) {
          const value = comment.value.trim();
          if (
            value.startsWith("eslint-disable") ||
            value.startsWith("eslint-enable")
          ) {
            context.report({
              node: comment,
              messageId: "noEslintDisable",
            });
          }
        }
      },
    };
  },
};
