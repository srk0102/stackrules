"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const { RuleTester } = require("eslint");
const rule = require("./services-must-log");

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2020, sourceType: "module" },
});

describe("services-must-log", () => {
  it("should pass valid and catch invalid cases", () => {
    ruleTester.run("services-must-log", rule, {
      valid: [
        {
          code: 'import { logger } from "@/lib/logger";\nlogger.info("test");',
          filename: "/project/src/services/users.ts",
        },
        {
          code: "const x = 1;",
          filename: "/project/src/utils/format.ts",
        },
        {
          code: 'import { createLogger } from "@/lib/logger";\nconst logger = createLogger("test");\nlogger.info("hi");',
          filename: "/project/src/services/payment.ts",
        },
      ],
      invalid: [
        {
          code: 'import { supabase } from "@/lib/supabase";\nconst data = supabase.from("users").select();',
          filename: "/project/src/services/users.ts",
          errors: [{ messageId: "servicesMustImportLogger" }],
        },
        {
          code: 'import { logger } from "@/lib/logger";\nconst x = 1;',
          filename: "/project/src/services/users.ts",
          errors: [{ messageId: "servicesMustUseLogger" }],
        },
      ],
    });
  });
});
