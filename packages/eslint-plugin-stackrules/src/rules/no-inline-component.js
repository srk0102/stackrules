"use strict";

/**
 * Detects large blocks of raw HTML/JSX that should be extracted to
 * reusable components. The key insight: composing existing components
 * (Card, Button, Input) is fine. Building raw divs with Tailwind
 * classes from scratch is the problem — that's what gets copy-pasted.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Detects large raw HTML/JSX blocks that should be extracted to reusable components in components/.",
      category: "Architecture",
      recommended: true,
    },
    messages: {
      extractComponent:
        "This return block has {{rawCount}} raw HTML elements (div, span, p, etc.) across {{lines}} lines. Extract repeating UI patterns to reusable components in components/. Composing existing components is fine — building raw HTML from scratch gets copy-pasted.",
    },
    schema: [
      {
        type: "object",
        properties: {
          // Minimum raw HTML elements before flagging
          maxRawElements: {
            type: "number",
            default: 15,
          },
          // Minimum lines before flagging (in addition to raw element count)
          maxLines: {
            type: "number",
            default: 80,
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const filename = context.filename || context.getFilename();

    // Don't flag files already in components/
    if (filename.includes("/components/")) return {};

    const options = context.options[0] || {};
    const maxRawElements = options.maxRawElements || 15;
    const maxLines = options.maxLines || 80;

    // Native HTML elements — these are "raw" building blocks.
    // Using many of these means you're building UI from scratch.
    const rawElements = new Set([
      "div",
      "span",
      "p",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "section",
      "article",
      "header",
      "footer",
      "nav",
      "main",
      "aside",
      "ul",
      "ol",
      "li",
      "table",
      "tr",
      "td",
      "th",
      "thead",
      "tbody",
      "form",
      "label",
      "img",
      "a",
      "hr",
      "br",
    ]);

    return {
      ReturnStatement(node) {
        if (!node.argument) return;
        if (
          node.argument.type !== "JSXElement" &&
          node.argument.type !== "JSXFragment"
        ) {
          return;
        }

        const startLine = node.argument.loc.start.line;
        const endLine = node.argument.loc.end.line;
        const lines = endLine - startLine + 1;

        // Don't even bother checking small returns
        if (lines <= maxLines) return;

        // Count raw HTML elements vs composed components
        const rawCount = countRawElements(node.argument);

        // Only flag if there are too many raw HTML elements
        // This means the person is building UI from scratch
        if (rawCount >= maxRawElements) {
          context.report({
            node: node.argument,
            messageId: "extractComponent",
            data: {
              rawCount: String(rawCount),
              lines: String(lines),
            },
          });
        }
      },
    };

    function countRawElements(node) {
      let count = 0;
      if (node.type === "JSXElement" && node.openingElement) {
        const name = node.openingElement.name;
        // Lowercase = native HTML element (div, span, p)
        // Uppercase = component (Card, Button, Input) — don't count
        if (name.type === "JSXIdentifier" && rawElements.has(name.name)) {
          count++;
        }
      }

      const children =
        node.type === "JSXElement" || node.type === "JSXFragment"
          ? node.children || []
          : [];

      for (const child of children) {
        if (child.type === "JSXElement" || child.type === "JSXFragment") {
          count += countRawElements(child);
        }
        // Also check inside JSX expression containers { condition && <div>...</div> }
        if (child.type === "JSXExpressionContainer" && child.expression) {
          count += countRawInExpression(child.expression);
        }
      }

      return count;
    }

    function countRawInExpression(expr) {
      let count = 0;
      if (expr.type === "JSXElement" || expr.type === "JSXFragment") {
        count += countRawElements(expr);
      }
      // Handle ternary: condition ? <div/> : <div/>
      if (expr.type === "ConditionalExpression") {
        count += countRawInExpression(expr.consequent);
        count += countRawInExpression(expr.alternate);
      }
      // Handle && : condition && <div/>
      if (expr.type === "LogicalExpression") {
        count += countRawInExpression(expr.left);
        count += countRawInExpression(expr.right);
      }
      return count;
    }
  },
};
