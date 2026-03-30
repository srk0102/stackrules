# StackRules

Architecture rules for vibe coders and AI agents.

AI writes code that works but creates spaghetti. Supabase calls in components. Stripe inline. No service layer. No logging. Duplicate functions everywhere. Then when something breaks nobody knows where anything is.

StackRules enforces clean architecture at the ESLint level. Violations show as real errors in VSCode. AI sees errors and must fix them. `eslint-disable` is banned. Pre-commit hooks block bad code. Nothing bad ships.

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [`eslint-plugin-stackrules`](packages/eslint-plugin-stackrules) | [![npm](https://img.shields.io/npm/v/eslint-plugin-stackrules)](https://www.npmjs.com/package/eslint-plugin-stackrules) | ESLint plugin with 12 architecture rules |
| [`create-stackrules`](packages/cli) | [![npm](https://img.shields.io/npm/v/create-stackrules)](https://www.npmjs.com/package/create-stackrules) | CLI for zero-config setup |

## Quick start

```bash
# Scan any codebase (Python, Go, Java, JS/TS, Ruby, Rust, etc.)
npx create-stackrules clean

# Add ESLint integration to JS/TS projects
npx create-stackrules inject

# See all violations in real-time
npx eslint .
```

One command. Zero config. Any language. Every spaghetti pattern flagged with a fix explanation.

## What it catches

**Architecture:**
- Service SDKs (Supabase, Stripe, Resend, 50+ packages) imported outside `services/`
- Missing logging in service files
- Side effects in `utils/`
- Raw SQL instead of ORM/client methods
- `eslint-disable` comments (completely banned)

**Complexity:**
- Pages with too many state variables, handlers, and JSX — outputs a full refactoring plan
- API routes with direct DB calls and no logging
- Bloated hooks that should be split
- Backend routes/controllers with inline business logic

**Code quality:**
- Exported functions without comments
- Functions over 40 lines
- Magic numbers without named constants
- Single-letter variable names
- Empty catch blocks

**Reusability:**
- Large raw HTML blocks that should be components
- Repeated useState+useEffect patterns that should be hooks
- Native HTML elements that should use shadcn

## How it works

```
ESLint          -> parses code, walks AST, shows errors in VSCode
Your org rules  -> your existing PR checks stay untouched
StackRules      -> architecture + code quality on top of everything
```

Every error message is a working prompt. AI reads the error and knows exactly what to do. Vibe coders copy-paste the error into any chat and get a fix.

```
This page has 15 state variables, 3 handler functions, and 275 lines of JSX.

Refactor plan:
1. Extract loadProfile(), handleSave(), handleFileUpload() -> services/profile.ts
2. Extract state -> hooks/useProfile.ts
3. Break the 275-line JSX into smaller components in components/

After refactor, this page should be ~30 lines.
```

## License

MIT
