import { describe, expect, it } from "vitest";
import {
  createScreenHistoryState,
  isScreen,
  readScreenHistoryState,
} from "../../types/navigation.ts";

describe("navigation history state", () => {
  it("recognises known screens only", () => {
    expect(isScreen("home")).toBe(true);
    expect(isScreen("legal")).toBe(true);
    expect(isScreen("not-a-screen")).toBe(false);
    expect(isScreen(null)).toBe(false);
    expect(isScreen(42)).toBe(false);
  });

  it("round-trips a valid history entry", () => {
    const state = createScreenHistoryState("insights", 3);
    expect(state).toEqual({ loggi: true, screen: "insights", index: 3 });
    expect(readScreenHistoryState(state)).toEqual(state);
  });

  it("rejects foreign or malformed history state", () => {
    expect(readScreenHistoryState(null)).toBeNull();
    expect(readScreenHistoryState({ screen: "home", index: 1 })).toBeNull();
    expect(
      readScreenHistoryState({ loggi: true, screen: "home", index: -1 }),
    ).toBeNull();
    expect(
      readScreenHistoryState({ loggi: true, screen: "home", index: 1.5 }),
    ).toBeNull();
    expect(
      readScreenHistoryState({ loggi: true, screen: "bogus", index: 1 }),
    ).toBeNull();
  });
});
