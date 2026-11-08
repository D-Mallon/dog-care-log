import { useState } from "react";
import type { CareEvent, EventType } from "../types/core.ts";
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
  const [isAccident, setIsAccident] = useState(Boolean(event.isAccident));
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
        isAccident: type === "toilet" ? isAccident : false,
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
            <label className="flex items-end gap-2 pb-3 text-sm text-text-dark">
              <input
                type="checkbox"
                checked={isAccident}
                onChange={(inputEvent) =>
                  setIsAccident(inputEvent.target.checked)
                }
                className="h-4 w-4 rounded border-gray-300 text-warm-brown focus:ring-warm-brown"
              />
              Accident
            </label>
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
