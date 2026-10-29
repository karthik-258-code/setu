import type { RecommendationMode } from "@setu/engine";
import type { StringKey } from "../i18n/strings";

/** The UI string naming each recommendation mode. */
export const MODE_LABEL: Record<RecommendationMode, StringKey> = {
  readiness: "modeReadiness",
  learn: "modeLearn",
  solve: "modeSolve",
  test: "modeTest",
  recheck: "modeRecheck",
  verify: "modeVerify",
  extension: "modeExtension",
  done: "modeDone",
};
