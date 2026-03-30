import { useState } from "react";
import { supabase } from "../lib/supabase.ts";
import type { Household } from "../types/core.ts";

type HouseholdSetupScreenProps = {
  userIdInDB: string;
  onHouseholdReady: (household: Household) => void;
};

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function HouseholdSetupScreen(props: HouseholdSetupScreenProps) {
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const newHousehold: Household = {
      id: crypto.randomUUID(),
      name: householdName,
      inviteCode: generateInviteCode(),
      createdBy: props.userIdInDB,
    };

    const { error: householdError } = await supabase
      .from("Household")
      .insert(newHousehold);

    if (householdError) {
      setError("Failed to create household. Please try again.");
      setIsSubmitting(false);
      return;
    }

    const { error: memberError } = await supabase
      .from("HouseholdMember")
      .insert({
        householdId: newHousehold.id,
        userId: props.userIdInDB,
        role: "owner",
        status: "active",
      });

    if (memberError) {
      setError("Failed to create membership. Please try again.");
      setIsSubmitting(false);
      return;
    }

    props.onHouseholdReady(newHousehold);
  }

  async function handleJoin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const { data, error: lookupError } = await supabase
      .from("Household")
      .select()
      .eq("inviteCode", inviteCode.toUpperCase())
      .single();

    if (lookupError || !data) {
      setError("Invite code not found. Please check and try again.");
      setIsSubmitting(false);
      return;
    }

    const { error: memberError } = await supabase
      .from("HouseholdMember")
      .insert({
        householdId: data.id,
        userId: props.userIdInDB,
        role: "member",
        status: "active",
      });

    if (memberError) {
      setError("Failed to join household. Please try again.");
      setIsSubmitting(false);
      return;
    }

    props.onHouseholdReady(data as Household);
  }

  if (mode === "choose") {
    return (
      <div style={{ paddingTop: "2rem" }}>
        <div className="mb-8">
          <p className="text-xs font-medium tracking-widest uppercase text-text-muted mb-1">
            getting started
          </p>
          <h1 className="text-4xl font-bold font-fraunces text-warm-brown">
            Your Pack
          </h1>
          <p className="text-sm text-text-muted mt-2">
            Set up a household to track your dogs together.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => setMode("create")}
            className="w-full py-4 rounded-2xl text-sm font-semibold bg-warm-brown text-white hover:opacity-90 transition-opacity"
          >
            Create a new household
          </button>
          <button
            onClick={() => setMode("join")}
            className="w-full py-4 rounded-2xl text-sm font-semibold text-warm-brown border border-warm-brown/20 hover:bg-light-tan transition-colors"
          >
            Join an existing household
          </button>
        </div>
      </div>
    );
  }

  if (mode === "create") {
    return (
      <div style={{ paddingTop: "2rem" }}>
        <div className="mb-8">
          <p className="text-xs font-medium tracking-widest uppercase text-text-muted mb-1">
            new household
          </p>
          <h1 className="text-4xl font-bold font-fraunces text-warm-brown">
            Create your pack
          </h1>
        </div>

        <form onSubmit={handleCreate}>
          <div className="mb-6">
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              Household name
            </label>
            <input
              type="text"
              placeholder="e.g. The Murphy Family"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-warm-brown/20 bg-cream text-text-dark focus:outline-none focus:border-warm-brown"
              style={{ fontFamily: "DM Sans, sans-serif" }}
            />
          </div>

          {error && <p className="text-sm text-rose-600 mb-4">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl text-sm font-semibold bg-warm-brown text-white disabled:opacity-40"
          >
            {isSubmitting ? "Creating..." : "Create household"}
          </button>

          <button
            type="button"
            onClick={() => setMode("choose")}
            className="w-full mt-3 py-3 rounded-xl text-sm font-medium text-text-muted"
          >
            Back
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: "2rem" }}>
      <div className="mb-8">
        <p className="text-xs font-medium tracking-widest uppercase text-text-muted mb-1">
          join household
        </p>
        <h1 className="text-4xl font-bold font-fraunces text-warm-brown">
          Join your pack
        </h1>
      </div>

      <form onSubmit={handleJoin}>
        <div className="mb-6">
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
            Invite code
          </label>
          <input
            type="text"
            placeholder="e.g. X7K2NP"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            required
            maxLength={6}
            className="w-full px-4 py-3 rounded-xl border border-warm-brown/20 bg-cream text-text-dark focus:outline-none focus:border-warm-brown uppercase tracking-widest text-center text-lg font-bold"
            style={{ fontFamily: "DM Sans, sans-serif" }}
          />
        </div>

        {error && <p className="text-sm text-rose-600 mb-4">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-xl text-sm font-semibold bg-warm-brown text-white disabled:opacity-40"
        >
          {isSubmitting ? "Joining..." : "Join household"}
        </button>

        <button
          type="button"
          onClick={() => setMode("choose")}
          className="w-full mt-3 py-3 rounded-xl text-sm font-medium text-text-muted"
        >
          Back
        </button>
      </form>
    </div>
  );
}
