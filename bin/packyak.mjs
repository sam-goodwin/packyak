#!/usr/bin/env node

import path from "path";
import { promises as fs } from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const packyakConfig = (await fs.readdir(".")).find((file) =>
  file.match(/packyak\.config\.(js|ts)/)
);
if (!packyakConfig) {
  console.error("No packyak.(js|ts) file found in current directory");
  process.exit(1);
}

const ext = path.extname(packyakConfig);

const command = `pnpm tsx -e 'import("./packyak.config${ext}")'`;

try {
  const { stdout, stderr } = await execAsync(command);
  console.log("Output:", stdout);
  console.error("Error:", stderr);
} catch (error) {
  console.error("Execution error:", error);
  process.exit(1);
}
