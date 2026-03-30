"use strict";

const fs = require("fs-extra");
const path = require("path");
const chalk = require("chalk");
const { execSync } = require("child_process");

const FOLDERS = [
  "src/components",
  "src/hooks",
  "src/services",
  "src/utils",
  "src/lib",
  "src/types",
  "src/middleware",
];

const FOLDER_READMES = {
  "src/components": "# Components\n\nUI components only. Zero business logic. No service calls.\n",
  "src/hooks": "# Hooks\n\nReusable React hooks. Custom logic that components share.\n",
  "src/services":
    "# Services\n\nAll external service calls live here: Supabase, Stripe, Resend, any API.\nEvery function must import and use a logger.\n",
  "src/utils":
    "# Utils\n\nPure helper functions only. No side effects, no API calls, no service imports.\n",
  "src/lib":
    "# Lib\n\nThird-party configuration and initialization. Supabase client, Stripe instance, etc.\n",
  "src/types": "# Types\n\nAll TypeScript interfaces and types, centralized.\n",
  "src/middleware": "# Middleware\n\nAuth, logging, and validation middleware only.\n",
};

const ESLINT_CONFIG = `import stackrules from "eslint-plugin-stackrules";

export default [
  stackrules.configs["flat/recommended"],
  {
    ignores: ["node_modules/", ".next/", "dist/"],
  },
];
`;

const LOGGER_TEMPLATE = `export function createLogger(service: string) {
  return {
    info(message: string, data?: Record<string, unknown>) {
      console.log(JSON.stringify({ level: "info", service, message, ...data, timestamp: new Date().toISOString() }));
    },
    error(message: string, error?: unknown, data?: Record<string, unknown>) {
      console.error(JSON.stringify({ level: "error", service, message, error: String(error), ...data, timestamp: new Date().toISOString() }));
    },
    warn(message: string, data?: Record<string, unknown>) {
      console.warn(JSON.stringify({ level: "warn", service, message, ...data, timestamp: new Date().toISOString() }));
    },
  };
}
`;

const PRECOMMIT_HOOK = `#!/bin/sh
# StackRules pre-commit hook — blocks code that violates architecture rules
npx eslint --max-warnings 0 . || {
  echo ""
  echo "❌ StackRules: Architecture violations found. Fix them before committing."
  echo "   Run 'npx eslint .' to see all violations."
  echo ""
  exit 1
}
`;

async function initCommand(options) {
  const targetDir = path.resolve(options.dir);

  console.log(chalk.bold.cyan("\n🏗️  StackRules Init\n"));
  console.log(`Creating project structure in ${chalk.yellow(targetDir)}\n`);

  // Create folders
  for (const folder of FOLDERS) {
    const fullPath = path.join(targetDir, folder);
    await fs.ensureDir(fullPath);
    const readmeContent = FOLDER_READMES[folder];
    if (readmeContent) {
      await fs.writeFile(path.join(fullPath, "README.md"), readmeContent);
    }
    console.log(chalk.green("  ✓") + ` Created ${folder}/`);
  }

  // Create logger
  const loggerPath = path.join(targetDir, "src/lib/logger.ts");
  if (!(await fs.pathExists(loggerPath))) {
    await fs.writeFile(loggerPath, LOGGER_TEMPLATE);
    console.log(chalk.green("  ✓") + " Created src/lib/logger.ts");
  }

  // Create ESLint config
  const eslintPath = path.join(targetDir, "eslint.config.mjs");
  if (!(await fs.pathExists(eslintPath))) {
    await fs.writeFile(eslintPath, ESLINT_CONFIG);
    console.log(chalk.green("  ✓") + " Created eslint.config.mjs");
  }

  // Initialize git and pre-commit hook
  if (options.git !== false) {
    const gitDir = path.join(targetDir, ".git");
    if (!(await fs.pathExists(gitDir))) {
      try {
        execSync("git init", { cwd: targetDir, stdio: "pipe" });
        console.log(chalk.green("  ✓") + " Initialized git repository");
      } catch {
        console.log(chalk.yellow("  ⚠") + " Could not initialize git");
      }
    }

    const hookDir = path.join(targetDir, ".git/hooks");
    if (await fs.pathExists(hookDir)) {
      const hookPath = path.join(hookDir, "pre-commit");
      await fs.writeFile(hookPath, PRECOMMIT_HOOK, { mode: 0o755 });
      console.log(chalk.green("  ✓") + " Installed pre-commit hook");
    }
  }

  // Create .gitignore if missing
  const gitignorePath = path.join(targetDir, ".gitignore");
  if (!(await fs.pathExists(gitignorePath))) {
    await fs.writeFile(
      gitignorePath,
      "node_modules/\n.next/\ndist/\n.env\n.env.local\n"
    );
    console.log(chalk.green("  ✓") + " Created .gitignore");
  }

  console.log(chalk.bold.green("\n✅ StackRules initialized!\n"));
  console.log("Next steps:");
  console.log(chalk.gray("  1. npm install eslint eslint-plugin-stackrules"));
  console.log(chalk.gray("  2. npm run lint"));
  console.log("");
}

module.exports = initCommand;
