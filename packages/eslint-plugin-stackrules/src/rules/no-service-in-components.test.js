"use strict";

const { describe, it } = require("node:test");
const { RuleTester } = require("eslint");
const rule = require("./no-service-in-components");

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2020, sourceType: "module" },
});

describe("no-service-in-components", () => {
  it("should catch ANY service import in components, not just specific ones", () => {
    ruleTester.run("no-service-in-components", rule, {
      valid: [
        // Services in services/ — always OK
        {
          code: 'import { supabase } from "@/lib/supabase";',
          filename: "/project/src/services/users.ts",
        },
        // Stripe in services/ — OK
        {
          code: 'import Stripe from "stripe";',
          filename: "/project/src/services/payment.ts",
        },
        // React import in component — OK (not a service)
        {
          code: 'import React from "react";',
          filename: "/project/src/components/Button.tsx",
        },
        // Lib files can import services (they initialize them)
        {
          code: 'import { createClient } from "@supabase/supabase-js";',
          filename: "/project/src/lib/supabase.ts",
        },
      ],
      invalid: [
        // Supabase in component
        {
          code: 'import { supabase } from "@/lib/supabase";',
          filename: "/project/src/components/UserList.tsx",
          errors: [{ messageId: "noServiceInComponent" }],
        },
        // Stripe in app/ page
        {
          code: 'import Stripe from "stripe";',
          filename: "/project/src/app/checkout/page.tsx",
          errors: [{ messageId: "noServiceInComponent" }],
        },
        // Firebase in component
        {
          code: 'import { getFirestore } from "firebase/firestore";',
          filename: "/project/src/components/Chat.tsx",
          errors: [{ messageId: "noServiceInComponent" }],
        },
        // Mongoose in page
        {
          code: 'import mongoose from "mongoose";',
          filename: "/project/src/pages/users.tsx",
          errors: [{ messageId: "noServiceInComponent" }],
        },
        // OpenAI in component
        {
          code: 'import OpenAI from "openai";',
          filename: "/project/src/components/AIChat.tsx",
          errors: [{ messageId: "noServiceInComponent" }],
        },
        // axios in component — caught as "http" category service
        {
          code: 'import axios from "axios";',
          filename: "/project/src/components/DataLoader.tsx",
          errors: [{ messageId: "noServiceInComponent" }],
        },
        // fetch() in component
        {
          code: 'const data = fetch("/api/users");',
          filename: "/project/src/app/dashboard/page.tsx",
          errors: [{ messageId: "noFetchInComponent" }],
        },
        // AWS SDK in hooks (also forbidden)
        {
          code: 'import { S3Client } from "@aws-sdk/client-s3";',
          filename: "/project/src/hooks/useUpload.ts",
          errors: [{ messageId: "noServiceInComponent" }],
        },
      ],
    });
  });
});
