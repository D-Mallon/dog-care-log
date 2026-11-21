import { useCallback, useEffect, useRef } from "react";
import {
  createScreenHistoryState,
  readScreenHistoryState,
  type Screen,
} from "../types/navigation.ts";

export type ScreenHistory = {
  /** Navigate forward, pushing (or optionally replacing) a history entry. */
  navigate: (screen: Screen, options?: { replace?: boolean }) => void;
  /** Go back one in-app entry, or fall back to the supplied screen. */
  goBack: (fallback: Screen) => void;
  /** Reset the in-app history to home (sign-out, account switch). */
  reset: () => void;
};

/**
 * Minimal SPA history integration.
 *
 * The app deliberately does not use URL routes (the PWA has a single entry
 * point), but Android/browser back should move between app screens instead of
 * leaving the app. Each forward navigation pushes an entry containing the
 * screen and a monotonically increasing index; back/forward pop it.
 *
 * On mount the current entry is replaced with `home`, so a reload does not
 * restore a nested screen from a previous session.
 */
export function useScreenHistory(
  currentScreen: Screen,
  setCurrentScreen: (screen: Screen) => void,
): ScreenHistory {
  const indexRef = useRef(0);
  const screenRef = useRef(currentScreen);

  useEffect(() => {
    screenRef.current = currentScreen;
  }, [currentScreen]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    indexRef.current = 0;
    screenRef.current = "home";
    window.history.replaceState(createScreenHistoryState("home", 0), "");

    function handlePopState(event: PopStateEvent) {
      const state = readScreenHistoryState(event.state);
      if (!state) {
        indexRef.current = 0;
        screenRef.current = "home";
        setCurrentScreen("home");
        return;
      }

      indexRef.current = state.index;
      screenRef.current = state.screen;
      setCurrentScreen(state.screen);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setCurrentScreen]);

  const navigate = useCallback(
    (screen: Screen, options?: { replace?: boolean }) => {
      if (screen === screenRef.current && !options?.replace) return;
      if (typeof window === "undefined") {
        screenRef.current = screen;
        setCurrentScreen(screen);
        return;
      }

      if (options?.replace) {
        window.history.replaceState(
          createScreenHistoryState(screen, indexRef.current),
          "",
        );
        screenRef.current = screen;
        setCurrentScreen(screen);
        return;
      }

      const nextIndex = indexRef.current + 1;
      window.history.pushState(createScreenHistoryState(screen, nextIndex), "");
      indexRef.current = nextIndex;
      screenRef.current = screen;
      setCurrentScreen(screen);
    },
    [setCurrentScreen],
  );

  const goBack = useCallback(
    (fallback: Screen) => {
      if (indexRef.current > 0 && typeof window !== "undefined") {
        window.history.back();
        return;
      }
      navigate(fallback);
    },
    [navigate],
  );

  const reset = useCallback(() => {
    indexRef.current = 0;
    screenRef.current = "home";
    if (typeof window !== "undefined") {
      window.history.replaceState(createScreenHistoryState("home", 0), "");
    }
    setCurrentScreen("home");
  }, [setCurrentScreen]);

  return { navigate, goBack, reset };
}
