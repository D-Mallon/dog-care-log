import { useId, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type {
  EventComment,
  EventReaction,
  HouseholdMember,
} from "../types/core.ts";
import {
  MAX_COMMENT_LENGTH,
  REACTION_EMOJIS,
  canDeleteComment,
  groupComments,
  groupReactions,
  isCommentBodySubmittable,
} from "../lib/reactions.ts";
import getTimeAgo from "../lib/utils.ts";

type EventReactionsProps = {
  eventId: string;
  reactions: EventReaction[];
  comments: EventComment[];
  currentUserId: string;
  members: HouseholdMember[];
  isOwner: boolean;
  onToggleReaction?: (eventId: string, emoji: string) => void;
  onAddComment?: (eventId: string, body: string) => void;
  onDeleteComment?: (commentId: string) => void;
};

const COLLAPSED_COMMENT_COUNT = 3;

export default function EventReactions({
  eventId,
  reactions,
  comments,
  currentUserId,
  members,
  isOwner,
  onToggleReaction,
  onAddComment,
  onDeleteComment,
}: EventReactionsProps) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const commentInputId = useId();

  const memberById = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );

  const reactionGroups = useMemo(
    () => groupReactions(reactions, currentUserId),
    [reactions, currentUserId],
  );

  const sortedComments = useMemo(() => groupComments(comments), [comments]);

  const displayNameFor = (userId: string): string => {
    if (userId === currentUserId) return "You";
    const member = memberById.get(userId);
    return member?.displayName?.trim() || "Household member";
  };

  const renderableEmojis = useMemo(() => {
    const known = new Set<string>(REACTION_EMOJIS);
    const extras = reactionGroups
      .map((group) => group.emoji)
      .filter((emoji) => !known.has(emoji));
    return [...REACTION_EMOJIS, ...extras];
  }, [reactionGroups]);

  const hiddenCommentCount = Math.max(
    0,
    sortedComments.length - COLLAPSED_COMMENT_COUNT,
  );
  const visibleComments =
    expanded || hiddenCommentCount === 0
      ? sortedComments
      : sortedComments.slice(-COLLAPSED_COMMENT_COUNT);

  const canSubmit = Boolean(onAddComment) && isCommentBodySubmittable(draft);
  const charactersRemaining = MAX_COMMENT_LENGTH - draft.length;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    onAddComment?.(eventId, draft.trim());
    setDraft("");
  };

  return (
    <section
      aria-label="Event reactions and comments"
      className="mt-2 space-y-2"
    >
      <div
        role="group"
        aria-label="Reactions"
        className="flex flex-wrap items-center gap-1.5"
      >
        {renderableEmojis.map((emoji) => {
          const group = reactionGroups.find((item) => item.emoji === emoji);
          const count = group?.count ?? 0;
          const reactedByMe = group?.reactedByMe ?? false;
          const reactedNames = group?.userIds.map(displayNameFor) ?? [];

          const label =
            count > 0
              ? `React with ${emoji}, ${count} ${
                  count === 1 ? "reaction" : "reactions"
                }${reactedByMe ? ", including yours" : ""}`
              : `React with ${emoji}`;

          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onToggleReaction?.(eventId, emoji)}
              disabled={!onToggleReaction}
              aria-label={label}
              aria-pressed={reactedByMe}
              title={count > 0 ? reactedNames.join(", ") : undefined}
              className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-brown/40 disabled:cursor-default ${
                reactedByMe
                  ? "border-warm-brown/40 bg-warm-brown/10 text-warm-brown"
                  : "border-light-tan bg-white text-text-muted hover:bg-cream"
              }`}
            >
              <span aria-hidden="true" className="text-sm leading-none">
                {emoji}
              </span>
              {count > 0 && (
                <span aria-hidden="true" className="tabular-nums">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {sortedComments.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Comments
            <span className="ml-1 font-normal normal-case tracking-normal">
              ({sortedComments.length})
            </span>
          </h3>
          {hiddenCommentCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              aria-controls={`${commentInputId}-comments`}
              aria-label={
                expanded
                  ? "Show fewer comments"
                  : `Show all ${sortedComments.length} comments`
              }
              className="rounded-lg px-1.5 py-1 text-[11px] font-medium text-warm-brown underline underline-offset-2 hover:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-brown/40"
            >
              {expanded
                ? "Show fewer"
                : `Show all ${sortedComments.length}`}
            </button>
          )}
        </div>
      )}

      {visibleComments.length > 0 && (
        <ul
          id={`${commentInputId}-comments`}
          aria-label="Comments"
          className="space-y-1.5"
        >
          {visibleComments.map((comment) => {
            const author = displayNameFor(comment.userId);
            const canDelete =
              Boolean(onDeleteComment) &&
              canDeleteComment(comment, currentUserId, isOwner);

            return (
              <li
                key={comment.id}
                className="rounded-lg bg-cream/60 px-2.5 py-1.5"
              >
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-xs font-semibold text-text-dark">
                    {author}
                  </span>
                  <time
                    dateTime={comment.createdAt}
                    title={new Date(comment.createdAt).toLocaleString()}
                    className="shrink-0 text-[10px] text-text-muted"
                  >
                    {getTimeAgo(comment.createdAt)}
                  </time>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => onDeleteComment?.(comment.id)}
                      aria-label={`Delete comment by ${author}`}
                      className="ml-auto inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-lg text-text-muted hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                    >
                      <span aria-hidden="true" className="text-xs">
                        ✕
                      </span>
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-snug text-text-dark">
                  {comment.body}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <label htmlFor={commentInputId} className="sr-only">
          Add a comment
        </label>
        <input
          id={commentInputId}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a comment…"
          maxLength={MAX_COMMENT_LENGTH}
          disabled={!onAddComment}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-light-tan bg-white px-2.5 py-1.5 text-xs text-text-dark placeholder:text-text-muted/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-brown/40 disabled:bg-light-tan/40"
        />
        <span
          aria-hidden="true"
          className="tabular-nums text-[10px] text-text-muted"
        >
          {draft.length > 0 ? `${draft.length}/${MAX_COMMENT_LENGTH}` : ""}
        </span>
        <span className="sr-only" aria-live="polite">
          {draft.length > 0 && charactersRemaining <= 50
            ? `${charactersRemaining} characters remaining`
            : ""}
        </span>
        <button
          type="submit"
          disabled={!canSubmit}
          className="shrink-0 rounded-lg bg-warm-brown px-2.5 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-brown/40 disabled:cursor-default disabled:bg-light-tan disabled:text-text-muted"
        >
          Post
        </button>
      </form>
    </section>
  );
}
