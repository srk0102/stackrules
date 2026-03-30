# create-stackrules

One command to enforce clean architecture in any codebase, any language.

## Usage

### Scan any codebase (any language)

```bash
npx create-stackrules clean
```

Works on JavaScript, TypeScript, Python, Go, Java, Ruby, Rust, Kotlin, PHP, C#, Swift.

Scans every source file, finds architecture violations, generates a markdown prompt you paste into Claude Code, Cursor, or any AI chat. The AI fixes everything.

```
  StackRules Clean

  Found 11 source files
    python: 11 files

  Found 11 violation(s):
    File too complex: 3
    Raw SQL query: 7
    Missing logging in service: 1

  Cleanup prompt saved to stackrules-cleanup.md
```

### Add to JS/TS project (ESLint integration)

```bash
npx create-stackrules inject
```

This command:
1. Detects your stack (Next.js, Supabase, Stripe, Express, etc.)
2. Installs `eslint-plugin-stackrules`
3. Patches your existing ESLint config (keeps your org rules intact)
4. Creates `.stackrules.json` for org-level customization
5. Adds `lint` scripts to package.json

Then run `npx eslint .` for real-time errors in VSCode.

### Scaffold new project

```bash
npx create-stackrules init
```

## What it catches

Regardless of language:

- **Service imports in wrong places** — database, payment, email, AI SDKs imported outside `services/`
- **Missing logging** — service files without structured logging
- **Raw SQL** — queries that should use an ORM
- **Lint suppression** — `eslint-disable`, `# noqa`, `nolint`, `@SuppressWarnings`
- **Complex files** — 200+ line files that should be split
- **Route/controller bloat** — handlers with direct DB calls and no logging

## Supported languages

| Language | Extensions | Import detection | Logger detection |
|----------|-----------|-----------------|-----------------|
| JavaScript/TypeScript | .js .jsx .ts .tsx | import/require | console, winston, pino |
| Python | .py | import/from | logging, logger, print |
| Go | .go | import | log, zap, logrus |
| Java | .java | import | Logger, LOG |
| Ruby | .rb | require | logger, Rails.logger |
| Rust | .rs | use/extern crate | log, tracing |
| Kotlin | .kt | import | logger, Log |
| PHP | .php | use/require_once | Log, error_log |
| C# | .cs | using | (basic) |
| Swift | .swift | import | (basic) |

## License

MIT
