"use strict";

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "No raw SQL queries. Always use Supabase client methods or an ORM.",
      category: "Architecture",
      recommended: true,
    },
    messages: {
      noRawSql:
        "Raw SQL queries are not allowed. Use Supabase client methods (.from(), .select(), .insert(), etc.) or an ORM instead.",
    },
    schema: [],
  },
  create(context) {
    const sqlPatterns = [
      /\bSELECT\s+.+\s+FROM\s+/i,
      /\bINSERT\s+INTO\s+/i,
      /\bUPDATE\s+\w+\s+SET\s+/i,
      /\bDELETE\s+FROM\s+/i,
      /\bDROP\s+TABLE\s+/i,
      /\bCREATE\s+TABLE\s+/i,
      /\bALTER\s+TABLE\s+/i,
    ];

    function checkForSQL(node, value) {
      if (typeof value !== "string") return;
      for (const pattern of sqlPatterns) {
        if (pattern.test(value)) {
          context.report({ node, messageId: "noRawSql" });
          return;
        }
      }
    }

    return {
      Literal(node) {
        checkForSQL(node, node.value);
      },
      TemplateLiteral(node) {
        // Check the quasi (template string parts)
        for (const quasi of node.quasis) {
          checkForSQL(node, quasi.value.raw);
        }
      },
      TaggedTemplateExpression(node) {
        // Check for sql`` tagged templates
        if (
          node.tag.type === "Identifier" &&
          (node.tag.name === "sql" || node.tag.name === "SQL")
        ) {
          context.report({ node, messageId: "noRawSql" });
        }
      },
    };
  },
};
