"use strict";

/**
 * Detects when someone is building UI primitives from scratch that shadcn/ui provides.
 * Forces import from shadcn instead of recreating buttons, inputs, modals, cards, etc.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer importing UI primitives from shadcn (components/ui/) instead of building them from scratch.",
      category: "Architecture",
      recommended: true,
    },
    messages: {
      preferShadcn:
        'You\'re building a custom <{{element}}> with "{{indicator}}" styling. Use the shadcn <{{shadcnComponent}}> from components/ui/{{file}} instead. Never recreate what shadcn already provides.',
      nativeFormElement:
        'Use the shadcn <{{shadcnComponent}}> from components/ui/{{file}} instead of a native <{{element}}>. Shadcn components have built-in styling, accessibility, and variants.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || context.getFilename();

    // Don't flag shadcn component files themselves
    if (filename.includes("/components/ui/")) return {};

    // Map of native elements + class indicators => shadcn components
    const shadcnMapping = {
      button: { component: "Button", file: "button" },
      input: { component: "Input", file: "input" },
      textarea: { component: "Textarea", file: "textarea" },
      select: { component: "Select", file: "select" },
      dialog: { component: "Dialog", file: "dialog" },
      modal: { component: "Dialog", file: "dialog" },
    };

    // Indicators that someone is styling a native element (building from scratch)
    const stylingIndicators = [
      "rounded",
      "border",
      "shadow",
      "px-",
      "py-",
      "bg-",
      "text-sm",
      "text-lg",
      "font-medium",
      "hover:",
      "focus:",
      "disabled:",
      "cursor-pointer",
    ];

    const hasImportedShadcn = new Set();

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        // Track which shadcn components are already imported
        if (
          source.includes("components/ui/") ||
          source.includes("@/components/ui/")
        ) {
          for (const spec of node.specifiers) {
            hasImportedShadcn.add(spec.local.name.toLowerCase());
          }
        }
      },

      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier") return;

        const elementName = node.name.name.toLowerCase();
        const mapping = shadcnMapping[elementName];

        if (!mapping) return;

        // If they already imported the shadcn version, skip
        if (hasImportedShadcn.has(mapping.component.toLowerCase())) return;

        // Check if the element has className with styling indicators
        const classAttr = node.attributes.find(
          (attr) =>
            attr.type === "JSXAttribute" &&
            attr.name &&
            attr.name.name === "className"
        );

        if (classAttr && classAttr.value) {
          let classValue = "";

          if (classAttr.value.type === "Literal") {
            classValue = classAttr.value.value || "";
          } else if (
            classAttr.value.type === "JSXExpressionContainer" &&
            classAttr.value.expression.type === "TemplateLiteral"
          ) {
            classValue = classAttr.value.expression.quasis
              .map((q) => q.value.raw)
              .join("");
          } else if (
            classAttr.value.type === "JSXExpressionContainer" &&
            classAttr.value.expression.type === "Literal"
          ) {
            classValue = classAttr.value.expression.value || "";
          }

          // Check for styling indicators
          const foundIndicator = stylingIndicators.find((ind) =>
            classValue.includes(ind)
          );

          if (foundIndicator) {
            context.report({
              node,
              messageId: "preferShadcn",
              data: {
                element: elementName,
                indicator: foundIndicator,
                shadcnComponent: mapping.component,
                file: mapping.file,
              },
            });
            return;
          }
        }

        // For form elements (input, textarea, select), always prefer shadcn
        // even without className — native elements should use shadcn versions
        if (["input", "textarea", "select"].includes(elementName)) {
          context.report({
            node,
            messageId: "nativeFormElement",
            data: {
              element: elementName,
              shadcnComponent: mapping.component,
              file: mapping.file,
            },
          });
        }
      },
    };
  },
};
