import { useState } from "react";
import Modal from "../components/Modal.tsx";

export type HouseholdMemberView = {
  userId: string;
  displayName: string;
  role: "owner" | "member";
  status: "active" | "pending";
  joinedAt?: string | null;
};

type HouseholdScreenProps = {
  householdName: string;
  inviteCode: string;
  currentUserId: string;
  isOwner: boolean;
  members: HouseholdMemberView[];
  isLoading?: boolean;
  error?: string | null;
  onBack: () => void;
  onCopyCode: () => Promise<boolean> | boolean;
  onRename: (name: string) => Promise<void> | void;
  onRegenerateCode: () => Promise<void> | void;
  onRemoveMember: (userId: string) => Promise<void> | void;
  onLeave: () => Promise<void> | void;
};

function formatJoined(value?: string | null): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function HouseholdScreen({
  householdName,
  inviteCode,
  currentUserId,
  isOwner,
  members,
  isLoading = false,
  error,
  onBack,
  onCopyCode,
  onRename,
  onRegenerateCode,
  onRemoveMember,
  onLeave,
}: HouseholdScreenProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(householdName);
  const [codeVisible, setCodeVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);

  const memberToRemove = members.find(
    (member) => member.userId === confirmRemoveId,
  );
  const otherOwners = members.filter(
    (member) =>
      member.role === "owner" &&
      member.userId !== currentUserId &&
      member.status === "active",
  );

  async function handleCopy() {
    const success = await onCopyCode();
    if (success) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === householdName) {
      setIsRenaming(false);
      return;
    }
    setBusy(true);
    try {
      await onRename(trimmed);
      setIsRenaming(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!confirmRemoveId) return;
    setBusy(true);
    try {
      await onRemoveMember(confirmRemoveId);
      setConfirmRemoveId(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    setBusy(true);
    try {
      await onLeave();
      setConfirmLeave(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-warm-brown mb-6 hover:opacity-70 transition-opacity"
      >
        ← Back
      </button>

      <div className="mb-6">
        <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-1">
          your pack
        </p>
        {isRenaming ? (
          <form onSubmit={handleRename} className="flex gap-2">
            <label htmlFor="household-name" className="sr-only">
              Household name
            </label>
            <input
              id="household-name"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              maxLength={60}
              className="flex-1 rounded-xl border border-warm-brown/20 bg-white px-4 py-2.5 text-lg font-semibold text-warm-brown focus:outline-none focus:border-warm-brown"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-warm-brown px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftName(householdName);
                setIsRenaming(false);
              }}
              className="rounded-xl border border-warm-brown/20 px-4 py-2.5 text-sm font-medium text-warm-brown"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold font-fraunces text-warm-brown">
              {householdName}
            </h1>
            {isOwner && (
              <button
                type="button"
                onClick={() => setIsRenaming(true)}
                className="text-xs font-semibold text-warm-brown underline underline-offset-2 hover:opacity-70"
              >
                Rename
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </div>
      )}

      <section className="mb-6 rounded-3xl border border-warm-brown/10 bg-white p-5">
        <h2 className="mb-1 text-lg font-bold font-fraunces text-warm-brown">
          Invite code
        </h2>
        <p className="mb-4 text-xs text-text-muted">
          Anyone with this code can join your household. Treat it like a
          password.
        </p>

        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-xl bg-light-tan px-4 py-3 text-center text-lg font-bold tracking-[0.25em] text-warm-brown">
            {codeVisible ? inviteCode : "••••••"}
          </code>
          <button
            type="button"
            onClick={() => setCodeVisible((visible) => !visible)}
            className="rounded-xl border border-warm-brown/20 px-3 py-3 text-xs font-semibold text-warm-brown hover:bg-light-tan"
          >
            {codeVisible ? "Hide" : "Show"}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-xl bg-warm-brown px-3 py-3 text-xs font-semibold text-white hover:opacity-90"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        {isOwner && (
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "Generate a new invite code? The old code will stop working.",
                )
              ) {
                void onRegenerateCode();
              }
            }}
            disabled={isLoading}
            className="mt-3 text-xs font-medium text-warm-brown underline underline-offset-2 hover:opacity-70 disabled:opacity-50"
          >
            Generate a new code
          </button>
        )}
      </section>

      <section className="mb-6 rounded-3xl border border-warm-brown/10 bg-white p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-bold font-fraunces text-warm-brown">
            Members
          </h2>
          <span className="text-xs text-text-muted">
            {members.length} {members.length === 1 ? "person" : "people"}
          </span>
        </div>

        <ul className="divide-y divide-warm-brown/10">
          {members.map((member) => {
            const isYou = member.userId === currentUserId;
            return (
              <li
                key={member.userId}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-dark">
                    {member.displayName || "Household member"}
                    {isYou && (
                      <span className="ml-1 text-xs font-normal text-text-muted">
                        (you)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-text-muted">
                    {member.role === "owner" ? "Owner" : "Member"}
                    {member.joinedAt
                      ? ` · joined ${formatJoined(member.joinedAt)}`
                      : ""}
                  </p>
                </div>

                {isOwner && !isYou && (
                  <button
                    type="button"
                    onClick={() => setConfirmRemoveId(member.userId)}
                    className="shrink-0 text-xs font-medium text-rose-500 hover:text-rose-700"
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
        <h2 className="mb-1 text-sm font-bold text-rose-800">
          Leave household
        </h2>
        {isOwner ? (
          <p className="text-xs text-rose-700 leading-relaxed">
            You are the owner. {otherOwners.length === 0
              ? "Ask support to transfer ownership before leaving."
              : "Transfer ownership before leaving."}
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-rose-700 leading-relaxed">
              You will lose access to this household's dogs and history.
            </p>
            <button
              type="button"
              onClick={() => setConfirmLeave(true)}
              className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              Leave household
            </button>
          </>
        )}
      </section>

      {confirmRemoveId && memberToRemove && (
        <Modal
          title={`Remove ${memberToRemove.displayName || "this member"}?`}
          description="They will lose access to this household immediately."
          onClose={() => setConfirmRemoveId(null)}
          size="sm"
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmRemoveId(null)}
                className="flex-1 rounded-xl border border-warm-brown/20 py-2.5 text-sm font-medium text-warm-brown"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={busy}
                className="flex-1 rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
              >
                {busy ? "Removing…" : "Remove"}
              </button>
            </div>
          }
        >
          <p className="text-sm text-text-muted">
            Their past log entries will stay in the household history.
          </p>
        </Modal>
      )}

      {confirmLeave && (
        <Modal
          title="Leave this household?"
          description="This cannot be undone from your account."
          onClose={() => setConfirmLeave(false)}
          size="sm"
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                className="flex-1 rounded-xl border border-warm-brown/20 py-2.5 text-sm font-medium text-warm-brown"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={handleLeave}
                disabled={busy}
                className="flex-1 rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
              >
                {busy ? "Leaving…" : "Leave"}
              </button>
            </div>
          }
        >
          <p className="text-sm text-text-muted">
            You can rejoin later with a new invite code from the owner.
          </p>
        </Modal>
      )}
    </div>
  );
}
