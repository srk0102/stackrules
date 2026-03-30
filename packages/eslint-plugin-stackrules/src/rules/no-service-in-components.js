"use strict";

/**
 * One unified rule that replaces individual per-service rules.
 *
 * Instead of checking for "supabase", "stripe", "resend" separately,
 * this rule understands the CONCEPT of a service — anything that
 * makes network calls, talks to a database, sends emails, processes
 * payments, calls your backend API, etc.
 *
 * Works for ANY stack: Supabase, Stripe, Resend, your FastAPI backend,
 * your Node.js service, your Go microservice, Firebase, Prisma, etc.
 *
 * Users can add their own service packages via configuration.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "External services (database, payment, email, HTTP, any network call) must only be used in services/ files. Never in components/, app/, or pages/.",
      category: "Architecture",
      recommended: true,
    },
    messages: {
      noServiceInComponent:
        '"{{source}}" is a {{category}} service. Import it in a services/ file instead, then call that service function from here. Components should never talk to external services directly.',
      noServiceInApiRoute:
        '"{{source}}" is a {{category}} service. Even in API routes, move this to services/ — API routes should be thin: validate request → call service → return response. This keeps logic reusable and testable.',
      noServiceInBackend:
        '"{{source}}" is a {{category}} service. Move this to services/ — routes/controllers should only parse requests and call service functions, not contain business logic directly.',
      noFetchInComponent:
        "Direct {{name}}() calls are not allowed here. Create a service function in services/ and call it from here instead.",
      noFetchInApiRoute:
        "Direct {{name}}() in an API route — extract to services/ so the logic is reusable and testable. API routes should be thin wrappers.",
      noHttpClientInComponent:
        '"{{source}}" is an HTTP client. All network calls must go through services/. Import it there, not here.',
    },
    schema: [
      {
        type: "object",
        properties: {
          // Extra service packages the user wants to enforce
          services: {
            type: "array",
            items: {
              type: "object",
              properties: {
                package: { type: "string" },
                category: { type: "string" },
              },
              required: ["package"],
              additionalProperties: false,
            },
          },
          // Directories where services are forbidden
          forbiddenDirs: {
            type: "array",
            items: { type: "string" },
          },
          // Directories where services are allowed
          allowedDirs: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    const options = context.options[0] || {};

    // Where services are ALLOWED (default: services/, lib/, middleware/)
    const allowedDirs = options.allowedDirs || [
      "/services/",
      "/lib/",
      "/middleware/",
    ];

    // Where services are FORBIDDEN (checked only if not in allowedDirs)
    const forbiddenDirs = options.forbiddenDirs || [
      "/components/",
      "/app/",
      "/pages/",
      "/hooks/",
      "/utils/",
      "/routes/",
      "/controllers/",
      "/handlers/",
    ];

    // Check if file is in an allowed directory
    const isAllowed = allowedDirs.some((dir) => filename.includes(dir));
    if (isAllowed) return {};

    // API routes are server-side but should still use services/
    const isApiRoute =
      filename.includes("/app/api/") ||
      filename.includes("/pages/api/");

    // Check if file is in a forbidden directory
    const isForbidden = forbiddenDirs.some((dir) => filename.includes(dir));
    if (!isForbidden) return {};

    // ── Built-in service registry ──────────────────────────────
    // Organized by CATEGORY so the error message explains WHY it's blocked
    const builtinServices = [
      // Database / BaaS
      { package: "@supabase", category: "database" },
      { package: "supabase", category: "database" },
      { package: "@prisma/client", category: "database" },
      { package: "prisma", category: "database" },
      { package: "drizzle-orm", category: "database" },
      { package: "mongoose", category: "database" },
      { package: "typeorm", category: "database" },
      { package: "sequelize", category: "database" },
      { package: "knex", category: "database" },
      { package: "pg", category: "database" },
      { package: "mysql2", category: "database" },
      { package: "better-sqlite3", category: "database" },
      { package: "firebase", category: "database" },
      { package: "@firebase", category: "database" },
      { package: "firebase-admin", category: "database" },
      { package: "@aws-sdk", category: "cloud" },
      { package: "@google-cloud", category: "cloud" },
      { package: "@azure", category: "cloud" },

      // Payment
      { package: "stripe", category: "payment" },
      { package: "@stripe", category: "payment" },
      { package: "paypal", category: "payment" },
      { package: "@paypal", category: "payment" },
      { package: "razorpay", category: "payment" },
      { package: "lemonsqueezy", category: "payment" },
      { package: "@lemonsqueezy", category: "payment" },

      // Email
      { package: "resend", category: "email" },
      { package: "nodemailer", category: "email" },
      { package: "@sendgrid", category: "email" },
      { package: "postmark", category: "email" },
      { package: "mailgun", category: "email" },

      // Auth (standalone)
      { package: "next-auth", category: "auth" },
      { package: "@auth", category: "auth" },
      { package: "@clerk", category: "auth" },
      { package: "lucia", category: "auth" },

      // HTTP clients (any direct network call)
      { package: "axios", category: "http" },
      { package: "node-fetch", category: "http" },
      { package: "got", category: "http" },
      { package: "ky", category: "http" },
      { package: "undici", category: "http" },
      { package: "superagent", category: "http" },

      // AI / ML
      { package: "openai", category: "ai" },
      { package: "@anthropic-ai", category: "ai" },
      { package: "cohere-ai", category: "ai" },
      { package: "@huggingface", category: "ai" },
      { package: "replicate", category: "ai" },

      // Messaging / Realtime
      { package: "twilio", category: "messaging" },
      { package: "@slack", category: "messaging" },
      { package: "pusher", category: "messaging" },
      { package: "ably", category: "messaging" },

      // Storage
      { package: "@uploadthing", category: "storage" },
      { package: "cloudinary", category: "storage" },
    ];

    // Merge user-defined services
    const userServices = options.services || [];
    const allServices = [...builtinServices, ...userServices];

    function matchesService(importSource) {
      for (const svc of allServices) {
        if (
          importSource === svc.package ||
          importSource.startsWith(svc.package + "/") ||
          importSource.startsWith(svc.package + "-")
        ) {
          return svc;
        }
      }

      // Also catch local path imports to lib/ that initialize services
      // e.g. import { supabase } from "@/lib/supabase"
      // but NOT lib/utils or lib/constants
      if (
        (importSource.includes("/lib/") || importSource.includes("@/lib/")) &&
        allServices.some((svc) => {
          const name = svc.package.replace(/^@/, "").split("/")[0];
          return importSource.includes(name);
        })
      ) {
        const matched = allServices.find((svc) => {
          const name = svc.package.replace(/^@/, "").split("/")[0];
          return importSource.includes(name);
        });
        return matched || null;
      }

      return null;
    }

    // Pick the right message based on file type
    const isBackendRoute =
      filename.includes("/routes/") ||
      filename.includes("/controllers/") ||
      filename.includes("/handlers/");
    const serviceMsg = isApiRoute
      ? "noServiceInApiRoute"
      : isBackendRoute
        ? "noServiceInBackend"
        : "noServiceInComponent";
    const fetchMsg = isApiRoute ? "noFetchInApiRoute" : "noFetchInComponent";

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        const match = matchesService(source);

        if (match) {
          context.report({
            node,
            messageId: serviceMsg,
            data: {
              source,
              category: match.category || "external",
            },
          });
        }
      },

      CallExpression(node) {
        // Catch require() calls
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "require" &&
          node.arguments[0] &&
          node.arguments[0].type === "Literal" &&
          typeof node.arguments[0].value === "string"
        ) {
          const source = node.arguments[0].value;
          const match = matchesService(source);
          if (match) {
            context.report({
              node,
              messageId: serviceMsg,
              data: {
                source,
                category: match.category || "external",
              },
            });
          }
        }

        // Catch fetch() calls
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "fetch"
        ) {
          const firstArg = node.arguments[0];
          if (firstArg) {
            context.report({
              node,
              messageId: fetchMsg,
              data: { name: "fetch" },
            });
          }
        }

        // Catch axios() direct calls
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "axios"
        ) {
          context.report({
            node,
            messageId: "noFetchInComponent",
            data: { name: "axios" },
          });
        }

        // Catch axios.get(), axios.post(), etc.
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.object.type === "Identifier" &&
          node.callee.object.name === "axios"
        ) {
          context.report({
            node,
            messageId: "noFetchInComponent",
            data: { name: "axios." + (node.callee.property.name || "request") },
          });
        }
      },
    };
  },
};
