"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const { RuleTester } = require("eslint");
const rule = require("./no-eslint-disable");

const ruleTester = new RuleTester();

describe("no-eslint-disable", () => {
  it("should pass valid and catch invalid cases", () => {
    ruleTester.run("no-eslint-disable", rule, {
      valid: [
        "const x = 1;",
        "// This is a normal comment",
        "/* Regular block comment */",
      ],
      invalid: [
        {
          // Use a block comment that ESLint won't interpret as a directive
          code: "const x = 1; /* eslint-disable-line no-unused-vars */",
          errors: [{ messageId: "noEslintDisable" }],
        },
      ],
    });
  });
});
