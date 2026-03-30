"use strict";

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Detects duplicated useState+useEffect patterns that should be extracted to custom hooks in hooks/.",
      category: "Architecture",
      recommended: true,
    },
    messages: {
      duplicateStateEffect:
        'This useState + useEffect pattern for "{{name}}" is commonly duplicated across files. Extract it to a custom hook in hooks/ (e.g., hooks/use{{Name}}.ts) so every page reuses the same logic.',
      supabaseInEffect:
        "Direct Supabase calls inside useEffect should be extracted to a custom hook in hooks/ that calls a service function in services/. This pattern gets copy-pasted across pages.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || context.getFilename();

    // Only check page/component files, not hooks/ themselves
    if (filename.includes("/hooks/")) return {};

    const stateVariables = new Map(); // name -> node
    let insideEffect = false;
    let currentEffectNode = null;

    return {
      CallExpression(node) {
        // Track useState calls: const [foo, setFoo] = useState(...)
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "useState"
        ) {
          const parent = node.parent;
          if (
            parent &&
            parent.type === "VariableDeclarator" &&
            parent.id.type === "ArrayPattern" &&
            parent.id.elements.length >= 1
          ) {
            const stateName = parent.id.elements[0];
            if (stateName && stateName.type === "Identifier") {
              stateVariables.set(stateName.name, node);
            }
          }
        }

        // Track useEffect calls
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "useEffect"
        ) {
          currentEffectNode = node;

          // Check if useEffect body contains Supabase calls
          const callback = node.arguments[0];
          if (callback) {
            const sourceCode = context.sourceCode || context.getSourceCode();
            const effectText = sourceCode.getText(callback);

            // Detect supabase.from() pattern inside useEffect
            if (
              effectText.includes("supabase") &&
              (effectText.includes(".from(") ||
                effectText.includes(".select(") ||
                effectText.includes(".insert(") ||
                effectText.includes(".auth."))
            ) {
              context.report({
                node,
                messageId: "supabaseInEffect",
              });
            }

            // Detect fetch() pattern paired with useState setter
            for (const [name] of stateVariables) {
              const setterName =
                "set" + name.charAt(0).toUpperCase() + name.slice(1);
              if (
                effectText.includes(setterName) &&
                (effectText.includes("supabase") ||
                  effectText.includes("fetch("))
              ) {
                const capitalName =
                  name.charAt(0).toUpperCase() + name.slice(1);
                context.report({
                  node,
                  messageId: "duplicateStateEffect",
                  data: { name, Name: capitalName },
                });
                break;
              }
            }
          }
        }
      },
    };
  },
};
