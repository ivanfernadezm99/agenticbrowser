import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { lstat, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SANDBOX = await mkdtemp(join(tmpdir(), "ego-stop-safety-"));
process.env.XDG_STATE_HOME = join(SANDBOX, "state");
process.env.EGO_LINUX_PROFILE = join(SANDBOX, "profile");

const { BROWSER_STATE_FILE, STATE_DIR } = await import("../src/paths.mjs");
const { browserStatus, stopBrowser } = await import("../src/chrome.mjs");

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

test("stopBrowser ignores stale state pointing at an unrelated pid and port", async () => {
  let requests = 0;
  const server = createServer((_request, response) => {
    requests += 1;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        webSocketDebuggerUrl: `ws://127.0.0.1:${server.address().port}/foreign`,
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const foreign = spawn(process.execPath, ["-e", "setTimeout(()=>{},60000)"], {
    stdio: "ignore",
  });
  await new Promise((resolve, reject) => {
    foreign.once("spawn", resolve);
    foreign.once("error", reject);
  });

  try {
    await mkdir(STATE_DIR, { recursive: true });
    await writeFile(
      BROWSER_STATE_FILE,
      JSON.stringify({ port: server.address().port, pid: foreign.pid }),
    );

    assert.equal((await browserStatus()).running, false);
    assert.equal(await stopBrowser(), false);
    assert.equal(requests, 0, "an unowned endpoint is never contacted");
    assert.equal(alive(foreign.pid), true, "an unowned pid is never signalled");
  } finally {
    foreign.kill("SIGKILL");
    await new Promise((resolve) => server.close(resolve));
    await rm(SANDBOX, { recursive: true, force: true });
  }
});

test("stopBrowser leaves no profile guard behind a launch that died", async () => {
  const profile = process.env.EGO_LINUX_PROFILE;
  await mkdir(profile, { recursive: true });
  // A launch that died between writing its guard and opening DevTools leaves
  // exactly these, still naming a pid the kernel has already forgotten.
  const departed = spawn(process.execPath, ["-e", "process.exit(0)"], {
    stdio: "ignore",
  });
  await new Promise((resolve) => departed.once("exit", resolve));

  const artifacts = ["SingletonLock", "SingletonSocket", "SingletonCookie"];
  for (const name of artifacts) {
    await symlink(`test-host-${departed.pid}`, join(profile, name));
  }
  await rm(BROWSER_STATE_FILE, { force: true });

  assert.equal(await stopBrowser(), false, "nothing was running");

  for (const name of artifacts) {
    // lstat, not access: these are symlinks to a pid, and a dangling link is
    // exactly what a stale guard looks like.
    await assert.rejects(
      lstat(join(profile, name)),
      { code: "ENOENT" },
      `${name} survived --stop, and the CLI had already claimed it cleared it`,
    );
  }

  await rm(SANDBOX, { recursive: true, force: true });
});
