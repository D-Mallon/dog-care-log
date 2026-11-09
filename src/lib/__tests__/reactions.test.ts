import { describe, expect, it } from "vitest";
import type { EventComment, EventReaction } from "../../types/core.ts";
import {
  MAX_COMMENT_LENGTH,
  REACTION_EMOJIS,
  canDeleteComment,
  groupComments,
  groupReactions,
  isCommentBodySubmittable,
} from "../reactions.ts";

const ME = "user-me";
const PARTNER = "user-partner";

function reaction(userId: string, emoji: string): EventReaction {
  return { eventId: "event-1", userId, emoji };
}

function comment(
  id: string,
  userId: string,
  body: string,
  createdAt: string,
): EventComment {
  return { id, eventId: "event-1", userId, body, createdAt };
}

describe("groupReactions", () => {
  it("returns no groups for an event without reactions", () => {
    expect(groupReactions([], ME)).toEqual([]);
  });

  it("counts reactions per emoji and flags the current user's own", () => {
    const groups = groupReactions(
      [
        reaction(ME, "❤️"),
        reaction(PARTNER, "❤️"),
        reaction(PARTNER, "👍"),
      ],
      ME,
    );

    expect(groups).toHaveLength(2);

    const heart = groups.find((group) => group.emoji === "❤️");
    expect(heart).toEqual({
      emoji: "❤️",
      count: 2,
      reactedByMe: true,
      userIds: [ME, PARTNER].sort(),
    });

    const thumbs = groups.find((group) => group.emoji === "👍");
    expect(thumbs?.count).toBe(1);
    expect(thumbs?.reactedByMe).toBe(false);
  });

  it("deduplicates duplicate rows for the same user and emoji", () => {
    const groups = groupReactions(
      [reaction(ME, "😂"), reaction(ME, "😂"), reaction(ME, "😂")],
      ME,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(1);
    expect(groups[0].userIds).toEqual([ME]);
    expect(groups[0].reactedByMe).toBe(true);
  });

  it("keeps the palette order and appends unknown emojis last", () => {
    const groups = groupReactions(
      [
        reaction(ME, "🎉"),
        reaction(PARTNER, "woof"),
        reaction(ME, "👍"),
        reaction(PARTNER, "❤️"),
      ],
      ME,
    );

    expect(groups.map((group) => group.emoji)).toEqual([
      ...REACTION_EMOJIS.filter((emoji) =>
        ["❤️", "👍", "🎉"].includes(emoji),
      ),
      "woof",
    ]);
  });

  it("ignores malformed rows with no emoji or user", () => {
    const groups = groupReactions(
      [{ eventId: "event-1", userId: "", emoji: "❤️" }, reaction("", "")],
      ME,
    );

    expect(groups).toEqual([]);
  });
});

describe("groupComments", () => {
  it("sorts comments oldest first without mutating the input", () => {
    const comments = [
      comment("c2", PARTNER, "Newer", "2026-11-09T12:00:00.000Z"),
      comment("c1", ME, "Older", "2026-11-09T10:00:00.000Z"),
      comment("c3", PARTNER, "Newest", "2026-11-09T14:00:00.000Z"),
    ];
    const snapshot = [...comments];

    const sorted = groupComments(comments);

    expect(sorted.map((item) => item.id)).toEqual(["c1", "c2", "c3"]);
    expect(sorted).not.toBe(comments);
    expect(comments).toEqual(snapshot);
  });

  it("returns an empty list for no comments", () => {
    expect(groupComments([])).toEqual([]);
  });
});

describe("canDeleteComment", () => {
  const ownComment = comment("c1", ME, "Mine", "2026-11-09T10:00:00.000Z");
  const partnerComment = comment(
    "c2",
    PARTNER,
    "Theirs",
    "2026-11-09T10:05:00.000Z",
  );

  it("lets an author delete their own comment", () => {
    expect(canDeleteComment(ownComment, ME, false)).toBe(true);
  });

  it("lets a household owner moderate anyone's comment", () => {
    expect(canDeleteComment(partnerComment, ME, true)).toBe(true);
  });

  it("blocks a member from deleting someone else's comment", () => {
    expect(canDeleteComment(partnerComment, ME, false)).toBe(false);
  });

  it("does not treat a blank current user as the author", () => {
    const anonymousComment = comment("c3", "", "Ghost", "2026-11-09T10:10:00.000Z");
    expect(canDeleteComment(anonymousComment, "", false)).toBe(false);
  });
});

describe("isCommentBodySubmittable", () => {
  it("rejects empty or whitespace-only comments", () => {
    expect(isCommentBodySubmittable("")).toBe(false);
    expect(isCommentBodySubmittable("   \n\t ")).toBe(false);
  });

  it("accepts short text and trims surrounding whitespace", () => {
    expect(isCommentBodySubmittable("  Good walk!  ")).toBe(true);
  });

  it("enforces the 500 character limit", () => {
    expect(isCommentBodySubmittable("a".repeat(MAX_COMMENT_LENGTH))).toBe(true);
    expect(isCommentBodySubmittable("a".repeat(MAX_COMMENT_LENGTH + 1))).toBe(
      false,
    );
  });
});
