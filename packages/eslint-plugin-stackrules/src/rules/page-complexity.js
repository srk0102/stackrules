"use strict";

/**
 * Analyzes ANY file for complexity and gives AI-quality refactoring
 * guidance tailored to the file type:
 *
 * - Pages (app/, pages/) → extract to services/ + hooks/ + components/
 * - API routes (app/api/) → extract to services/ + add logging
 * - Hooks (hooks/) → split into smaller hooks + push logic to services/
 * - Backend routes/controllers → extract to services/ + add logging
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Analyzes file complexity and provides specific refactoring guidance for pages, API routes, hooks, and backend files.",
      category: "Architecture",
      recommended: true,
    },
    messages: {
      refactorPage:
        "{{summary}}\n\nRefactor plan:\n{{plan}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxStateHooks: { type: "number", default: 5 },
          maxHandlers: { type: "number", default: 3 },
          maxRouteLines: { type: "number", default: 50 },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    const options = context.options[0] || {};

    // ── Determine file type ─────────────────────────
    const fileType = getFileType(filename);
    if (!fileType) return {};

    // Skip lib/ (config files), types/, components/ui/ (shadcn)
    if (
      filename.includes("/lib/") ||
      filename.includes("/types/") ||
      filename.includes("/components/ui/")
    ) {
      return {};
    }

    const maxStateHooks = options.maxStateHooks || 5;
    const maxHandlers = options.maxHandlers || 3;
    const maxRouteLines = options.maxRouteLines || 50;

    // ── Collectors ──────────────────────────────────
    const stateHooks = [];
    const effectHooks = [];
    const handlers = [];
    const serviceImports = [];
    const allFunctions = [];
    let componentNode = null;
    let jsxReturnLines = 0;
    let totalLines = 0;
    let hasDirectDbCalls = false;
    let hasDirectFetch = false;
    let hasLoggerImport = false;
    let hasLoggerUsage = false;

    return {
      ExportDefaultDeclaration(node) {
        componentNode = node;
      },

      CallExpression(node) {
        // useState
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "useState"
        ) {
          const parent = node.parent;
          if (
            parent &&
            parent.type === "VariableDeclarator" &&
            parent.id.type === "ArrayPattern" &&
            parent.id.elements.length >= 2
          ) {
            const stateName = parent.id.elements[0];
            const setterName = parent.id.elements[1];
            if (
              stateName &&
              stateName.type === "Identifier" &&
              setterName &&
              setterName.type === "Identifier"
            ) {
              stateHooks.push({
                name: stateName.name,
                setter: setterName.name,
              });
            }
          }
        }

        // useEffect
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "useEffect"
        ) {
          const sourceCode = context.sourceCode || context.getSourceCode();
          const text = sourceCode.getText(node);
          effectHooks.push({
            node,
            callsService:
              text.includes("supabase") ||
              text.includes("fetch(") ||
              text.includes("axios") ||
              text.includes("prisma"),
          });
        }

        // Direct DB/service calls
        if (node.callee.type === "MemberExpression") {
          const obj = node.callee.object;
          if (obj.type === "Identifier") {
            if (
              obj.name === "supabase" ||
              obj.name === "prisma" ||
              obj.name === "db"
            ) {
              hasDirectDbCalls = true;
            }
            if (obj.name === "stripe" || obj.name === "resend") {
              hasDirectDbCalls = true; // treat as external service call
            }
            // Logger detection
            const loggerNames = [
              "logger",
              "log",
              "console",
              "winston",
              "pino",
            ];
            if (loggerNames.includes(obj.name)) {
              hasLoggerUsage = true;
            }
          }
        }

        // Direct fetch()
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "fetch"
        ) {
          hasDirectFetch = true;
        }
      },

      FunctionDeclaration(node) {
        if (!node.id) return;
        const sourceCode = context.sourceCode || context.getSourceCode();
        const text = sourceCode.getText(node);
        const name = node.id.name;

        if (name.match(/^[A-Z]/)) return; // skip component function

        const hasFetch = text.includes("fetch(");
        const hasDb =
          text.includes("supabase") ||
          text.includes("prisma") ||
          text.includes("db.");
        const isHandler =
          node.async || hasFetch || hasDb || name.startsWith("handle");

        allFunctions.push({ name, node, lines: nodeLines(node) });

        if (isHandler) {
          handlers.push({ name, node, hasFetch, hasDb });
        }
      },

      // Arrow functions assigned to variables (common in API routes)
      VariableDeclarator(node) {
        if (
          node.init &&
          (node.init.type === "ArrowFunctionExpression" ||
            node.init.type === "FunctionExpression") &&
          node.id.type === "Identifier"
        ) {
          const name = node.id.name;
          if (name.match(/^[A-Z]/)) return;

          const sourceCode = context.sourceCode || context.getSourceCode();
          const text = sourceCode.getText(node.init);
          const hasFetch = text.includes("fetch(");
          const hasDb =
            text.includes("supabase") ||
            text.includes("prisma") ||
            text.includes("db.");

          if (node.init.async || hasFetch || hasDb || name.startsWith("handle")) {
            allFunctions.push({ name, node, lines: nodeLines(node) });
            handlers.push({ name, node, hasFetch, hasDb });
          }
        }
      },

      ImportDeclaration(node) {
        const source = node.source.value;

        // Service imports
        const servicePatterns = [
          "supabase",
          "stripe",
          "resend",
          "firebase",
          "prisma",
          "mongoose",
          "drizzle",
          "openai",
          "@anthropic",
          "axios",
          "node-fetch",
        ];
        if (servicePatterns.some((p) => source.includes(p))) {
          serviceImports.push({
            source,
            names: node.specifiers.map((s) => s.local.name),
          });
        }

        // Logger imports
        if (
          source.includes("logger") ||
          source.includes("logging") ||
          source.includes("winston") ||
          source.includes("pino") ||
          source.includes("bunyan")
        ) {
          hasLoggerImport = true;
        }
      },

      ReturnStatement(node) {
        if (!node.argument) return;
        if (
          node.argument.type === "JSXElement" ||
          node.argument.type === "JSXFragment"
        ) {
          const lines =
            node.argument.loc.end.line - node.argument.loc.start.line + 1;
          if (lines > jsxReturnLines) {
            jsxReturnLines = lines;
          }
        }
      },

      "Program:exit"(programNode) {
        totalLines = programNode.loc.end.line;

        switch (fileType) {
          case "page":
            analyzePage(programNode);
            break;
          case "api-route":
            analyzeApiRoute(programNode);
            break;
          case "hook":
            analyzeHook(programNode);
            break;
          case "backend-route":
          case "backend-controller":
            analyzeBackendFile(programNode);
            break;
          case "component":
            analyzeComponent(programNode);
            break;
        }
      },
    };

    // ── Page analysis (app/pages) ───────────────────
    function analyzePage(programNode) {
      const hasTooManyState = stateHooks.length > maxStateHooks;
      const hasTooManyHandlers = handlers.length > maxHandlers;
      const hasDataFetching = effectHooks.some((e) => e.callsService);
      const hasDirectCalls = handlers.some((h) => h.hasFetch || h.hasDb);

      let problemCount = 0;
      if (hasTooManyState) problemCount++;
      if (hasTooManyHandlers) problemCount++;
      if (hasDataFetching) problemCount++;
      if (hasDirectCalls) problemCount++;
      if (problemCount < 2) return;

      const plan = [];
      const pageName = extractName(filename);

      if (hasDirectCalls) {
        const funcs = handlers
          .filter((h) => h.hasFetch || h.hasDb)
          .map((h) => `${h.name}()`)
          .join(", ");
        plan.push(
          `1. Extract ${funcs} → services/${pageName}.ts (every function logs params, result, duration, errors)`
        );
      }

      if (hasTooManyState || hasDataFetching) {
        const hookName = `use${capitalize(pageName)}`;
        const stateNames = stateHooks.map((s) => s.name).join(", ");
        plan.push(
          `${plan.length + 1}. Extract state (${stateNames}) + data loading → hooks/${hookName}.ts — this hook calls the service, manages loading/error/data state, and returns what the page needs`
        );
      }

      if (jsxReturnLines > 100) {
        plan.push(
          `${plan.length + 1}. Break the ${jsxReturnLines}-line JSX into smaller components in components/ — each Card/section becomes its own component that receives props from the hook`
        );
      }

      const hookName = `use${capitalize(pageName)}`;
      plan.push(
        `\nAfter refactor, this page should be ~30 lines: import ${hookName}, destructure state + handlers, render components with props. Zero business logic.`
      );

      report(
        componentNode || programNode,
        `This page has ${stateHooks.length} state variables, ${handlers.length} handler functions, and ${jsxReturnLines} lines of JSX.`,
        plan
      );
    }

    // ── API route analysis (app/api/) ───────────────
    function analyzeApiRoute(programNode) {
      const hasDb = hasDirectDbCalls;
      const hasFetch = hasDirectFetch;
      const noLogger = !hasLoggerImport || !hasLoggerUsage;
      const tooLong = totalLines > maxRouteLines;

      let problemCount = 0;
      if (hasDb) problemCount++;
      if (hasFetch) problemCount++;
      if (noLogger && (hasDb || hasFetch)) problemCount++;
      if (tooLong) problemCount++;
      if (problemCount < 2) return;

      const plan = [];
      const routeName = extractName(filename);

      if (hasDb || hasFetch) {
        const dbFuncs = handlers
          .filter((h) => h.hasDb || h.hasFetch)
          .map((h) => `${h.name}()`)
          .join(", ");
        const funcList = dbFuncs || "the database/API calls in this route";
        plan.push(
          `1. Extract ${funcList} → services/${routeName}.ts — API routes should be thin: validate request, call service, return response`
        );
      }

      if (noLogger && (hasDb || hasFetch)) {
        plan.push(
          `${plan.length + 1}. Add logging: import logger from lib/logger, log every request (method, path, params), every service call result, every error with full context, and request duration`
        );
      }

      if (tooLong) {
        plan.push(
          `${plan.length + 1}. This route is ${totalLines} lines — after extracting logic to services/${routeName}.ts, the route handler should be ~20 lines: parse request → call service → return response`
        );
      }

      const serviceNames = serviceImports.map((s) => s.source).join(", ");
      const summary = `This API route is ${totalLines} lines with ${handlers.length} functions and direct ${hasDb ? "database" : ""}${hasDb && hasFetch ? " + " : ""}${hasFetch ? "HTTP" : ""} calls${serviceNames ? ` (${serviceNames})` : ""}.${noLogger ? " No logging." : ""}`;

      report(componentNode || programNode, summary, plan);
    }

    // ── Hook analysis (hooks/) ──────────────────────
    function analyzeHook(programNode) {
      const hasTooManyState = stateHooks.length > maxStateHooks;
      const hasDirectCalls = hasDirectDbCalls || hasDirectFetch;
      const tooLong = totalLines > 80;

      let problemCount = 0;
      if (hasTooManyState) problemCount++;
      if (hasDirectCalls) problemCount++;
      if (tooLong) problemCount++;
      if (problemCount < 2) return;

      const plan = [];
      const hookName = extractName(filename);

      if (hasDirectCalls) {
        plan.push(
          `1. Move database/API calls out of this hook → services/${hookName.replace(/^use/, "").toLowerCase()}.ts — hooks should call service functions, not make direct DB/API calls`
        );
      }

      if (hasTooManyState) {
        const stateNames = stateHooks.map((s) => s.name).join(", ");
        plan.push(
          `${plan.length + 1}. This hook manages ${stateHooks.length} state variables (${stateNames}) — split into smaller, focused hooks (e.g., useLoading, useFormState) that each do one thing`
        );
      }

      if (tooLong) {
        plan.push(
          `${plan.length + 1}. At ${totalLines} lines, this hook is doing too much. A hook should be <80 lines — extract service calls and split state management`
        );
      }

      report(
        componentNode || programNode,
        `This hook has ${stateHooks.length} state variables, ${handlers.length} handlers, and is ${totalLines} lines long.${hasDirectCalls ? " It makes direct database/API calls that belong in services/." : ""}`,
        plan
      );
    }

    // ── Backend route/controller analysis ────────────
    function analyzeBackendFile(programNode) {
      const hasDb = hasDirectDbCalls;
      const hasFetch = hasDirectFetch;
      const noLogger = !hasLoggerImport || !hasLoggerUsage;
      const tooLong = totalLines > 80;

      let problemCount = 0;
      if (hasDb) problemCount++;
      if (hasFetch) problemCount++;
      if (noLogger) problemCount++;
      if (tooLong) problemCount++;
      if (problemCount < 2) return;

      const plan = [];
      const name = extractName(filename);
      const dirType = fileType === "backend-controller" ? "controller" : "route";

      if (hasDb || hasFetch) {
        plan.push(
          `1. Move all database/API calls → services/${name}.ts — ${dirType}s should only parse requests, call services, and format responses`
        );
      }

      if (noLogger) {
        plan.push(
          `${plan.length + 1}. Add structured logging: log every request (method, path, params), service call results, errors with stack traces, and request duration`
        );
      }

      if (tooLong) {
        plan.push(
          `${plan.length + 1}. This ${dirType} is ${totalLines} lines — after extracting to services, it should be ~30 lines per endpoint`
        );
      }

      report(
        componentNode || programNode,
        `This ${dirType} is ${totalLines} lines with direct ${hasDb ? "database" : ""}${hasDb && hasFetch ? " + " : ""}${hasFetch ? "HTTP" : ""} calls.${noLogger ? " No logging." : ""}`,
        plan
      );
    }

    // ── Component analysis ──────────────────────────
    function analyzeComponent(programNode) {
      // Components should be UI only — flag if they have service calls or too much state
      const hasDirectCalls = hasDirectDbCalls || hasDirectFetch;
      const hasTooManyState = stateHooks.length > 3; // stricter for components

      if (!hasDirectCalls && !hasTooManyState) return;

      let problemCount = 0;
      if (hasDirectCalls) problemCount++;
      if (hasTooManyState) problemCount++;
      if (problemCount < 2) return;

      const plan = [];
      const name = extractName(filename);

      if (hasDirectCalls) {
        plan.push(
          `1. Components must be UI only — move all database/API calls to services/${name}.ts, then access via a custom hook`
        );
      }

      if (hasTooManyState) {
        const stateNames = stateHooks.map((s) => s.name).join(", ");
        plan.push(
          `${plan.length + 1}. Extract state (${stateNames}) into hooks/use${capitalize(name)}.ts — component just renders props from the hook`
        );
      }

      report(
        componentNode || programNode,
        `This component has ${stateHooks.length} state variables${hasDirectCalls ? " and direct service calls" : ""}. Components should be UI only.`,
        plan
      );
    }

    // ── Helpers ─────────────────────────────────────
    function report(node, summary, plan) {
      if (plan.length === 0) return;
      context.report({
        node,
        messageId: "refactorPage",
        data: { summary, plan: plan.join("\n") },
      });
    }

    function nodeLines(node) {
      return node.loc.end.line - node.loc.start.line + 1;
    }

    function getFileType(filepath) {
      // Next.js API routes
      if (filepath.includes("/app/api/") || filepath.includes("/pages/api/"))
        return "api-route";
      // Next.js pages
      if (filepath.includes("/app/") || filepath.includes("/pages/"))
        return "page";
      // Hooks
      if (filepath.includes("/hooks/")) return "hook";
      // Backend patterns
      if (filepath.includes("/routes/")) return "backend-route";
      if (filepath.includes("/controllers/")) return "backend-controller";
      if (filepath.includes("/handlers/")) return "backend-route";
      // Components
      if (filepath.includes("/components/")) return "component";
      return null;
    }

    function extractName(filepath) {
      const parts = filepath.split("/");
      // For page.tsx / route.ts, use parent folder name
      const file = parts[parts.length - 1];
      if (
        file === "page.tsx" ||
        file === "page.ts" ||
        file === "route.ts" ||
        file === "route.js"
      ) {
        const folder = parts[parts.length - 2];
        return folder.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      }
      // Otherwise use filename without extension
      return file.replace(/\.[^.]+$/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    }

    function capitalize(str) {
      return str.charAt(0).toUpperCase() + str.slice(1);
    }
  },
};
