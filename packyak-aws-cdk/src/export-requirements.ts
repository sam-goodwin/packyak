import * as fs from "fs";
import { execSync } from "child_process";
import * as path from "path";
import type { PythonPoetryArgs } from "./python-poetry";

export function exportRequirementsSync(
  dir: string,
  options?: PythonPoetryArgs,
): string {
  const requirements = path.join(dir, "requirements.txt");
  const command = [
    "poetry export -f requirements.txt",
    arg("with", options?.include),
    arg("without", options?.exclude),
    arg("without-urls", options?.withoutUrls),
    arg("without-hashes", options?.withoutHashes ?? true),
    arg("dev", options?.dev),
    arg("all-extras", options?.allExtras),
    `> ${requirements}`,
  ];

  fs.mkdirSync(dir, { recursive: true });
  execSync(command.join(" "));
  return requirements;

  function arg<T extends string[] | string | boolean | number>(
    flag: string,
    value: T | undefined,
  ) {
    if (value === undefined) {
      return "";
    } else if (typeof value === "boolean") {
      return value ? ` --${flag}` : "";
    } else {
      return ` --${flag}=${Array.isArray(value) ? value.join(",") : value}`;
    }
  }
}
