import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { execFile } from "node:child_process";
import { createConnection } from "node:net";

// Integration tests for the canonical host redirect. These spin up a real
// Next.js development server and assert on the actual initial HTTP response
// (redirects are NOT followed). They intentionally do not search source code
// strings to claim runtime behaviour. `curl` is used instead of Node `fetch`
// because this vitest/Node combination rejects cross-realm AbortSignals.
//
// Reliability notes:
//   - Next.js dev compiles routes lazily on first request, so a cold server can
//     take tens of seconds to answer the first HTTP request. Each test
//     therefore opts into a generous timeout, and `waitForReady` performs an
//     actual HTTP readiness request rather than merely checking TCP connect.
//   - Port 3337 is fixed so all tests target the same spawned server. A
//     pre-flight check fails fast if the port is already in use instead of
//     hanging on a failed bind.
//   - `afterAll` always terminates the spawned Next.js process, so no orphan
//     dev server is left behind when the suite passes, fails, or aborts.
const PORT = 3337;
const BASE = `http://localhost:${PORT}`;
const NEXT_BIN = require.resolve("next/dist/bin/next");
const TEST_TIMEOUT = 120_000; // ms: accommodates cold Next.js dev compilation
let nextProc: ChildProcess | null = null;
let spawnOut = "";
let spawnErr = "";

function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ host: "127.0.0.1", port }, () => {
      sock.destroy();
      resolve(true);
    });
    sock.on("error", () => resolve(false));
    sock.setTimeout(2000, () => {
      sock.destroy();
      resolve(false);
    });
  });
}

function spawnNextDev() {
  nextProc = spawn(
    process.execPath,
    [NEXT_BIN, "dev", "-p", String(PORT)],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PORT: String(PORT),
        NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder-anon-key",
      },
    }
  );
  nextProc.stdout?.on("data", (d) => {
    spawnOut += d.toString();
  });
  nextProc.stderr?.on("data", (d) => {
    spawnErr += d.toString();
  });
}

interface CurlRes {
  statusCode: number;
  headers: Record<string, string>;
  raw: string;
}

function curl(path: string, host: string, maxTime = 15): Promise<CurlRes> {
  return new Promise((resolve, reject) => {
    const proc = execFile(
      "curl",
      ["-s", "-i", "--max-time", String(maxTime), "-H", `Host: ${host}`, `${BASE}${path}`],
      { encoding: "utf8", timeout: (maxTime + 2) * 1000 },
      (err: Error | null, stdout: string, stderr: string) => {
        if (err) {
          reject(err);
          return;
        }
        const raw = stdout;
        const sep = raw.search(/\r?\n\r?\n/);
        const head = sep === -1 ? raw : raw.slice(0, sep);
        const lines = head.split(/\r?\n/);
        const statusLine = lines[0] || "";
        const m = statusLine.match(/HTTP\/[\d.]+ (\d+)/);
        const statusCode = m ? Number(m[1]) : 0;
        const headers: Record<string, string> = {};
        for (let i = 1; i < lines.length; i++) {
          const idx = lines[i].indexOf(":");
          if (idx === -1) continue;
          const key = lines[i].slice(0, idx).trim().toLowerCase();
          const val = lines[i].slice(idx + 1).trim();
          headers[key] = val;
        }
        resolve({ statusCode, headers, raw });
      }
    );
    proc.on("error", reject);
  });
}

async function waitForReady(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    if (nextProc?.exitCode != null && nextProc.exitCode !== 0) {
      throw new Error(
        `Next.js dev server exited early with code ${nextProc.exitCode}\nSTDOUT:\n${spawnOut}\nSTDERR:\n${spawnErr}`
      );
    }
    try {
      // Actual HTTP readiness: the server must answer an HTTP request.
      // Next.js dev compiles routes lazily, so a plain TCP connect is not
      // sufficient proof the server can serve responses.
      const res = await curl("/", "www.scholars.com.ng", 60);
      // Any HTTP response means Next.js is accepting and serving requests.
      void res;
      return;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `Next.js dev server did not become ready: ${lastError}\nSTDOUT:\n${spawnOut}\nSTDERR:\n${spawnErr}`
  );
}

// Issues a request against the apex host with redirect following disabled so
// the initial 308 and its Location header can be asserted directly.
function apex(path: string) {
  return curl(path, "scholars.com.ng", 15);
}

describe("canonical host redirect (integration)", () => {
  beforeAll(async () => {
    if (await portInUse(PORT)) {
      throw new Error(`Port ${PORT} is already in use; cannot start Next.js dev server`);
    }
    spawnNextDev();
    await waitForReady();
  }, 150_000);

  afterAll(() => {
    if (nextProc && !nextProc.killed) nextProc.kill("SIGTERM");
  });

  it("redirects apex homepage to www homepage with 308", async () => {
    const res = await apex("/");
    expect(res.statusCode).toBe(308);
    expect(res.headers.location).toMatch(/^https:\/\/www\.scholars\.com\.ng\/?$/);
  }, TEST_TIMEOUT);

  it("redirects apex /resources to www /resources with 308", async () => {
    const res = await apex("/resources");
    expect(res.statusCode).toBe(308);
    expect(res.headers.location).toBe("https://www.scholars.com.ng/resources");
  }, TEST_TIMEOUT);

  it("redirects apex sitemap.xml to www sitemap.xml", async () => {
    const res = await apex("/sitemap.xml");
    expect(res.statusCode).toBe(308);
    expect(res.headers.location).toBe("https://www.scholars.com.ng/sitemap.xml");
  }, TEST_TIMEOUT);

  it("redirects apex robots.txt to www robots.txt", async () => {
    const res = await apex("/robots.txt");
    expect(res.statusCode).toBe(308);
    expect(res.headers.location).toBe("https://www.scholars.com.ng/robots.txt");
  }, TEST_TIMEOUT);

  it("redirects apex legal page to matching www page", async () => {
    const res = await apex("/legal/terms");
    expect(res.statusCode).toBe(308);
    expect(res.headers.location).toBe("https://www.scholars.com.ng/legal/terms");
  }, TEST_TIMEOUT);

  it("redirects apex resource article to matching www article", async () => {
    const res = await apex("/resources/how-to-find-legitimate-scholarships");
    expect(res.statusCode).toBe(308);
    expect(res.headers.location).toBe(
      "https://www.scholars.com.ng/resources/how-to-find-legitimate-scholarships"
    );
  }, TEST_TIMEOUT);

  it("redirects apex resource category to matching www category", async () => {
    const res = await apex("/resources/category/scholarship-applications");
    expect(res.statusCode).toBe(308);
    expect(res.headers.location).toBe(
      "https://www.scholars.com.ng/resources/category/scholarship-applications"
    );
  }, TEST_TIMEOUT);

  it("redirects an unknown apex route to the matching www URL", async () => {
    const res = await apex("/does-not-exist");
    expect(res.statusCode).toBe(308);
    expect(res.headers.location).toBe("https://www.scholars.com.ng/does-not-exist");
  }, TEST_TIMEOUT);

  it("preserves query parameters on the apex redirect", async () => {
    const res = await apex("/resources?utm_source=a&ref=abc");
    expect(res.statusCode).toBe(308);
    expect(res.headers.location).toBe("https://www.scholars.com.ng/resources?utm_source=a&ref=abc");
  }, TEST_TIMEOUT);

  it("does not redirect the www hostname (no apex redirect applied)", async () => {
    const res = await curl("/about", "www.scholars.com.ng", 30);
    expect(res.statusCode).not.toBe(308);
    expect(res.headers.location).toBeUndefined();
  }, TEST_TIMEOUT);
});
