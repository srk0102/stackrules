"use strict";

const noEslintDisable = require("./rules/no-eslint-disable");
const noSupabaseInComponents = require("./rules/no-supabase-in-components");
const noStripeOutsideServices = require("./rules/no-stripe-outside-services");
const noResendOutsideServices = require("./rules/no-resend-outside-services");
const noFetchInComponents = require("./rules/no-fetch-in-components");
const servicesMustLog = require("./rules/services-must-log");
const noRawSql = require("./rules/no-raw-sql");
const noBusinessLogicInComponents = require("./rules/no-business-logic-in-components");
const noSideEffectsInUtils = require("./rules/no-side-effects-in-utils");
const noDuplicateUtils = require("./rules/no-duplicate-utils");
const noDuplicateLogic = require("./rules/no-duplicate-logic");
const noInlineComponent = require("./rules/no-inline-component");
const preferShadcn = require("./rules/prefer-shadcn");
const noServiceInComponents = require("./rules/no-service-in-components");
const pageComplexity = require("./rules/page-complexity");
const codeQuality = require("./rules/code-quality");
const recommended = require("./configs/recommended");

const plugin = {
  meta: {
    name: "eslint-plugin-stackrules",
    version: "0.1.0",
  },
  rules: {
    "no-eslint-disable": noEslintDisable,
    "no-supabase-in-components": noSupabaseInComponents,
    "no-stripe-outside-services": noStripeOutsideServices,
    "no-resend-outside-services": noResendOutsideServices,
    "no-fetch-in-components": noFetchInComponents,
    "services-must-log": servicesMustLog,
    "no-raw-sql": noRawSql,
    "no-business-logic-in-components": noBusinessLogicInComponents,
    "no-side-effects-in-utils": noSideEffectsInUtils,
    "no-duplicate-utils": noDuplicateUtils,
    "no-duplicate-logic": noDuplicateLogic,
    "no-inline-component": noInlineComponent,
    "prefer-shadcn": preferShadcn,
    "no-service-in-components": noServiceInComponents,
    "page-complexity": pageComplexity,
    "code-quality": codeQuality,
  },
  configs: {
    recommended,
  },
};

// Flat config support (ESLint 9+)
plugin.configs["flat/recommended"] = {
  plugins: {
    stackrules: plugin,
  },
  rules: recommended.rules,
};

module.exports = plugin;
