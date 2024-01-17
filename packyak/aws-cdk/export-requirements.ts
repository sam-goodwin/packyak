import fs from "fs";
import { execSync } from "child_process";
import type { PythonPoetryArgs } from "../generated/spec.js";

export function exportRequirementsSync(
  dir: string,
  options?: PythonPoetryArgs
) {
  const command = [
    "poetry export -f requirements.txt",
    arg("with", options?.with),
    arg("without", options?.without),
    arg("without-urls", options?.without_urls),
    arg("without-hashes", options?.without_hashes ?? true),
    arg("dev", options?.dev),
    arg("all-extras", options?.all_extras),
    `> ${dir}/requirements.txt`,
  ];

  fs.mkdirSync(dir, { recursive: true });
  execSync(command.join(" "));

  function arg<T extends string[] | string | boolean | number>(
    flag: string,
    value: T | undefined
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
