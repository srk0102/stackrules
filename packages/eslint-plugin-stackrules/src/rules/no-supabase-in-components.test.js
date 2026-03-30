"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const { RuleTester } = require("eslint");
const rule = require("./no-supabase-in-components");

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2020, sourceType: "module" },
});

describe("no-supabase-in-components", () => {
  it("should pass valid and catch invalid cases", () => {
    ruleTester.run("no-supabase-in-components", rule, {
      valid: [
        {
          code: 'import { supabase } from "@/lib/supabase";',
          filename: "/project/src/services/users.ts",
        },
        {
          code: 'import React from "react";',
          filename: "/project/src/components/Button.tsx",
        },
      ],
      invalid: [
        {
          code: 'import { supabase } from "@/lib/supabase";',
          filename: "/project/src/components/UserList.tsx",
          errors: [{ messageId: "noSupabaseInComponents" }],
        },
        {
          code: 'import { createClient } from "@supabase/supabase-js";',
          filename: "/project/src/app/page.tsx",
          errors: [{ messageId: "noSupabaseInComponents" }],
        },
        {
          code: 'import { supabase } from "@/lib/supabase";',
          filename: "/project/src/pages/index.tsx",
          errors: [{ messageId: "noSupabaseInComponents" }],
        },
      ],
    });
  });
});
