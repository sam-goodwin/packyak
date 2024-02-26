#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import semver from "semver";
import { argv } from "process";

let bumpType = "patch"; // default to minor if not specified

function inc(version) {
  return semver.inc(version, bumpType);
}

const args = argv.slice(2); // remove the first two default args

for (const arg of args) {
  const validBumpTypes = ["major", "minor", "patch"];
  const argBumpType = arg.replace("--", "");
  if (validBumpTypes.includes(argBumpType)) {
    if (bumpType !== "minor" && bumpType !== "major" && bumpType !== "patch") {
      throw new Error("Cannot specify multiple bump types.");
    }
    bumpType = argBumpType;
  }
}

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(__dirname, "..");

if (process.env.BUMP_ROOT) {
  const rootPackage = JSON.parse(
    await fs.readFile(path.join(root, "package.json"), "utf-8"),
  );
  rootPackage.version = inc(rootPackage.version);

  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify(rootPackage, null, 2),
  );

  const packyakTomlPath = path.join(root, "pyproject.toml");
  const packyakToml = await fs.readFile(packyakTomlPath, "utf-8");

  const versionRegex =
    /\[tool\.poetry\]\nname\s*=\s*"packyak"\nversion\s*=\s*"\d+\.\d+\.\d+"/;
  const updatedPackyakToml = packyakToml.replace(
    versionRegex,
    `[tool.poetry]\nname = "packyak"\nversion = "${rootPackage.version}"`,
  );
  await fs.writeFile(packyakTomlPath, updatedPackyakToml);
}

if (process.env.BUMP_CDK) {
  const awsCDK = path.join(root, "packyak-aws-cdk");

  const awsCDKPackage = JSON.parse(
    await fs.readFile(path.join(awsCDK, "package.json"), "utf-8"),
  );
  awsCDKPackage.version = inc(awsCDKPackage.version);
  await fs.writeFile(
    path.join(awsCDK, "package.json"),
    JSON.stringify(awsCDKPackage, null, 2),
  );
}
