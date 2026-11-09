import type { EventComment, EventReaction } from "../types/core.ts";

/**
 * The emoji palette offered on every care event. Keep this small and fixed:
 * reactions are a lightweight acknowledgement, not a general chat.
 */
export const REACTION_EMOJIS = ["❤️", "👍", "😂", "🎉", "👏"] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** Short comments only — event-anchored notes, not a message thread. */
export const MAX_COMMENT_LENGTH = 500;

export interface ReactionGroup {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  userIds: string[];
}

/**
 * Group raw reaction rows by emoji for display.
 *
 * Rows are deduplicated per (emoji, user) so duplicate or optimistic rows never
 * inflate the count. Known emojis keep palette order; anything else is appended
 * alphabetically so the UI stays stable across renders.
 */
export function groupReactions(
  reactions: EventReaction[],
  currentUserId: string,
): ReactionGroup[] {
  const byEmoji = new Map<string, Set<string>>();

  for (const reaction of reactions) {
    if (!reaction.emoji || !reaction.userId) continue;
    const existing = byEmoji.get(reaction.emoji);
    if (existing) {
      existing.add(reaction.userId);
    } else {
      byEmoji.set(reaction.emoji, new Set([reaction.userId]));
    }
  }

  const paletteOrder = new Map<string, number>(
    REACTION_EMOJIS.map((emoji, index) => [emoji, index]),
  );

  return [...byEmoji.entries()]
    .sort(([emojiA], [emojiB]) => {
      const orderA = paletteOrder.get(emojiA);
      const orderB = paletteOrder.get(emojiB);
      if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
      if (orderA !== undefined) return -1;
      if (orderB !== undefined) return 1;
      return emojiA.localeCompare(emojiB);
    })
    .map(([emoji, userIds]) => ({
      emoji,
      count: userIds.size,
      reactedByMe: userIds.has(currentUserId),
      userIds: [...userIds].sort(),
    }));
}

/** Comments are always shown oldest first, like a short note trail. */
export function groupComments(comments: EventComment[]): EventComment[] {
  return [...comments].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

/** Authors can remove their own comments; household owners can moderate any. */
export function canDeleteComment(
  comment: EventComment,
  currentUserId: string,
  isOwner: boolean,
): boolean {
  if (isOwner) return true;
  return Boolean(currentUserId) && comment.userId === currentUserId;
}

/** A comment must have visible text and fit the short-comment limit. */
export function isCommentBodySubmittable(body: string): boolean {
  const trimmed = body.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_COMMENT_LENGTH;
}
