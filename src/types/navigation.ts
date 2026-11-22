/**
 * App screen identifiers.
 *
 * Kept in a standalone module so the history helper and the app shell do not
 * need to import App.tsx (which would create a cycle).
 */
export type Screen =
  | "home"
  | "logEvent"
  | "addDog"
  | "dogProfile"
  | "household"
  | "pricing"
  | "legal"
  | "account"
  | "profile"
  | "weeklyReport"
  | "schedules"
  | "insights";

export const SCREENS: readonly Screen[] = [
  "home",
  "logEvent",
  "addDog",
  "dogProfile",
  "household",
  "pricing",
  "legal",
  "account",
  "profile",
  "weeklyReport",
  "schedules",
  "insights",
];

export function isScreen(value: unknown): value is Screen {
  return (
    typeof value === "string" &&
    (SCREENS as readonly string[]).includes(value)
  );
}

export type ScreenHistoryState = {
  loggi: true;
  screen: Screen;
  index: number;
};

export function createScreenHistoryState(
  screen: Screen,
  index: number,
): ScreenHistoryState {
  return { loggi: true, screen, index };
}

/** Parse a `history.state` value defensively; unknown shapes are ignored. */
export function readScreenHistoryState(
  value: unknown,
): ScreenHistoryState | null {
  if (typeof value !== "object" || value === null) return null;

  const candidate = value as {
    loggi?: unknown;
    screen?: unknown;
    index?: unknown;
  };

  if (
    candidate.loggi !== true ||
    !isScreen(candidate.screen) ||
    typeof candidate.index !== "number" ||
    !Number.isInteger(candidate.index) ||
    candidate.index < 0
  ) {
    return null;
  }

  return {
    loggi: true,
    screen: candidate.screen,
    index: candidate.index,
  };
}
