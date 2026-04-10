import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const frontendDir = path.join(rootDir, "apps", "frontend");
const backendDir = path.join(rootDir, "apps", "backend");
const viteBin = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");
const backendEntry = path.join(backendDir, "src", "server.js");
const backendHealthUrl = "http://127.0.0.1:3001/api/health";

if (!existsSync(viteBin)) {
  console.error("Dependencies are not installed. Run `npm install` at the workspace root first.");
  process.exit(1);
}

if (!existsSync(backendEntry)) {
  console.error("Backend entrypoint is missing at apps/backend/src/server.js.");
  process.exit(1);
}

const children = new Set();
let shuttingDown = false;

const terminateChild = (child) => {
  if (!child || child.killed) return;

  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });

    killer.on("error", () => {
      child.kill("SIGTERM");
    });
    return;
  }

  child.kill("SIGTERM");
};

const shutdown = (exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    terminateChild(child);
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 250);
};

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const startProcess = (label, args, cwd) => {
  const child = spawn(process.execPath, args, {
    cwd,
    stdio: "inherit",
  });

  children.add(child);

  child.on("exit", (code, signal) => {
    children.delete(child);
    if (shuttingDown) return;

    if (signal) {
      console.error(`${label} stopped with signal ${signal}`);
      shutdown(1);
      return;
    }

    if (code !== 0) {
      console.error(`${label} exited with code ${code}`);
      shutdown(code ?? 1);
      return;
    }

    if (children.size === 0) {
      shutdown(0);
    }
  });

  child.on("error", (error) => {
    console.error(`Failed to start ${label}:`, error.message);
    shutdown(1);
  });

  return child;
};

const backendProcess = startProcess("backend", ["--watch", backendEntry], backendDir);

const waitForBackend = async () => {
  const maxAttempts = 60; // 30 seconds with 500ms intervals
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (!children.has(backendProcess)) {
      throw new Error("Backend process exited before it became ready.");
    }

    try {
      const response = await fetch(backendHealthUrl);
      if (response.ok) {
        console.log("Backend is ready.");
        return;
      }
    } catch {
      // The backend is still starting.
    }

    if (attempt % 10 === 0 && attempt > 0) {
      console.log(`Waiting for backend... (${attempt * 0.5}s elapsed)`);
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting for the backend API to start after ${maxAttempts * 0.5}s.`);
};

try {
  await waitForBackend();
  startProcess("frontend", [viteBin], frontendDir);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Failed to start the app.");
  shutdown(1);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
