# eslint-plugin-stackrules

ESLint plugin that enforces clean architecture in AI-generated codebases.

AI writes code that works but creates spaghetti — Supabase calls in components, Stripe inline, no service layer, no logging, duplicate functions everywhere. StackRules catches every bad pattern and tells the AI exactly how to fix it.

Works on top of ESLint. You keep your existing rules. StackRules adds the architecture layer.

## Install

```bash
npm install --save-dev eslint-plugin-stackrules
```

Or use the CLI for zero-config setup:

```bash
npx create-stackrules inject
```

## Setup

**Flat config (ESLint 9+):**

```js
// eslint.config.mjs
import stackrules from "eslint-plugin-stackrules";

export default [
  {
    plugins: { stackrules },
    rules: {
      "stackrules/no-service-in-components": "error",
      "stackrules/page-complexity": "warn",
      "stackrules/code-quality": "warn",
      // ... see all rules below
    },
  },
];
```

**Legacy config:**

```json
{
  "extends": ["plugin:stackrules/recommended"],
  "plugins": ["stackrules"]
}
```

## Rules

### Architecture enforcement

| Rule | Default | What it catches |
|------|---------|-----------------|
| `no-service-in-components` | error | Database, payment, email, HTTP, AI, cloud SDKs imported outside `services/`. Covers 50+ packages automatically. Different messages for pages vs API routes vs backend routes. |
| `services-must-log` | error | Service files that don't import and use a logger. Every service function must log params, result, duration, errors. |
| `no-side-effects-in-utils` | error | API calls, service imports, or side effects in `utils/` files. Utils must be pure functions. |
| `no-raw-sql` | error | Raw SQL strings. Use Supabase client methods, Prisma, Drizzle, or any ORM instead. |
| `no-eslint-disable` | error | All `eslint-disable` comments. AI must fix violations, not suppress them. |
| `no-business-logic-in-components` | warn | Components importing directly from `services/`. Components should use hooks. |

### AI-quality refactoring guidance

| Rule | Default | What it does |
|------|---------|--------------|
| `page-complexity` | warn | Analyzes pages, API routes, hooks, backend routes, and components. Counts state variables, handler functions, JSX lines. When a file is too complex, outputs a full refactoring plan naming the exact functions to extract, exact files to create, and what the file should look like after. |
| `code-quality` | warn | Enforces developer-readable code. Exported functions must have comments. Functions over 40 lines get flagged. Magic numbers must be named constants. Single-letter variables caught. Empty catch blocks flagged. |

### Reusability enforcement

| Rule | Default | What it catches |
|------|---------|-----------------|
| `no-inline-component` | warn | Large blocks of raw HTML (15+ `div`/`span`/`p` elements) that should be extracted to reusable components. Composing existing components (Card, Button) is fine. |
| `no-duplicate-logic` | warn | Repeated `useState` + `useEffect` patterns that should be custom hooks. |
| `no-duplicate-utils` | warn | Common utility function names that likely already exist in the codebase. |
| `prefer-shadcn` | warn | Native HTML elements (`<button>`, `<input>`) styled with Tailwind when a shadcn component exists. |

## How it works

StackRules works on top of ESLint. ESLint parses the code and walks the AST. StackRules detects architectural patterns and writes errors that are prompts.

Every error message is written so that AI (Cursor, Claude Code, Copilot) can read it and fix the violation automatically. A vibe coder can copy-paste the error into any chat and get a fix.

Example output for a 450-line page:

```
This page has 15 state variables, 3 handler functions, and 275 lines of JSX.

Refactor plan:
1. Extract loadProfile(), handleSave(), handleFileUpload() -> services/profile.ts
   (every function logs params, result, duration, errors)
2. Extract state (loading, saving, uploading, ...) + data loading -> hooks/useProfile.ts
   — this hook calls the service, manages loading/error/data state
3. Break the 275-line JSX into smaller components in components/

After refactor, this page should be ~30 lines: import useProfile,
destructure state + handlers, render components with props. Zero business logic.
```

## Org config

Create `.stackrules.json` in your project root to customize behavior:

```json
{
  "customServices": [
    { "package": "my-internal-sdk", "category": "backend" }
  ],
  "codeQuality": {
    "requireCommentsOnExports": true,
    "maxFunctionLines": 40,
    "noMagicNumbers": true,
    "noSingleLetterVars": true,
    "requireErrorHandling": true
  }
}
```

## Service registry

`no-service-in-components` has a built-in registry of 50+ packages across 9 categories:

- **Database** — Supabase, Prisma, Drizzle, Mongoose, TypeORM, Sequelize, Firebase, pg, mysql2
- **Payment** — Stripe, PayPal, Razorpay, LemonSqueezy
- **Email** — Resend, Nodemailer, SendGrid, Postmark
- **HTTP** — axios, node-fetch, got, ky, undici
- **AI** — OpenAI, Anthropic, Replicate
- **Cloud** — AWS SDK, Google Cloud, Azure
- **Auth** — NextAuth, Clerk, Lucia
- **Messaging** — Twilio, Pusher
- **Storage** — UploadThing, Cloudinary

Add your own via `customServices` in `.stackrules.json` or rule options.

## License

MIT
