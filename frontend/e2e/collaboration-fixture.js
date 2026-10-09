import { execFileSync } from "node:child_process";
import path from "node:path";

export function claimPendingInvitation(email, name) {
  const python = process.env.E2E_PYTHON || path.resolve("../../../.venv/Scripts/python.exe");
  const script = path.resolve("e2e/claim-pending-invitation.py");
  const backend = path.resolve("../backend");
  const output = execFileSync(
    python,
    [script, "--email", email, "--name", name],
    {
      cwd: backend,
      encoding: "utf8",
      env: {
        ...process.env,
        PYTHONPATH: [backend, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
        DATABASE_URL: process.env.E2E_DATABASE_URL
          || process.env.DATABASE_URL
          || "postgresql+asyncpg://synapse:synapse@127.0.0.1:5432/synapse",
      },
    },
  );
  return JSON.parse(output.trim());
}
