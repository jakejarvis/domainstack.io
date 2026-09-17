#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, chmod, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDirectory = path.join(root, "apps/web");
const developmentEnvPath = path.join(webDirectory, ".env.development.local");
const localEnvPath = path.join(webDirectory, ".env.local");
const stateDirectory = path.join(root, ".tmp");
const nativeDataDirectory = path.join(stateDirectory, "postgres");
const nativeLogPath = path.join(stateDirectory, "postgres.log");
const composeProject = `domainstack-${createHash("sha256").update(root).digest("hex").slice(0, 12)}`;
const command = process.argv[2] ?? "prepare";
const postgresPort = 54329;
const generatedDatabaseUrl = `postgresql://domainstack:domainstack@127.0.0.1:${postgresPort}/domainstack`;

const defaults = {
  BETTER_AUTH_SECRET: () => randomBytes(32).toString("base64url"),
  NEXT_PUBLIC_BASE_URL: () => "http://localhost:3000",
  NEXT_PUBLIC_GITHUB_OAUTH_ENABLED: () => "false",
  NEXT_PUBLIC_GITLAB_OAUTH_ENABLED: () => "false",
  NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED: () => "false",
  NEXT_PUBLIC_VERCEL_OAUTH_ENABLED: () => "false",
};

function log(message) {
  process.stdout.write(`[domainstack] ${message}\n`);
}

function fail(message) {
  throw new Error(message);
}

async function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  return parseEnv(await readFile(filePath, "utf8"));
}

async function loadEnvironment() {
  const local = await readEnvFile(localEnvPath);
  const development = await readEnvFile(developmentEnvPath);
  return { ...local, ...development, ...process.env };
}

async function ensureDevelopmentDefaults(extraDefaults = {}, developmentOverrides = []) {
  const environment = await loadEnvironment();
  const development = await readEnvFile(developmentEnvPath);
  const missing = Object.entries({ ...defaults, ...extraDefaults }).filter(
    ([key]) =>
      environment[key] === undefined ||
      (developmentOverrides.includes(key) && development[key] === undefined),
  );
  if (missing.length === 0) return;

  await mkdir(webDirectory, { recursive: true });
  const prefix = existsSync(developmentEnvPath) ? "\n" : "";
  const lines = missing.map(([key, value]) => `${key}=${value()}`);
  await appendFile(
    developmentEnvPath,
    `${prefix}# Generated development defaults (safe to edit)\n${lines.join("\n")}\n`,
    { mode: 0o600 },
  );
  await chmod(developmentEnvPath, 0o600);
  log(`added ${missing.length} missing development default(s)`);
}

function backendFor(environment) {
  const backend = environment.LOCAL_BACKEND ?? "docker";
  if (!["docker", "native", "external"].includes(backend)) {
    fail("LOCAL_BACKEND must be docker, native, or external");
  }
  return backend;
}

function run(program, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, {
      cwd: root,
      env: options.env ?? process.env,
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => (stdout += chunk));
    child.stderr?.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve(stdout.trim());
      else {
        const detail = stderr.trim() || `exited with ${code ?? signal}`;
        reject(new Error(`${program} ${args[0] ?? ""}: ${detail}`));
      }
    });
  });
}

async function commandExists(program) {
  try {
    await run("sh", ["-c", 'command -v "$1"', "sh", program], { capture: true });
    return true;
  } catch {
    return false;
  }
}

function composeArgs(...args) {
  return ["compose", "-p", composeProject, "-f", path.join(root, "compose.yaml"), ...args];
}

async function startDocker(environment) {
  if (!(await dockerComposeAvailable())) {
    fail("Docker with the Compose plugin is required for the docker database backend");
  }
  log("starting checkout-local PostgreSQL 18 with Docker");
  await run("docker", composeArgs("up", "-d", "--wait", "postgres"), { env: environment });
  return `postgresql://domainstack:domainstack@127.0.0.1:${postgresPort}/domainstack`;
}

async function postgresBinary(name) {
  if (await commandExists(name)) return name;
  if (await commandExists("pg_config")) {
    const binDirectory = await run("pg_config", ["--bindir"], { capture: true });
    const candidate = path.join(binDirectory, name);
    if (existsSync(candidate)) return candidate;
  }
  fail(`PostgreSQL server tool '${name}' is unavailable; install PostgreSQL or use Docker`);
}

async function nativeStatus(pgCtl) {
  if (!existsSync(path.join(nativeDataDirectory, "PG_VERSION"))) return false;
  try {
    await run(pgCtl, ["-D", nativeDataDirectory, "status"], { capture: true });
    return true;
  } catch {
    return false;
  }
}

async function startNative(environment) {
  const pgCtl = await postgresBinary("pg_ctl");
  const initdb = await postgresBinary("initdb");
  const createdb = await postgresBinary("createdb");
  await mkdir(stateDirectory, { recursive: true });

  if (!existsSync(path.join(nativeDataDirectory, "PG_VERSION"))) {
    log("initializing checkout-local native PostgreSQL");
    await run(initdb, ["-D", nativeDataDirectory, "-A", "trust", "-U", "domainstack"]);
  }

  if (!(await nativeStatus(pgCtl))) {
    log("starting checkout-local native PostgreSQL");
    await run(
      pgCtl,
      [
        "-D",
        nativeDataDirectory,
        "-l",
        nativeLogPath,
        "-o",
        `-h 127.0.0.1 -p ${postgresPort}`,
        "start",
        "-w",
      ],
      { env: environment },
    );
  }

  try {
    await run(
      createdb,
      ["-h", "127.0.0.1", "-p", String(postgresPort), "-U", "domainstack", "domainstack"],
      { capture: true, env: { ...environment, LC_ALL: "C" } },
    );
  } catch (error) {
    if (!String(error.message).includes("already exists")) throw error;
  }
  return `postgresql://domainstack:domainstack@127.0.0.1:${postgresPort}/domainstack`;
}

async function environmentWithDatabase(environment) {
  const backend = backendFor(environment);
  if (backend === "external") {
    if (!environment.DATABASE_URL) fail("DATABASE_URL is required in external database mode");
    if (environment.DATABASE_URL === generatedDatabaseUrl) {
      fail(
        "external database mode requires an explicit DATABASE_URL, not the generated checkout-local URL",
      );
    }
    return { environment, backend };
  }
  const databaseUrl =
    backend === "docker" ? await startDocker(environment) : await startNative(environment);
  return { environment: { ...environment, DATABASE_URL: databaseUrl }, backend };
}

async function runDatabasePrimitive(name, environment) {
  await run("pnpm", ["--filter", "@domainstack/db", "run", name], { env: environment });
}

async function stopDatabase(environment) {
  const backend = backendFor(environment);
  if (backend === "external") {
    log("external PostgreSQL is not managed by Domainstack");
    return;
  }
  if (backend === "docker") {
    await run("docker", composeArgs("stop", "postgres"), { env: environment });
    return;
  }
  const pgCtl = await postgresBinary("pg_ctl");
  if (await nativeStatus(pgCtl)) {
    await run(pgCtl, ["-D", nativeDataDirectory, "stop", "-m", "fast", "-w"]);
  }
}

async function resetDatabase(environment) {
  const backend = backendFor(environment);
  if (backend === "external") fail("db:reset is disabled in external database mode");
  if (backend === "docker") {
    await run("docker", composeArgs("down", "--volumes", "--remove-orphans"), { env: environment });
  } else {
    await stopDatabase(environment);
    const resolved = path.resolve(nativeDataDirectory);
    if (!resolved.startsWith(`${path.resolve(stateDirectory)}${path.sep}`)) {
      fail("refusing to reset a native database outside the checkout state directory");
    }
    await rm(nativeDataDirectory, { recursive: true, force: true });
    await rm(nativeLogPath, { force: true });
  }
  log(`reset the current checkout's ${backend} database`);
}

async function doctor(environment) {
  const backend = backendFor(environment);
  log(`database backend: ${backend}`);
  if (backend === "docker") {
    log(`Docker Compose: ${(await dockerComposeAvailable()) ? "available" : "unavailable"}`);
  }
  if (backend === "native") {
    const available = await nativePostgresAvailable();
    log(`native PostgreSQL server tools: ${available ? "available" : "unavailable"}`);
  }
  if (backend === "external") {
    log(`external DATABASE_URL: ${environment.DATABASE_URL ? "configured" : "unavailable"}`);
  }

  const integrations = {
    OAuth: ["GITHUB_CLIENT_ID", "GITLAB_CLIENT_ID", "GOOGLE_CLIENT_ID", "VERCEL_CLIENT_ID"],
    Redis: ["UPSTASH_REDIS_REST_URL"],
    Polar: ["POLAR_ACCESS_TOKEN"],
    Blob: ["BLOB_READ_WRITE_TOKEN"],
    Email: ["RESEND_API_KEY"],
    Analytics: ["NEXT_PUBLIC_POSTHOG_KEY", "POSTHOG_API_KEY"],
    "Edge Config": ["EDGE_CONFIG"],
    AI: ["AI_GATEWAY_API_KEY", "OPENAI_API_KEY"],
  };
  for (const [name, keys] of Object.entries(integrations)) {
    log(
      `${name}: ${keys.some((key) => environment[key]) ? "configured" : "unavailable (optional)"}`,
    );
  }
}

async function dockerComposeAvailable() {
  try {
    await run("docker", ["compose", "version"], { capture: true });
    return true;
  } catch {
    return false;
  }
}

async function nativePostgresAvailable() {
  try {
    await Promise.all([postgresBinary("pg_ctl"), postgresBinary("initdb"), postgresBinary("createdb")]);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const initialEnvironment = await loadEnvironment();
  const initialBackend = command === "cloud-prepare" ? "native" : backendFor(initialEnvironment);
  const developmentDefaults = {
    ...(command === "cloud-prepare" ? { LOCAL_BACKEND: () => "native" } : {}),
    ...(initialBackend === "external"
      ? {}
      : {
          DATABASE_URL: () => generatedDatabaseUrl,
        }),
  };
  await ensureDevelopmentDefaults(developmentDefaults, Object.keys(developmentDefaults));
  const environment = await loadEnvironment();

  if (command === "doctor") return doctor(environment);
  if (command === "db:stop") return stopDatabase(environment);
  if (command === "db:reset") return resetDatabase(environment);
  if (command === "cloud-prepare") return;

  const { environment: databaseEnvironment } = await environmentWithDatabase(environment);
  if (command === "db:start") return log("database is ready");
  if (["db:generate", "db:migrate", "db:push", "db:studio"].includes(command)) {
    return runDatabasePrimitive(command, databaseEnvironment);
  }
  if (!["prepare", "dev"].includes(command)) fail(`unknown development command: ${command}`);

  log("applying database migrations");
  await runDatabasePrimitive("db:migrate", databaseEnvironment);
  if (command === "dev") {
    return run("pnpm", ["exec", "turbo", "run", "dev"], { env: databaseEnvironment });
  }
}

main().catch((error) => {
  process.stderr.write(`[domainstack] ${error.message}\n`);
  process.exitCode = 1;
});
