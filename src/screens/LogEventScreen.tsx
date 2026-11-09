import { useState } from "react";
import type {
  CareEvent,
  EventType,
  PottyCue,
  PottyLocation,
  PottyOutcome,
} from "../types/core.ts";
import { supabase } from "../lib/supabase.ts";
import {
  fromDateTimeLocalValue,
  isFutureDateTime,
  toDateTimeLocalValue,
} from "../lib/dates.ts";

type LogEventScreenProps = {
  selectedDogId: string | null;
  onSubmitEvent: (event: CareEvent) => void;
  userIdInDB: string;
};

const EVENT_OPTIONS: {
  value: EventType;
  label: string;
  emoji: string;
  colour: string;
  bg: string;
  border: string;
  text: string;
}[] = [
  {
    value: "feed",
    label: "Fed",
    emoji: "🍖",
    colour: "#92400e",
    bg: "#fef3c7",
    border: "#92400e",
    text: "#92400e",
  },
  {
    value: "walk",
    label: "Walked",
    emoji: "🦮",
    colour: "#065f46",
    bg: "#d1fae5",
    border: "#065f46",
    text: "#065f46",
  },
  {
    value: "toilet",
    label: "Toilet",
    emoji: "🌿",
    colour: "#78350f",
    bg: "#fef9c3",
    border: "#78350f",
    text: "#78350f",
  },
  {
    value: "meds",
    label: "Meds",
    emoji: "💊",
    colour: "#9f1239",
    bg: "#ffe4e6",
    border: "#9f1239",
    text: "#9f1239",
  },
  {
    value: "sick",
    label: "Sick",
    emoji: "🤒",
    colour: "#b91c1c",
    bg: "#fee2e2",
    border: "#b91c1c",
    text: "#b91c1c",
  },
  {
    value: "nap_time",
    label: "Nap Time",
    emoji: "😴",
    colour: "#4c0519",
    bg: "#fce7f3",
    border: "#4c0519",
    text: "#4c0519",
  },
  {
    value: "play_time",
    label: "Play Time",
    emoji: "🎾",
    colour: "#1d4ed8",
    bg: "#dbeafe",
    border: "#1d4ed8",
    text: "#1d4ed8",
  },
  {
    value: "water",
    label: "Water",
    emoji: "💧",
    colour: "#0e7490",
    bg: "#cffafe",
    border: "#0e7490",
    text: "#0e7490",
  },
  {
    value: "grooming",
    label: "Grooming",
    emoji: "✂️",
    colour: "#9a3412",
    bg: "#ffedd5",
    border: "#9a3412",
    text: "#9a3412",
  },
];

const labelClass =
  "block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2";

export default function LogEventScreen(props: LogEventScreenProps) {
  const [selectedDogId] = useState<string>(props.selectedDogId || "");
  const [selectedEvent, setSelectedEvent] = useState<EventType | "">("");
  const [selectedSubtypes, setSelectedSubtypes] = useState<("pee" | "poo")[]>(
    [],
  );
  const [pottyOutcome, setPottyOutcome] = useState<PottyOutcome>("success");
  const [pottyLocation, setPottyLocation] = useState<PottyLocation | "">("");
  const [pottyCue, setPottyCue] = useState<PottyCue | "">("");
  const [userOptionalNote, setUserOptionalNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eventTimestamp, setEventTimestamp] = useState(() =>
    toDateTimeLocalValue(new Date()),
  );
  const [formError, setFormError] = useState<string | null>(null);

  function choosePottyOutcome(outcome: PottyOutcome) {
    setPottyOutcome(outcome);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDogId || !selectedEvent || isSubmitting) {
      return;
    }

    const timestamp = fromDateTimeLocalValue(eventTimestamp);
    if (!timestamp) {
      setFormError("Choose a valid date and time.");
      return;
    }
    if (isFutureDateTime(eventTimestamp)) {
      setFormError("Events cannot be logged in the future.");
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    const note = userOptionalNote.trim() || undefined;

    try {
      if (selectedEvent === "toilet" && selectedSubtypes.length > 0) {
        const newEvents: CareEvent[] = selectedSubtypes.map((subtype) => ({
          id: crypto.randomUUID(),
          dogId: selectedDogId,
          type: selectedEvent,
          timestamp,
          userId: props.userIdInDB,
          note,
          subtype,
          isAccident: pottyOutcome === "accident",
          pottyOutcome,
          pottyLocation: pottyLocation || undefined,
          pottyCue: pottyCue || undefined,
        }));

        const { error } = await supabase.from("DogEvent").insert(
          newEvents.map((newEvent) => ({
            id: newEvent.id,
            dogId: newEvent.dogId,
            type: newEvent.type,
            timestamp: newEvent.timestamp,
            userId: newEvent.userId,
            note: newEvent.note ?? null,
            subtype: newEvent.subtype,
            isAccident: newEvent.isAccident ?? false,
            pottyOutcome: newEvent.pottyOutcome ?? null,
            pottyLocation: newEvent.pottyLocation ?? null,
            pottyCue: newEvent.pottyCue ?? null,
          })),
        );

        if (error) throw error;

        newEvents.forEach((newEvent) => props.onSubmitEvent(newEvent));
        return;
      }

      const newEvent: CareEvent = {
        id: crypto.randomUUID(),
        dogId: selectedDogId,
        type: selectedEvent,
        timestamp,
        userId: props.userIdInDB,
        note,
        ...(selectedEvent === "toilet"
          ? {
              isAccident: pottyOutcome === "accident",
              pottyOutcome,
              pottyLocation: pottyLocation || undefined,
              pottyCue: pottyCue || undefined,
            }
          : {}),
      };

      const { error } = await supabase.from("DogEvent").insert({
        id: newEvent.id,
        dogId: selectedDogId,
        type: selectedEvent,
        timestamp: newEvent.timestamp,
        userId: newEvent.userId,
        note: newEvent.note ?? null,
        pottyOutcome: newEvent.pottyOutcome ?? null,
        pottyLocation: newEvent.pottyLocation ?? null,
        pottyCue: newEvent.pottyCue ?? null,
      });

      if (error) throw error;

      props.onSubmitEvent(newEvent);
    } catch (error) {
      console.error("Error inserting event into database:", error);
      setFormError(
        "Couldn't save the event. Check your connection and try again.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="pt-4">
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-1">
          what happened?
        </p>
        <h1 className="text-4xl font-bold font-fraunces text-warm-brown m-0">
          Log an Event
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <p className={labelClass}>Event type</p>
          <div className="grid grid-cols-2 gap-3">
            {EVENT_OPTIONS.map((option) => {
              const isSelected = selectedEvent === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 cursor-pointer transition-all duration-150 ${
                    isSelected ? "border-warm-brown/50" : "border-warm-brown/12"
                  }`}
                  style={{
                    backgroundColor: isSelected ? option.bg : "white",
                  }}
                >
                  <input
                    type="radio"
                    name="event"
                    value={option.value}
                    checked={isSelected}
                    onChange={(e) => {
                      setSelectedEvent(e.target.value as EventType);
                      // Reset subtype and accident when event type changes
                      if (e.target.value !== "toilet") {
                        setSelectedSubtypes([]);
                        setPottyOutcome("success");
                        setPottyLocation("");
                        setPottyCue("");
                      }
                    }}
                    className="hidden"
                  />
                  <span className="text-xl">{option.emoji}</span>
                  <span
                    className="text-sm font-semibold"
                    style={{
                      color: isSelected ? option.text : "var(--text-dark)",
                    }}
                  >
                    {option.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="event-time" className={labelClass}>
            When did it happen?
          </label>
          <input
            id="event-time"
            type="datetime-local"
            value={eventTimestamp}
            max={toDateTimeLocalValue(new Date())}
            onChange={(event) => setEventTimestamp(event.target.value)}
            className="w-full rounded-xl border-2 border-warm-brown/20 bg-cream px-4 py-3 text-sm text-text-dark outline-none focus:border-warm-brown/50"
          />
          <p className="mt-1 text-xs text-text-muted">
            Defaults to now. Change it if you're logging something from
            earlier.
          </p>
        </div>

        {formError && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            {formError}
          </div>
        )}

        {selectedEvent === "toilet" && (
          <div className="mb-6">
            <p className={labelClass}>Toilet Type</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <label
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 cursor-pointer transition-all duration-150 ${
                  selectedSubtypes.includes("pee")
                    ? "border-warm-brown/50"
                    : "border-warm-brown/12"
                }`}
                style={{
                  backgroundColor: selectedSubtypes.includes("pee")
                    ? "#fef9c3"
                    : "white",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedSubtypes.includes("pee")}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSubtypes([...selectedSubtypes, "pee"]);
                    } else {
                      setSelectedSubtypes(
                        selectedSubtypes.filter((s) => s !== "pee"),
                      );
                    }
                  }}
                  className="hidden"
                />
                <span className="text-xl">💧</span>
                <span
                  className="text-sm font-semibold"
                  style={{
                    color: selectedSubtypes.includes("pee")
                      ? "var(--warm-brown)"
                      : "var(--text-dark)",
                  }}
                >
                  Pee
                </span>
              </label>
              <label
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 cursor-pointer transition-all duration-150 ${
                  selectedSubtypes.includes("poo")
                    ? "border-warm-brown/50"
                    : "border-warm-brown/12"
                }`}
                style={{
                  backgroundColor: selectedSubtypes.includes("poo")
                    ? "#fef9c3"
                    : "white",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedSubtypes.includes("poo")}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSubtypes([...selectedSubtypes, "poo"]);
                    } else {
                      setSelectedSubtypes(
                        selectedSubtypes.filter((s) => s !== "poo"),
                      );
                    }
                  }}
                  className="hidden"
                />
                <span className="text-xl">💩</span>
                <span
                  className="text-sm font-semibold"
                  style={{
                    color: selectedSubtypes.includes("poo")
                      ? "var(--warm-brown)"
                      : "var(--text-dark)",
                  }}
                >
                  Poo
                </span>
              </label>
            </div>
            <div className="space-y-4">
              <div>
                <p className={labelClass}>Outcome</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => choosePottyOutcome("success")}
                    aria-pressed={pottyOutcome === "success"}
                    className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
                      pottyOutcome === "success"
                        ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                        : "border-warm-brown/15 bg-white text-text-dark"
                    }`}
                  >
                    ✅ Success
                  </button>
                  <button
                    type="button"
                    onClick={() => choosePottyOutcome("accident")}
                    aria-pressed={pottyOutcome === "accident"}
                    className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
                      pottyOutcome === "accident"
                        ? "border-rose-400 bg-rose-50 text-rose-800"
                        : "border-warm-brown/15 bg-white text-text-dark"
                    }`}
                  >
                    ⚠️ Accident
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="potty-location" className={labelClass}>
                    Where?
                  </label>
                  <select
                    id="potty-location"
                    value={pottyLocation}
                    onChange={(e) =>
                      setPottyLocation(e.target.value as PottyLocation | "")
                    }
                    className="w-full rounded-xl border-2 border-warm-brown/20 bg-cream px-3 py-3 text-sm text-text-dark outline-none focus:border-warm-brown/50"
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
                  <label htmlFor="potty-cue" className={labelClass}>
                    Cue?
                  </label>
                  <select
                    id="potty-cue"
                    value={pottyCue}
                    onChange={(e) =>
                      setPottyCue(e.target.value as PottyCue | "")
                    }
                    className="w-full rounded-xl border-2 border-warm-brown/20 bg-cream px-3 py-3 text-sm text-text-dark outline-none focus:border-warm-brown/50"
                  >
                    <option value="">Not specified</option>
                    <option value="asked">Asked to go</option>
                    <option value="unprompted">Went unprompted</option>
                    <option value="none">No clear cue</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <label htmlFor="event-note" className={labelClass}>
            Notes (optional)
          </label>
          <textarea
            id="event-note"
            value={userOptionalNote}
            onChange={(e) => setUserOptionalNote(e.target.value)}
            placeholder="Anything worth noting..."
            rows={3}
            maxLength={500}
            className="w-full px-4 py-3 rounded-xl border-2 border-warm-brown/20 bg-cream text-text-dark text-sm font-dm-sans resize-none outline-none focus:border-warm-brown/50 transition-colors"
          />
          <p className="text-xs text-text-muted mt-1 text-right">
            {userOptionalNote.length}/500
          </p>
        </div>

        <button
          type="submit"
          disabled={!selectedEvent || isSubmitting}
          className={`w-full py-3.5 rounded-xl text-base font-semibold transition-all duration-150 ${
            selectedEvent && !isSubmitting
              ? "bg-warm-brown text-white hover:opacity-90 active:scale-98"
              : "bg-warm-brown/30 text-white cursor-not-allowed"
          }`}
        >
          {isSubmitting ? "Saving..." : "Save Event"}
        </button>
      </form>
    </div>
  );
}
