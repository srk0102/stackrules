"use strict";

const fs = require("fs-extra");
const path = require("path");
const chalk = require("chalk");
const { glob } = require("glob");

// ── Language detection ──────────────────────────────
const LANG_EXTENSIONS = {
  js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
  py: "python", go: "go", java: "java", rb: "ruby", rs: "rust",
  cs: "csharp", kt: "kotlin", swift: "swift", php: "php",
};

// Import patterns per language
const IMPORT_PATTERNS = {
  javascript: [/import\s+.*from\s+['"]([^'"]+)['"]/, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/],
  typescript: [/import\s+.*from\s+['"]([^'"]+)['"]/, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/],
  python: [/^import\s+(\S+)/, /^from\s+(\S+)\s+import/],
  go: [/^\s*"([^"]+)"/, /^\s*\w+\s+"([^"]+)"/],
  java: [/^import\s+([\w.]+);/],
  ruby: [/require\s+['"]([^'"]+)['"]/, /require_relative\s+['"]([^'"]+)['"]/],
  rust: [/use\s+([\w:]+)/, /extern\s+crate\s+(\w+)/],
  kotlin: [/^import\s+([\w.]+)/],
  php: [/use\s+([\w\\]+)/, /require_once\s+['"]([^'"]+)['"]/],
};

// Function patterns per language
const FUNCTION_PATTERNS = {
  javascript: /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>)/g,
  typescript: /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>)/g,
  python: /^\s*(?:async\s+)?def\s+(\w+)/gm,
  go: /^func\s+(?:\([^)]+\)\s+)?(\w+)/gm,
  java: /(?:public|private|protected|static)\s+\w+\s+(\w+)\s*\(/gm,
  ruby: /^\s*def\s+(\w+)/gm,
  rust: /^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/gm,
  kotlin: /^\s*(?:fun|suspend\s+fun)\s+(\w+)/gm,
  php: /^\s*(?:public|private|protected)?\s*function\s+(\w+)/gm,
};

// Service SDK keywords — universal across all languages
const SERVICE_KEYWORDS = [
  { keyword: "supabase", category: "database" },
  { keyword: "prisma", category: "database" },
  { keyword: "drizzle", category: "database" },
  { keyword: "mongoose", category: "database" },
  { keyword: "sqlalchemy", category: "database" },
  { keyword: "firebase", category: "database" },
  { keyword: "pymongo", category: "database" },
  { keyword: "aiosqlite", category: "database" },
  { keyword: "redis", category: "database" },
  { keyword: "sqlite3", category: "database" },
  { keyword: "stripe", category: "payment" },
  { keyword: "paypal", category: "payment" },
  { keyword: "resend", category: "email" },
  { keyword: "sendgrid", category: "email" },
  { keyword: "nodemailer", category: "email" },
  { keyword: "smtplib", category: "email" },
  { keyword: "axios", category: "http" },
  { keyword: "httpx", category: "http" },
  { keyword: "requests", category: "http" },
  { keyword: "aiohttp", category: "http" },
  { keyword: "node-fetch", category: "http" },
  { keyword: "openai", category: "ai" },
  { keyword: "anthropic", category: "ai" },
  { keyword: "groq", category: "ai" },
  { keyword: "langchain", category: "ai" },
  { keyword: "langgraph", category: "ai" },
  { keyword: "pinecone", category: "vector-db" },
  { keyword: "chromadb", category: "vector-db" },
  { keyword: "weaviate", category: "vector-db" },
  { keyword: "boto3", category: "cloud" },
  { keyword: "twilio", category: "messaging" },
];

// Lint suppression patterns
const LINT_DISABLE = {
  javascript: /eslint-disable|@ts-ignore|@ts-nocheck/,
  typescript: /eslint-disable|@ts-ignore|@ts-nocheck/,
  python: /# noqa|# type:\s*ignore|# pylint:\s*disable/,
  go: /nolint/, java: /@SuppressWarnings/, ruby: /rubocop:disable/,
  rust: /#\[allow\(/, kotlin: /@Suppress/, php: /phpcs:ignore/,
};

// Logger usage patterns
const LOGGER_USAGE = {
  javascript: ["logger.", "console.log", "console.error", "winston.", "pino."],
  typescript: ["logger.", "console.log", "console.error", "winston.", "pino."],
  python: ["logging.", "logger.", "log."],
  go: ["log.", "logger.", "zap.", "logrus."],
  java: ["Logger.", "log.", "LOG."],
  ruby: ["logger.", "Rails.logger"],
  rust: ["log::", "tracing::"],
  kotlin: ["logger.", "Log."],
  php: ["Log::", "logger."],
};

// Directories
const ROUTE_DIRS = ["routes", "routers", "controllers", "handlers", "cmd"];
const ALLOWED_DIRS = ["services", "service", "lib", "middleware", "pkg", "internal"];

function getLang(fp) {
  return LANG_EXTENSIONS[path.extname(fp).slice(1).toLowerCase()] || null;
}

function inDir(fp, dirs) {
  return dirs.some((d) => fp.includes(`/${d}/`) || fp.includes(`\\${d}\\`));
}

function getFunctions(content, lang) {
  const pat = FUNCTION_PATTERNS[lang];
  if (!pat) return [];
  const funcs = [];
  let m;
  const regex = new RegExp(pat.source, pat.flags);
  while ((m = regex.exec(content)) !== null) {
    const name = m[1] || m[2];
    if (name) funcs.push(name);
  }
  return funcs;
}

function getImportedServices(content, lang) {
  const patterns = IMPORT_PATTERNS[lang];
  if (!patterns) return [];
  const found = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const isImport = patterns.some((p) => p.test(line));
    if (!isImport) continue;
    for (const svc of SERVICE_KEYWORDS) {
      if (line.toLowerCase().includes(svc.keyword)) {
        found.push({ keyword: svc.keyword, category: svc.category, line });
        break;
      }
    }
  }
  return found;
}

function hasLogging(content, lang) {
  const patterns = LOGGER_USAGE[lang] || [];
  return patterns.some((p) => content.includes(p));
}

// ── Per-file analysis (the smart part) ──────────────
function analyzeFile(filePath, content) {
  const lang = getLang(filePath);
  if (!lang) return [];

  const lines = content.split("\n");
  const totalLines = lines.length;
  const funcs = getFunctions(content, lang);
  const services = getImportedServices(content, lang);
  const hasLogger = hasLogging(content, lang);
  const fileName = path.basename(filePath);
  const violations = [];

  // Skip empty/tiny files and __init__.py
  if (totalLines < 10) return [];
  if (fileName === "__init__.py" || fileName === "__init__.rb") return [];

  // ── Detect file role ──────────────────────────────
  const isRoute =
    inDir(filePath, ROUTE_DIRS) ||
    fileName.includes("route") ||
    fileName.includes("router") ||
    fileName.includes("controller") ||
    fileName.includes("handler") ||
    fileName === "server.py" ||
    fileName === "app.py" ||
    fileName === "main.py";

  const isService = inDir(filePath, ["services", "service"]);
  const isUtil = inDir(filePath, ["utils", "util", "helpers"]);

  // ── 1. Route/server file analysis ─────────────────
  // Detect if route file is doing too much:
  // - Direct SDK imports (services.length > 0)
  // - Too many functions for a route file (> 5)
  // - Too many lines (> 100)
  // - Imports local modules that do business logic
  const localModuleImports = [];
  if (isRoute) {
    const importLines = lines.filter((l) => {
      const pats = IMPORT_PATTERNS[lang] || [];
      return pats.some((p) => p.test(l));
    });
    for (const il of importLines) {
      // Skip stdlib/framework imports
      if (lang === "python" && (
        il.includes("fastapi") || il.includes("pydantic") ||
        il.includes("typing") || il.includes("uuid") ||
        il.includes("os") || il.includes("dotenv") || il.includes("sys")
      )) continue;
      if (lang === "javascript" && (
        il.includes("react") || il.includes("next") || il.includes("express")
      )) continue;
      // Everything else that's a local import is business logic leaking into routes
      const isRelative = il.includes("from .") || il.includes("from memory") ||
        il.includes("from core") || il.includes("from models") ||
        il.includes('require("./') || il.includes("require('../");
      const isServiceSdk = services.some((s) => il.toLowerCase().includes(s.keyword));
      if (isRelative || isServiceSdk) {
        localModuleImports.push(il.trim());
      }
    }
  }

  const routeHasProblems = isRoute && (
    services.length > 0 ||
    localModuleImports.length > 0 ||
    (funcs.length > 5 && totalLines > 100)
  );

  if (routeHasProblems) {
    const allImports = [
      ...services.map((s) => `${s.keyword} (${s.category})`),
      ...localModuleImports.filter((l) => !services.some((s) => l.includes(s.keyword))),
    ];
    const svcList = allImports.join(", ");
    const baseName = fileName.replace(/\.[^.]+$/, "");

    // Which functions contain service calls?
    const serviceFuncs = [];
    for (const fn of funcs) {
      // Find the function body and check if it uses a service
      const fnRegex = new RegExp(`(?:def|func|function|async def)\\s+${fn}[\\s\\S]*?(?=\\n(?:def|func|function|async def|class|@app)|$)`, "m");
      const fnMatch = content.match(fnRegex);
      if (fnMatch) {
        const fnBody = fnMatch[0];
        const usesService = services.some((s) => fnBody.toLowerCase().includes(s.keyword));
        if (usesService) serviceFuncs.push(fn);
      }
    }

    const funcNames = serviceFuncs.length > 0
      ? serviceFuncs.map((f) => `${f}()`).join(", ")
      : "the service calls";

    let plan = [];
    plan.push(
      `1. Extract ${funcNames} into services/${baseName}_service.${lang === "python" ? "py" : lang === "go" ? "go" : "ts"} — routes should be thin: parse request, call service, return response`
    );

    if (!hasLogger) {
      plan.push(
        `2. Add structured logging — log every request (method, path, params), every service call result, every error with full context, and request duration`
      );
    }

    if (totalLines > 100) {
      plan.push(
        `${plan.length + 1}. This file is ${totalLines} lines with ${funcs.length} functions — after extracting to services, route handlers should be ~10-15 lines each`
      );
    }

    plan.push(
      `\nAfter refactor: ${fileName} only defines routes and calls service functions. Zero business logic, zero direct SDK calls.`
    );

    violations.push({
      file: filePath,
      line: 1,
      name: "Route/server has direct service calls",
      code: `${totalLines} lines, ${funcs.length} functions, imports: ${svcList}`,
      fix: `Refactor plan:\n${plan.join("\n")}`,
    });
  }

  // ── 2. Service file without logging ───────────────
  if (isService && !hasLogger && totalLines > 10) {
    violations.push({
      file: filePath,
      line: 1,
      name: "Service missing logging",
      code: `${funcs.length} functions with no structured logging`,
      fix: `Add structured logging to every function in this service. Each function should log: what was called, params received, result returned, duration, and errors with full stack trace.`,
    });
  }

  // ── 3. Utils with side effects ────────────────────
  if (isUtil && services.length > 0) {
    const svcList = services.map((s) => s.keyword).join(", ");
    violations.push({
      file: filePath,
      line: 1,
      name: "Utils has side effects",
      code: `Imports: ${svcList}`,
      fix: `Utils must be pure functions — no API calls, no database access, no side effects. Move ${svcList} calls to services/.`,
    });
  }

  // ── 4. Raw SQL ────────────────────────────────────
  const sqlPattern = /\b(SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i;
  for (let i = 0; i < lines.length; i++) {
    if (sqlPattern.test(lines[i])) {
      violations.push({
        file: filePath,
        line: i + 1,
        name: "Raw SQL query",
        code: lines[i].trim(),
        fix: "Use an ORM or query builder instead of raw SQL. Raw SQL is harder to maintain, harder to test, and prone to injection if not parameterized.",
      });
    }
  }

  // ── 5. Lint suppression ───────────────────────────
  const disablePat = LINT_DISABLE[lang];
  if (disablePat) {
    for (let i = 0; i < lines.length; i++) {
      if (disablePat.test(lines[i])) {
        violations.push({
          file: filePath,
          line: i + 1,
          name: "Lint suppression",
          code: lines[i].trim(),
          fix: "Remove the lint suppression and fix the underlying issue. Suppressing warnings hides real problems.",
        });
      }
    }
  }

  // ── 6. File complexity with specific guidance ─────
  if (totalLines > 200 && funcs.length > 5 && !isRoute) {
    // Group functions by what they do
    const baseName = fileName.replace(/\.[^.]+$/, "");
    violations.push({
      file: filePath,
      line: 1,
      name: "File too complex",
      code: `${totalLines} lines, ${funcs.length} functions: ${funcs.join(", ")}`,
      fix: `This file has ${funcs.length} functions across ${totalLines} lines. Split by responsibility — each file should do one thing. Functions: ${funcs.join(", ")}`,
    });
  }

  // ── 7. Missing error handling ─────────────────────
  if (lang === "python") {
    // Check for bare except
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*except\s*:/.test(lines[i])) {
        violations.push({
          file: filePath,
          line: i + 1,
          name: "Bare except clause",
          code: lines[i].trim(),
          fix: "Never use bare `except:` — always catch specific exceptions (`except ValueError as e:`) and log the error. Bare except swallows everything including KeyboardInterrupt.",
        });
      }
    }
  }

  // ── 8. Print statements instead of logging ────────
  if (lang === "python" && !isUtil) {
    let printCount = 0;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*print\s*\(/.test(lines[i])) printCount++;
    }
    if (printCount >= 3) {
      violations.push({
        file: filePath,
        line: 1,
        name: "Using print() instead of logger",
        code: `${printCount} print() statements`,
        fix: `Replace ${printCount} print() calls with structured logging (import logging). Print statements disappear in production, don't include timestamps, and can't be filtered by level.`,
      });
    }
  }

  return violations;
}

async function cleanCommand(options) {
  const targetDir = path.resolve(options.dir);
  const outputFile = path.resolve(options.output);

  console.log(chalk.bold.cyan("\n  StackRules Clean\n"));
  console.log(`  Scanning ${chalk.yellow(targetDir)} for violations...\n`);

  const files = await glob("**/*.{js,jsx,ts,tsx,py,go,java,rb,rs,kt,cs,swift,php}", {
    cwd: targetDir,
    ignore: [
      "node_modules/**", ".next/**", "dist/**", "build/**",
      "__pycache__/**", "*.pyc", ".venv/**", "venv/**", "env/**",
      "vendor/**", "target/**", "bin/**", ".git/**", "*.min.js",
    ],
    absolute: true,
  });

  const langCounts = {};
  for (const f of files) {
    const lang = getLang(f) || "unknown";
    langCounts[lang] = (langCounts[lang] || 0) + 1;
  }

  console.log(chalk.gray(`  Found ${files.length} source files`));
  for (const [lang, count] of Object.entries(langCounts)) {
    console.log(chalk.gray(`    ${lang}: ${count} files`));
  }
  console.log("");

  const allViolations = [];
  for (const file of files) {
    const content = await fs.readFile(file, "utf-8");
    const violations = analyzeFile(file, content);
    allViolations.push(...violations);
  }

  // Group by name
  const grouped = {};
  for (const v of allViolations) {
    if (!grouped[v.name]) grouped[v.name] = [];
    grouped[v.name].push(v);
  }

  if (allViolations.length === 0) {
    console.log(chalk.bold.green("  No violations found! Your codebase is clean.\n"));
    return;
  }

  console.log(chalk.bold.red(`  Found ${allViolations.length} violation(s):\n`));
  for (const [name, violations] of Object.entries(grouped)) {
    console.log(chalk.red(`    ${name}: ${violations.length}`));
  }

  // Generate cleanup prompt
  let prompt = `# StackRules Cleanup Prompt\n\n`;
  prompt += `Paste this into Claude Code, Cursor, or any AI chat to fix all architecture violations.\n\n`;
  prompt += `## Architecture Rules\n\n`;
  prompt += `- \`services/\` — all external service calls (database, payment, email, AI, any API)\n`;
  prompt += `- \`utils/\` — pure helper functions only, no side effects\n`;
  prompt += `- \`routes/\` / \`controllers/\` / \`server.py\` — thin: parse request, call service, return response\n`;
  prompt += `- \`middleware/\` — auth, logging, validation only\n`;
  prompt += `- Every service function must log: what was called, params, result, duration, errors\n`;
  prompt += `- Use structured logging, not print(). Use an ORM, not raw SQL.\n\n`;
  prompt += `## Violations\n\n`;

  for (const [name, violations] of Object.entries(grouped)) {
    prompt += `### ${name} (${violations.length})\n\n`;
    for (const v of violations) {
      const relPath = path.relative(targetDir, v.file);
      prompt += `**\`${relPath}:${v.line}\`** — \`${v.code}\`\n\n`;
      prompt += `${v.fix}\n\n---\n\n`;
    }
  }

  await fs.writeFile(outputFile, prompt);

  console.log(
    chalk.bold.green(`\n  Cleanup prompt saved to ${chalk.yellow(path.relative(targetDir, outputFile))}`)
  );
  console.log(chalk.gray("\n  Paste it into Claude Code or Cursor to auto-fix all violations.\n"));
}

module.exports = cleanCommand;
