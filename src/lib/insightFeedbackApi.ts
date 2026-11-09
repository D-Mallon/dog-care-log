import { supabase } from "./supabase.ts";
import type { HealthInsightKind } from "./healthBaseline.ts";

export type InsightFeedbackResponse = "normal" | "unusual" | "vet_visit";

export type InsightFeedbackInput = {
  dogId: string;
  householdId: string;
  insightKey: string;
  insightKind: HealthInsightKind;
  severity: "info" | "watch" | "attention";
  response: InsightFeedbackResponse;
  userId: string;
  note?: string;
};

/**
 * Record an owner-confirmed response to a baseline insight. These labels are
 * feedback for future model evaluation, not a diagnosis or treatment record.
 */
export async function recordInsightFeedback(
  input: InsightFeedbackInput,
): Promise<void> {
  const { error } = await supabase.from("InsightFeedback").insert({
    id: crypto.randomUUID(),
    dogId: input.dogId,
    householdId: input.householdId,
    insightKey: input.insightKey,
    insightKind: input.insightKind,
    severity: input.severity,
    response: input.response,
    note: input.note?.trim() || null,
    userId: input.userId,
    createdAt: new Date().toISOString(),
  });

  if (error) throw error;
}
