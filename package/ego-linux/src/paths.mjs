import { join } from "node:path";

import {
  APP_DIR,
  dataRoot,
  stateRoot,
  stockBrowserProfileDirs,
} from "./platform.mjs";

/** Persistent browser profile — the local stand-in for the ego lite app's profile. */
export const DATA_DIR = join(dataRoot(), APP_DIR);

/** Runtime state shared across heredoc invocations (each run is its own process). */
export const STATE_DIR = join(stateRoot(), APP_DIR);

export const PROFILE_DIR =
  process.env.EGO_LINUX_PROFILE || join(DATA_DIR, "profile");
export const BROWSER_STATE_FILE = join(STATE_DIR, "browser.json");
/** Chrome's own stderr for the most recent launch, kept to explain a failure. */
export const LAUNCH_LOG_FILE = join(STATE_DIR, "last-launch.log");
export const SPACES_STATE_FILE = join(STATE_DIR, "spaces-server.json");
export const TASK_SPACE_FILE = join(STATE_DIR, "task-spaces.json");
export const COLLABORATION_REQUEST_FILE = join(
  STATE_DIR,
  "collaboration-requests.json",
);

/** Where a stock Chrome keeps the profile we can import logins from. */
export const CHROME_CONFIG_CANDIDATES = stockBrowserProfileDirs();
