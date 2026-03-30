"use strict";

const fs = require("fs-extra");
const path = require("path");
const chalk = require("chalk");
const { execSync } = require("child_process");

function detectStack(dir) {
  const stack = [];
  const pkgPath = path.join(dir, "package.json");

  if (!fs.pathExistsSync(pkgPath)) return stack;

  const pkg = fs.readJsonSync(pkgPath);
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  if (allDeps["next"]) stack.push("nextjs");
  if (allDeps["@supabase/supabase-js"] || allDeps["@supabase/ssr"])
    stack.push("supabase");
  if (allDeps["stripe"] || allDeps["@stripe/stripe-js"]) stack.push("stripe");
  if (allDeps["resend"]) stack.push("resend");
  if (allDeps["express"] || allDeps["fastify"] || allDeps["koa"])
    stack.push("node");
  if (allDeps["mongoose"]) stack.push("mongoose");
  if (allDeps["@prisma/client"]) stack.push("prisma");
  if (allDeps["drizzle-orm"]) stack.push("drizzle");
  if (allDeps["firebase"] || allDeps["firebase-admin"]) stack.push("firebase");
  if (allDeps["openai"]) stack.push("openai");

  const reqPath = path.join(dir, "requirements.txt");
  const pyprojectPath = path.join(dir, "pyproject.toml");
  if (fs.pathExistsSync(reqPath) || fs.pathExistsSync(pyprojectPath)) {
    stack.push("fastapi");
  }

  return stack;
}

// All stackrules rules with their severity
const STACKRULES_RULES = {
  "stackrules/no-eslint-disable": "error",
  "stackrules/no-service-in-components": "error",
  "stackrules/services-must-log": "error",
  "stackrules/no-raw-sql": "error",
  "stackrules/no-side-effects-in-utils": "error",
  "stackrules/no-business-logic-in-components": "warn",
  "stackrules/no-duplicate-utils": "warn",
  "stackrules/no-duplicate-logic": "warn",
  "stackrules/no-inline-component": "warn",
  "stackrules/prefer-shadcn": "warn",
  "stackrules/page-complexity": "warn",
  "stackrules/code-quality": "warn",
};

const STACKRULES_CONFIG = {
  architecture: {
    services: ["services/"],
    utils: ["utils/", "helpers/"],
    hooks: ["hooks/"],
    components: ["components/"],
    config: ["lib/", "config/"],
    types: ["types/"],
    middleware: ["middleware/"],
  },
  customServices: [],
  codeQuality: {
    requireCommentsOnExports: true,
    maxFunctionLines: 40,
    noMagicNumbers: true,
    noSingleLetterVars: true,
    requireErrorHandling: true,
  },
};

async function injectCommand(options) {
  const targetDir = path.resolve(options.dir);

  console.log(chalk.bold.cyan("\n  StackRules Inject\n"));
  console.log(`  Injecting into ${chalk.yellow(targetDir)}\n`);

  // ── 1. Detect stack ───────────────────────────────
  const stack = detectStack(targetDir);
  if (stack.length > 0) {
    console.log(
      chalk.blue("  Detected stack: ") +
        stack.map((s) => chalk.bold(s)).join(", ")
    );
  }

  // ── 2. Install the npm package ────────────────────
  console.log(chalk.gray("\n  Installing eslint-plugin-stackrules...\n"));
  try {
    execSync("npm install --save-dev eslint-plugin-stackrules", {
      cwd: targetDir,
      stdio: "pipe",
    });
    console.log(chalk.green("  ✓") + " Installed eslint-plugin-stackrules");
  } catch {
    // If npm registry install fails, try local path (for development)
    try {
      const localPlugin = path.resolve(
        __dirname,
        "../../../../eslint-plugin-stackrules"
      );
      if (await fs.pathExists(localPlugin)) {
        execSync(`npm install --save-dev ${localPlugin}`, {
          cwd: targetDir,
          stdio: "pipe",
        });
        console.log(
          chalk.green("  ✓") + " Installed eslint-plugin-stackrules (local)"
        );
      } else {
        console.log(
          chalk.yellow("  ⚠") +
            " Could not install eslint-plugin-stackrules automatically"
        );
        console.log(
          chalk.gray("    Run: npm install --save-dev eslint-plugin-stackrules")
        );
      }
    } catch {
      console.log(
        chalk.yellow("  ⚠") +
          " Could not install eslint-plugin-stackrules automatically"
      );
      console.log(
        chalk.gray("    Run: npm install --save-dev eslint-plugin-stackrules")
      );
    }
  }

  // ── 3. Patch ESLint config ────────────────────────
  const eslintConfigs = [
    "eslint.config.mjs",
    "eslint.config.js",
    "eslint.config.cjs",
    ".eslintrc.js",
    ".eslintrc.cjs",
    ".eslintrc.json",
    ".eslintrc.yml",
    ".eslintrc.yaml",
    ".eslintrc",
  ];

  let configFile = null;
  for (const c of eslintConfigs) {
    if (await fs.pathExists(path.join(targetDir, c))) {
      configFile = c;
      break;
    }
  }

  if (configFile && configFile.startsWith("eslint.config")) {
    // Flat config — patch it
    const configPath = path.join(targetDir, configFile);
    let content = await fs.readFile(configPath, "utf-8");

    if (content.includes("eslint-plugin-stackrules")) {
      console.log(chalk.gray("  · ESLint config already has stackrules"));
    } else {
      // Instead of fragile regex patching, read the original config,
      // back it up, and write a clean new one that imports the original
      const backupPath = configPath + ".backup";
      await fs.copyFile(configPath, backupPath);

      const rulesLines = Object.entries(STACKRULES_RULES)
        .map(([rule, severity]) => `      "${rule}": "${severity}",`)
        .join("\n");

      // Read the original and inject stackrules plugin + rules into it
      const lines = content.split("\n");

      // Add the import after the last import statement
      let lastImportIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trimStart().startsWith("import ")) lastImportIdx = i;
      }
      if (lastImportIdx >= 0) {
        lines.splice(
          lastImportIdx + 1,
          0,
          'import stackrules from "eslint-plugin-stackrules";'
        );
      }

      // Find the defineConfig([ or export default [ and insert the rules block
      // Look for the line with ...nextTs, or ...nextVitals, and add after
      let insertIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (
          lines[i].includes("...nextTs") ||
          lines[i].includes("...nextVitals") ||
          lines[i].includes("...next")
        ) {
          insertIdx = i;
        }
      }

      // If we didn't find Next.js spreads, look for defineConfig([ or export default [
      if (insertIdx < 0) {
        for (let i = 0; i < lines.length; i++) {
          if (
            lines[i].includes("defineConfig([") ||
            lines[i].includes("export default [")
          ) {
            insertIdx = i;
          }
        }
      }

      const rulesBlock = [
        "  {",
        "    plugins: {",
        "      stackrules,",
        "    },",
        "    rules: {",
        ...Object.entries(STACKRULES_RULES).map(
          ([rule, sev]) => `      "${rule}": "${sev}",`
        ),
        "    },",
        "  },",
      ].join("\n");

      if (insertIdx >= 0) {
        lines.splice(insertIdx + 1, 0, rulesBlock);
      }

      await fs.writeFile(configPath, lines.join("\n"));
      console.log(
        chalk.green("  ✓") +
          ` Patched ${configFile} with stackrules (backup: ${configFile}.backup)`
      );
    }
  } else if (configFile) {
    // Legacy config — patch .eslintrc.*
    console.log(
      chalk.yellow("  ⚠") +
        ` Legacy config (${configFile}) — converting to flat config`
    );
    // Create a new flat config that extends the existing one
    const flatContent = `import stackrules from "eslint-plugin-stackrules";

const rulesLines = Object.entries(${JSON.stringify(STACKRULES_RULES, null, 2)});

export default [
  stackrules.configs["flat/recommended"],
  { ignores: ["node_modules/", ".next/", "dist/", "build/"] },
];
`;
    await fs.writeFile(path.join(targetDir, "eslint.config.mjs"), flatContent);
    console.log(chalk.green("  ✓") + " Created eslint.config.mjs");
  } else {
    // No config at all — create fresh
    const rulesLines = Object.entries(STACKRULES_RULES)
      .map(([rule, severity]) => `      "${rule}": "${severity}",`)
      .join("\n");

    const freshConfig = `import stackrules from "eslint-plugin-stackrules";

export default [
  {
    plugins: {
      stackrules,
    },
    rules: {
${rulesLines}
    },
  },
  { ignores: ["node_modules/", ".next/", "dist/", "build/"] },
];
`;
    await fs.writeFile(path.join(targetDir, "eslint.config.mjs"), freshConfig);
    console.log(chalk.green("  ✓") + " Created eslint.config.mjs");
  }

  // ── 4. Create .stackrules.json (org config) ────────
  const stackrulesConfigPath = path.join(targetDir, ".stackrules.json");
  if (!(await fs.pathExists(stackrulesConfigPath))) {
    await fs.writeJson(stackrulesConfigPath, STACKRULES_CONFIG, { spaces: 2 });
    console.log(chalk.green("  ✓") + " Created .stackrules.json");
  }

  // ── 5. Add lint script ────────────────────────────
  const pkgPath = path.join(targetDir, "package.json");
  if (await fs.pathExists(pkgPath)) {
    const pkg = await fs.readJson(pkgPath);
    if (!pkg.scripts) pkg.scripts = {};
    let changed = false;
    if (!pkg.scripts.lint) {
      pkg.scripts.lint = "eslint .";
      changed = true;
    }
    if (!pkg.scripts["lint:fix"]) {
      pkg.scripts["lint:fix"] = "eslint . --fix";
      changed = true;
    }
    if (changed) {
      await fs.writeJson(pkgPath, pkg, { spaces: 2 });
      console.log(chalk.green("  ✓") + " Added lint scripts to package.json");
    }
  }

  // ── Done ──────────────────────────────────────────
  console.log(chalk.bold.green("\n  StackRules injected! Zero config needed.\n"));
  console.log("  Run " + chalk.cyan("npx eslint .") + " to see all violations.");
  console.log(
    "  Run " +
      chalk.cyan("npx create-stackrules clean") +
      " to generate an AI cleanup prompt.\n"
  );
}

module.exports = injectCommand;
