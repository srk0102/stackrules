"use strict";

module.exports = {
  plugins: ["stackrules"],
  rules: {
    "stackrules/no-eslint-disable": "error",
    "stackrules/no-service-in-components": "error",
    // Legacy individual rules — kept for granular overrides, off by default
    // since no-service-in-components covers all of these:
    "stackrules/no-supabase-in-components": "off",
    "stackrules/no-stripe-outside-services": "off",
    "stackrules/no-resend-outside-services": "off",
    "stackrules/no-fetch-in-components": "off",
    "stackrules/services-must-log": "error",
    "stackrules/no-raw-sql": "error",
    "stackrules/no-business-logic-in-components": "warn",
    "stackrules/no-side-effects-in-utils": "error",
    "stackrules/no-duplicate-utils": "warn",
    "stackrules/no-duplicate-logic": "warn",
    "stackrules/no-inline-component": "warn",
    "stackrules/prefer-shadcn": "warn",
    "stackrules/page-complexity": "warn",
    "stackrules/code-quality": "warn",
  },
};
