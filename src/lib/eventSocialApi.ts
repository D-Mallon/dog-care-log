import { supabase } from "./supabase.ts";
import type { EventComment, EventReaction } from "../types/core.ts";

export async function listEventSocial(
  eventIds: string[],
): Promise<{ reactions: EventReaction[]; comments: EventComment[] }> {
  if (eventIds.length === 0) return { reactions: [], comments: [] };

  const [reactionsResult, commentsResult] = await Promise.all([
    supabase.from("EventReaction").select("*").in("eventId", eventIds),
    supabase
      .from("EventComment")
      .select("*")
      .in("eventId", eventIds)
      .order("createdAt", { ascending: true }),
  ]);

  if (reactionsResult.error) throw reactionsResult.error;
  if (commentsResult.error) throw commentsResult.error;

  return {
    reactions: (reactionsResult.data ?? []) as EventReaction[],
    comments: (commentsResult.data ?? []) as EventComment[],
  };
}

export async function toggleReaction(
  eventId: string,
  userId: string,
  emoji: string,
  active: boolean,
): Promise<void> {
  if (active) {
    // Reactions are immutable rows. A plain insert avoids requiring UPDATE
    // privileges (which the RLS model deliberately does not grant). A duplicate
    // means the user already reacted, so treat it as success.
    const { error } = await supabase.from("EventReaction").insert({
      eventId,
      userId,
      emoji,
      createdAt: new Date().toISOString(),
    });
    if (error && error.code !== "23505") throw error;
    return;
  }

  const { error } = await supabase
    .from("EventReaction")
    .delete()
    .eq("eventId", eventId)
    .eq("userId", userId)
    .eq("emoji", emoji);
  if (error) throw error;
}

export async function addComment(
  eventId: string,
  userId: string,
  body: string,
): Promise<EventComment> {
  const comment: EventComment = {
    id: crypto.randomUUID(),
    eventId,
    userId,
    body: body.trim(),
    createdAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("EventComment")
    .insert(comment)
    .select()
    .single();

  if (error) throw error;
  return data as EventComment;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from("EventComment")
    .delete()
    .eq("id", commentId);
  if (error) throw error;
}
