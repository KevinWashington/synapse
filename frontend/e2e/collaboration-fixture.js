import { execFileSync } from "node:child_process";
import path from "node:path";

export function claimPendingInvitation(email, name) {
  const python = process.env.E2E_PYTHON || path.resolve("../../../.venv/Scripts/python.exe");
  const script = path.resolve("e2e/claim-pending-invitation.py");
  const backend = path.resolve("../backend");
  const output = execFileSync(
    python,
    [script, "--email", email, "--name", name],
    { cwd: backend, encoding: "utf8", env: process.env },
  );
  return JSON.parse(output.trim());
}
