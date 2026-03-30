"use strict";

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Supabase client must only be imported in services/ files. Never in components/, app/, or pages/.",
      category: "Architecture",
      recommended: true,
    },
    messages: {
      noSupabaseInComponents:
        "Supabase client cannot be imported here. Move this call to a services/ file and import the service function instead. Components should never talk to the database directly.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    const forbidden = ["/components/", "/app/", "/pages/"];
    const isInForbiddenDir = forbidden.some((dir) => filename.includes(dir));

    if (!isInForbiddenDir) return {};

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (
          source.includes("@supabase") ||
          source.includes("supabase") ||
          source.match(/lib\/supabase/) ||
          source.match(/utils\/supabase/)
        ) {
          context.report({ node, messageId: "noSupabaseInComponents" });
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
            (arg.value.includes("@supabase") ||
              arg.value.includes("supabase"))
          ) {
            context.report({ node, messageId: "noSupabaseInComponents" });
          }
        }
      },
    };
  },
};
