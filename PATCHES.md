# Local patches carried by this fork

This fork exists so the harness keeps working on a workstation where the agent
shell does not inherit the graphical session. Everything below is a defect fix
with a regression test; nothing here changes the agent-facing API, the CLI
surface, or the wire protocol.

Base: `opencue/agenticbrowser` @ `dc68f72`.

## 1. A visible launch with no display now says so

`src/platform.mjs` (`headedDisplayBlocker`), `src/chrome.mjs` (`launch`)

A process with no session to draw on — an agent shell started outside the
graphical login is the ordinary case — gets no DevTools endpoint at all. Chrome
exits with `Missing X server or $DISPLAY` and the launcher waits out its full
20 second timeout, then reports a port that never answered.

The launch now asks first and fails in about 300ms with the actual cause and
the three ways out (`DISPLAY=:0`, `EGO_LINUX_HEADLESS=1`, `--headless`).
Headless launches and explicit `EGO_LINUX_WINDOW_BACKEND=wayland` are
unaffected.

Test: `test/headed-launch-guard.test.mjs`

## 2. A failed launch keeps Chrome's own words

`src/paths.mjs` (`LAUNCH_LOG_FILE`), `src/chrome.mjs` (`launch`,
`launchLogHint`)

The child was spawned with `stdio: "ignore"`, so the only account of a failure
was discarded. A missing display, a crash loop and a damaged profile were
indistinguishable from the outside.

Chrome's stderr now goes to `<state>/ego-lite-linux/last-launch.log`, and a
launch that never reaches its endpoint appends the last 12 lines of that file
to the error it throws. The file is opened per launch, so it always describes
the attempt that just failed.

## 3. `--stop` clears the guard it claims to clear

`src/chrome.mjs` (`stopBrowser`)

When nothing owned the profile, `--stop` printed `profile lock cleared` and
returned before clearing anything. The three POSIX `Singleton*` links a dead
launch leaves behind — which is precisely what blocks the next launch — stayed
in place.

The no-owner branch now clears them, and still refuses to touch a lock whose
owner is alive but unrecognized: that one is not ours to remove.

Test: `test/browser-stop-safety.test.mjs`

## Updating from upstream

```sh
git fetch upstream
git rebase upstream/main local-fixes
```

The three patches touch `src/platform.mjs`, `src/paths.mjs` and
`src/chrome.mjs` only, so a conflict means upstream moved one of those
functions — resolve it against the tests, which state the intended behaviour.
