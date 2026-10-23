import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * A visible launch needs a session to draw on.
 *
 * An agent shell that did not inherit the graphical login has no DISPLAY, and
 * Chrome answers by exiting — no window, no DevTools endpoint, nothing on
 * stdout. The launch used to learn that only after waiting out its endpoint
 * timeout, then report a port that never answered.
 */
const SANDBOX = await mkdtemp(join(tmpdir(), "ego-headed-guard-"));
process.env.XDG_STATE_HOME = join(SANDBOX, "state");
process.env.XDG_DATA_HOME = join(SANDBOX, "data");
process.env.EGO_LINUX_PROFILE = join(SANDBOX, "profile");
delete process.env.DISPLAY;
delete process.env.WAYLAND_DISPLAY;
delete process.env.EGO_LINUX_WINDOW_BACKEND;

const { headedDisplayBlocker } = await import("../src/platform.mjs");
const { ensureBrowser } = await import("../src/chrome.mjs");

test("a headless launch needs no display", () => {
  assert.equal(headedDisplayBlocker({ headless: true }), null);
});

test("a display on either stack satisfies a visible launch", () => {
  assert.equal(
    headedDisplayBlocker({ headless: false, env: { DISPLAY: ":0" } }),
    null,
  );
  assert.equal(
    headedDisplayBlocker({
      headless: false,
      env: { WAYLAND_DISPLAY: "wayland-0" },
    }),
    null,
  );
});

test("no display is named before the wait, not after it", async () => {
  const started = Date.now();
  await assert.rejects(
    ensureBrowser({ headless: false }),
    /DISPLAY and WAYLAND_DISPLAY are both unset/,
  );
  assert.ok(
    Date.now() - started < 5000,
    "the launch failed, but only after waiting out the endpoint timeout",
  );
});

test.after(async () => {
  await rm(SANDBOX, { recursive: true, force: true });
});
