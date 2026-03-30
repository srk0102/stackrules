#!/usr/bin/env node
"use strict";

const { Command } = require("commander");
const initCommand = require("./commands/init");
const injectCommand = require("./commands/inject");
const cleanCommand = require("./commands/clean");

const program = new Command();

program
  .name("create-stackrules")
  .description(
    "CLI tool to scaffold and enforce StackRules architecture in your project"
  )
  .version("0.1.0");

program
  .command("init")
  .description("Create a new project with correct folder structure and all rules configured")
  .option("-d, --dir <directory>", "Target directory", ".")
  .option("--no-git", "Skip git initialization")
  .action(initCommand);

program
  .command("inject")
  .description("Install StackRules on an existing project with zero configuration")
  .option("-d, --dir <directory>", "Target directory", ".")
  .action(injectCommand);

program
  .command("clean")
  .description("Scan codebase for violations and generate a cleanup prompt for AI")
  .option("-d, --dir <directory>", "Target directory", ".")
  .option("-o, --output <file>", "Output file for cleanup prompt", "stackrules-cleanup.md")
  .action(cleanCommand);

program.parse();
