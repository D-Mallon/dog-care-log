import { useState } from "react";
import type { CareEvent, EventType } from "../types/core.ts";
import { supabase } from "../lib/supabase.ts";

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
];

const labelClass =
  "block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2";

export default function LogEventScreen(props: LogEventScreenProps) {
  const [selectedDogId] = useState<string>(props.selectedDogId || "");
  const [selectedEvent, setSelectedEvent] = useState<EventType | "">("");
  const [selectedSubtype, setSelectedSubtype] = useState<"pee" | "poo" | "other" | "">("");
  const [isAccident, setIsAccident] = useState<boolean>(false);
  const [userOptionalNote, setUserOptionalNote] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDogId || !selectedEvent) {
      return;
    }

    const newEvent: CareEvent = {
      id: crypto.randomUUID(),
      dogId: selectedDogId,
      type: selectedEvent,
      timestamp: new Date().toISOString(),
      userId: props.userIdInDB,
      note: userOptionalNote,
      ...(selectedEvent === "toilet" && selectedSubtype && { subtype: selectedSubtype }),
      ...(selectedEvent === "toilet" && isAccident && { isAccident: isAccident }),
    };

    const { error } = await supabase.from("DogEvent").insert({
      id: newEvent.id,
      dogId: selectedDogId,
      type: selectedEvent,
      timestamp: newEvent.timestamp,
      userId: newEvent.userId,
      note: userOptionalNote || null,
      ...(selectedEvent === "toilet" && selectedSubtype && { subtype: selectedSubtype }),
      ...(selectedEvent === "toilet" && isAccident && { isAccident: isAccident }),
    });

    if (error) {
      console.error("Error inserting event into database:", error);
      return;
    }

    props.onSubmitEvent(newEvent);
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
                    isSelected
                      ? "border-warm-brown/50"
                      : "border-warm-brown/12"
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
                        setSelectedSubtype("");
                        setIsAccident(false);
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

        {selectedEvent === "toilet" && (
          <div className="mb-6">
            <p className={labelClass}>Toilet Type</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <label
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 cursor-pointer transition-all duration-150 ${
                  selectedSubtype === "pee"
                    ? "border-warm-brown/50"
                    : "border-warm-brown/12"
                }`}
                style={{
                  backgroundColor: selectedSubtype === "pee" ? "#fef9c3" : "white",
                }}
              >
                <input
                  type="radio"
                  name="toiletType"
                  value="pee"
                  checked={selectedSubtype === "pee"}
                  onChange={() => setSelectedSubtype("pee")}
                  className="hidden"
                />
                <span className="text-xl">💧</span>
                <span
                  className="text-sm font-semibold"
                  style={{
                    color:
                      selectedSubtype === "pee"
                        ? "var(--warm-brown)"
                        : "var(--text-dark)",
                  }}
                >
                  Pee
                </span>
              </label>
              <label
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 cursor-pointer transition-all duration-150 ${
                  selectedSubtype === "poo"
                    ? "border-warm-brown/50"
                    : "border-warm-brown/12"
                }`}
                style={{
                  backgroundColor: selectedSubtype === "poo" ? "#fef9c3" : "white",
                }}
              >
                <input
                  type="radio"
                  name="toiletType"
                  value="poo"
                  checked={selectedSubtype === "poo"}
                  onChange={() => setSelectedSubtype("poo")}
                  className="hidden"
                />
                <span className="text-xl">💩</span>
                <span
                  className="text-sm font-semibold"
                  style={{
                    color:
                      selectedSubtype === "poo"
                        ? "var(--warm-brown)"
                        : "var(--text-dark)",
                  }}
                >
                  Poo
                </span>
              </label>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAccident}
                onChange={(e) => setIsAccident(e.target.checked)}
                className="form-checkbox h-4 w-4 text-warm-brown rounded border-gray-300 focus:ring-warm-brown"
              />
              <span className="text-sm font-medium text-text-dark">Accident?</span>
            </label>
          </div>
        )}

        <div className="mb-8">
          <label className={labelClass}>Notes (optional)</label>
          <textarea
            value={userOptionalNote}
            onChange={(e) => setUserOptionalNote(e.target.value)}
            placeholder="Anything worth noting..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl border-2 border-warm-brown/20 bg-cream text-text-dark text-sm font-dm-sans resize-none outline-none focus:border-warm-brown/50 transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={!selectedEvent}
          className={`w-full py-3.5 rounded-xl text-base font-semibold transition-all duration-150 ${
            selectedEvent
              ? "bg-warm-brown text-white hover:opacity-90 active:scale-98"
              : "bg-warm-brown/30 text-white cursor-not-allowed"
          }`}
        >
          Save Event
        </button>
      </form>
    </div>
  );
}
