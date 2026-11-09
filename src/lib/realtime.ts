import { supabase } from "./supabase.ts";

/**
 * Subscribe to household care data changes.
 *
 * RLS is enforced by Supabase Realtime, so the server only delivers rows the
 * signed-in user is allowed to see. The callback is intentionally simple: the
 * app should refetch its household snapshot rather than trying to merge every
 * change event locally.
 *
 * Returns an unsubscribe function.
 */
export function subscribeToHouseholdChanges(
  onChange: () => void,
): () => void {
  const channel = supabase
    .channel(`household-data-${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "DogEvent" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "WeightLog" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "CareSchedule" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "CareTaskCompletion" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "EventReaction" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "EventComment" },
      onChange,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
