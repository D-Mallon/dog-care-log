import { useState } from "react";
import Modal from "../components/Modal.tsx";

type AccountScreenProps = {
  email: string;
  householdName: string;
  planLabel: string;
  isOwner: boolean;
  isEntitled: boolean;
  isDeleting: boolean;
  onExport: () => void;
  onDelete: () => Promise<boolean>;
  onBack: () => void;
};

export default function AccountScreen({
  email,
  householdName,
  planLabel,
  isOwner,
  isEntitled,
  isDeleting,
  onExport,
  onDelete,
  onBack,
}: AccountScreenProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const canDelete = confirmation === "DELETE" && !isDeleting;

  async function handleDelete() {
    if (!canDelete) return;
    setLocalError(null);
    const succeeded = await onDelete();
    if (succeeded) {
      setConfirmOpen(false);
      setConfirmation("");
    } else {
      setLocalError("Account deletion did not complete. Please try again.");
    }
  }

  return (
    <div className="pt-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 flex items-center gap-1.5 text-sm font-medium text-warm-brown transition-opacity hover:opacity-70"
      >
        ← Back
      </button>

      <div className="mb-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-text-muted">
          your account
        </p>
        <h1 className="text-4xl font-bold font-fraunces text-warm-brown">
          Account & data
        </h1>
      </div>

      <section className="mb-6 rounded-3xl border border-warm-brown/10 bg-white p-5">
        <h2 className="mb-3 text-lg font-bold font-fraunces text-warm-brown">
          Sign-in
        </h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Email</dt>
            <dd className="truncate font-medium text-text-dark">
              {email || "Not available"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Role</dt>
            <dd className="font-medium text-text-dark">
              {isOwner ? "Household owner" : "Household member"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Plan</dt>
            <dd className="font-medium text-text-dark">
              {isEntitled ? planLabel : "Free"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mb-6 rounded-3xl border border-warm-brown/10 bg-white p-5">
        <h2 className="mb-1 text-lg font-bold font-fraunces text-warm-brown">
          Export your data
        </h2>
        <p className="mb-4 text-xs leading-relaxed text-text-muted">
          Download every dog in {householdName}, with care events and weight
          history, as a CSV you can open in Excel or Numbers.
        </p>
        <button
          type="button"
          onClick={onExport}
          className="w-full rounded-xl border border-warm-brown/20 py-3 text-sm font-semibold text-warm-brown hover:bg-light-tan"
        >
          Download household CSV
        </button>
      </section>

      <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
        <h2 className="mb-1 text-lg font-bold font-fraunces text-rose-900">
          Delete account
        </h2>
        <p className="mb-4 text-xs leading-relaxed text-rose-800">
          {isOwner
            ? "As the owner, deleting your account also deletes this household, every dog, all care history and any subscription. Remove other members first."
            : "Your login and membership will be removed. The household's care history stays with the household."}
        </p>
        <button
          type="button"
          onClick={() => {
            setConfirmation("");
            setLocalError(null);
            setConfirmOpen(true);
          }}
          className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
        >
          Delete my account
        </button>
        {localError && (
          <p role="alert" className="mt-3 text-xs font-medium text-rose-800">
            {localError}
          </p>
        )}
      </section>

      {confirmOpen && (
        <Modal
          title="Delete your account?"
          description="This cannot be undone. Export your data first if you want a copy."
          onClose={() => {
            if (!isDeleting) setConfirmOpen(false);
          }}
          size="sm"
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-warm-brown/20 py-2.5 text-sm font-medium text-warm-brown disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={!canDelete}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
              >
                {isDeleting ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          }
        >
          <label
            htmlFor="delete-account-confirmation"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted"
          >
            Type DELETE to confirm
          </label>
          <input
            id="delete-account-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            className="w-full rounded-xl border border-warm-brown/20 bg-cream px-3 py-2.5 text-sm font-semibold tracking-widest text-text-dark focus:outline-none focus:border-warm-brown"
          />
        </Modal>
      )}
    </div>
  );
}
