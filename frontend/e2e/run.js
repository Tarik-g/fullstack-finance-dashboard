import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const venvPython = path.join(
  root,
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const python =
  process.env.E2E_PYTHON || (existsSync(venvPython) ? venvPython : "python");
const child = spawn(
  python,
  [path.join(root, "tests/e2e/run.py"), ...process.argv.slice(2)],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, E2E_PYTHON: python },
  },
);
child.on("error", (error) => {
  console.error(`Could not start the E2E runner: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
