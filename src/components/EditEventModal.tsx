import { useState } from "react";
import type {
  CareEvent,
  EventType,
  PottyCue,
  PottyLocation,
  PottyOutcome,
} from "../types/core.ts";
import { supabase } from "../lib/supabase.ts";
import { EVENT_OPTIONS } from "../lib/eventMeta.ts";
import {
  fromDateTimeLocalValue,
  isFutureDateTime,
  toDateTimeLocalValue,
} from "../lib/dates.ts";
import Modal from "./Modal.tsx";

type EditEventModalProps = {
  event: CareEvent;
  onClose: () => void;
  onSaved: () => void;
};

type ToiletSubtype = "pee" | "poo" | "other" | "";

export default function EditEventModal({
  event,
  onClose,
  onSaved,
}: EditEventModalProps) {
  const [type, setType] = useState<EventType>(event.type);
  const [timestamp, setTimestamp] = useState(() =>
    toDateTimeLocalValue(new Date(event.timestamp)),
  );
  const [note, setNote] = useState(event.note ?? "");
  const [subtype, setSubtype] = useState<ToiletSubtype>(
    event.subtype ?? "",
  );
  const [pottyOutcome, setPottyOutcome] = useState<PottyOutcome>(
    event.pottyOutcome ?? (event.isAccident ? "accident" : "success"),
  );
  const [pottyLocation, setPottyLocation] = useState<PottyLocation | "">(
    event.pottyLocation ?? "",
  );
  const [pottyCue, setPottyCue] = useState<PottyCue | "">(
    event.pottyCue ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();

    const isoTimestamp = fromDateTimeLocalValue(timestamp);
    if (!isoTimestamp) {
      setError("Choose a valid date and time.");
      return;
    }
    if (isFutureDateTime(timestamp)) {
      setError("Events cannot be in the future.");
      return;
    }

    setIsSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("DogEvent")
      .update({
        type,
        timestamp: isoTimestamp,
        note: note.trim() || null,
        subtype: type === "toilet" && subtype ? subtype : null,
        isAccident: type === "toilet" && pottyOutcome === "accident",
        pottyOutcome: type === "toilet" ? pottyOutcome : null,
        pottyLocation: type === "toilet" ? pottyLocation || null : null,
        pottyCue: type === "toilet" ? pottyCue || null : null,
      })
      .eq("id", event.id);

    if (updateError) {
      console.error("Error updating event:", updateError);
      setError("Couldn't save that change. Please try again.");
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    onSaved();
    onClose();
  }

  return (
    <Modal
      title="Edit event"
      description="Correct the time, type or note for this care event."
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-warm-brown/20 py-2.5 text-sm font-medium text-warm-brown"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-event-form"
            disabled={isSaving}
            className="flex-1 rounded-xl bg-warm-brown py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save changes"}
          </button>
        </div>
      }
    >
      <form id="edit-event-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="edit-event-type"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted"
          >
            Type
          </label>
          <select
            id="edit-event-type"
            value={type}
            onChange={(selectEvent) =>
              setType(selectEvent.target.value as EventType)
            }
            className="w-full rounded-xl border border-warm-brown/20 bg-cream px-3 py-2.5 text-sm text-text-dark focus:outline-none focus:border-warm-brown"
          >
            {EVENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.emoji} {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="edit-event-time"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted"
          >
            When
          </label>
          <input
            id="edit-event-time"
            type="datetime-local"
            value={timestamp}
            max={toDateTimeLocalValue(new Date())}
            onChange={(inputEvent) => setTimestamp(inputEvent.target.value)}
            className="w-full rounded-xl border border-warm-brown/20 bg-cream px-3 py-2.5 text-sm text-text-dark focus:outline-none focus:border-warm-brown"
          />
        </div>

        {type === "toilet" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="edit-event-subtype"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted"
              >
                Toilet type
              </label>
              <select
                id="edit-event-subtype"
                value={subtype}
                onChange={(selectEvent) =>
                  setSubtype(selectEvent.target.value as ToiletSubtype)
                }
                className="w-full rounded-xl border border-warm-brown/20 bg-cream px-3 py-2.5 text-sm text-text-dark focus:outline-none focus:border-warm-brown"
              >
                <option value="">Not specified</option>
                <option value="pee">Pee</option>
                <option value="poo">Poo</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Outcome
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPottyOutcome("success")}
                    aria-pressed={pottyOutcome === "success"}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold ${
                      pottyOutcome === "success"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-warm-brown/20 text-text-dark"
                    }`}
                  >
                    ✅ Success
                  </button>
                  <button
                    type="button"
                    onClick={() => setPottyOutcome("accident")}
                    aria-pressed={pottyOutcome === "accident"}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold ${
                      pottyOutcome === "accident"
                        ? "border-rose-300 bg-rose-50 text-rose-800"
                        : "border-warm-brown/20 text-text-dark"
                    }`}
                  >
                    ⚠️ Accident
                  </button>
                </div>
              </div>
              <div>
                <label
                  htmlFor="edit-event-location"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted"
                >
                  Where
                </label>
                <select
                  id="edit-event-location"
                  value={pottyLocation}
                  onChange={(selectEvent) =>
                    setPottyLocation(
                      selectEvent.target.value as PottyLocation | "",
                    )
                  }
                  className="w-full rounded-lg border border-warm-brown/20 bg-cream px-2 py-2 text-xs text-text-dark"
                >
                  <option value="">Not specified</option>
                  <option value="outside">Outside</option>
                  <option value="garden">Garden</option>
                  <option value="pad">Puppy pad</option>
                  <option value="indoor">Indoors</option>
                  <option value="crate">Crate</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="edit-event-cue"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted"
                >
                  Cue
                </label>
                <select
                  id="edit-event-cue"
                  value={pottyCue}
                  onChange={(selectEvent) =>
                    setPottyCue(selectEvent.target.value as PottyCue | "")
                  }
                  className="w-full rounded-lg border border-warm-brown/20 bg-cream px-2 py-2 text-xs text-text-dark"
                >
                  <option value="">Not specified</option>
                  <option value="asked">Asked to go</option>
                  <option value="unprompted">Went unprompted</option>
                  <option value="none">No clear cue</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor="edit-event-note"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted"
          >
            Note
          </label>
          <textarea
            id="edit-event-note"
            rows={3}
            maxLength={500}
            value={note}
            onChange={(inputEvent) => setNote(inputEvent.target.value)}
            className="w-full resize-none rounded-xl border border-warm-brown/20 bg-cream px-3 py-2.5 text-sm text-text-dark focus:outline-none focus:border-warm-brown"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
