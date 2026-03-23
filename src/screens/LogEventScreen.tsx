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
}[] = [
  {
    value: "feed",
    label: "Fed",
    emoji: "🍖",
    colour: "#92400e",
    bg: "#fef3c7",
  },
  {
    value: "walk",
    label: "Walked",
    emoji: "🦮",
    colour: "#065f46",
    bg: "#d1fae5",
  },
  {
    value: "toilet",
    label: "Toilet",
    emoji: "🌿",
    colour: "#78350f",
    bg: "#fef9c3",
  },
  {
    value: "meds",
    label: "Meds",
    emoji: "💊",
    colour: "#9f1239",
    bg: "#ffe4e6",
  },
];

export default function LogEventScreen(props: LogEventScreenProps) {
  const [selectedDogId] = useState<string>(props.selectedDogId || "");
  const [selectedEvent, setSelectedEvent] = useState<EventType | "">("");
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
    };

    const { error } = await supabase.from("DogEvent").insert({
      id: newEvent.id,
      dogId: selectedDogId,
      type: selectedEvent,
      timestamp: newEvent.timestamp,
      userId: newEvent.userId,
      note: userOptionalNote || null,
    });

    if (error) {
      console.error("Error inserting event into database:", error);
      return;
    }

    props.onSubmitEvent(newEvent);
  }

  return (
    <div style={{ paddingTop: "1rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <p
          style={{
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: "0.25rem",
          }}
        >
          what happened?
        </p>
        <h1
          style={{
            fontFamily: "Fraunces, serif",
            fontSize: "2rem",
            fontWeight: 700,
            color: "var(--warm-brown)",
            margin: 0,
          }}
        >
          Log an Event
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Event type selector */}
        <div style={{ marginBottom: "1.5rem" }}>
          <p
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "var(--text-muted)",
              marginBottom: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Event type
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
            }}
          >
            {EVENT_OPTIONS.map((option) => (
              <label
                key={option.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.875rem 1rem",
                  borderRadius: "1rem",
                  border: `2px solid ${selectedEvent === option.value ? option.colour : "rgba(124, 92, 62, 0.12)"}`,
                  backgroundColor:
                    selectedEvent === option.value ? option.bg : "white",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <input
                  type="radio"
                  name="event"
                  value={option.value}
                  checked={selectedEvent === option.value}
                  onChange={(e) =>
                    setSelectedEvent(e.target.value as EventType)
                  }
                  style={{ display: "none" }}
                />
                <span style={{ fontSize: "1.25rem" }}>{option.emoji}</span>
                <span
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    color:
                      selectedEvent === option.value
                        ? option.colour
                        : "var(--text-dark)",
                  }}
                >
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Optional note */}
        <div style={{ marginBottom: "2rem" }}>
          <label
            style={{
              display: "block",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "var(--text-muted)",
              marginBottom: "0.5rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Notes (optional)
          </label>
          <textarea
            value={userOptionalNote}
            onChange={(e) => setUserOptionalNote(e.target.value)}
            placeholder="Anything worth noting..."
            rows={3}
            style={{
              width: "100%",
              padding: "0.75rem 1rem",
              borderRadius: "0.875rem",
              border: "1.5px solid rgba(124, 92, 62, 0.2)",
              backgroundColor: "var(--cream)",
              color: "var(--text-dark)",
              fontSize: "0.9rem",
              fontFamily: "DM Sans, sans-serif",
              resize: "none",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!selectedEvent}
          style={{
            width: "100%",
            padding: "0.875rem",
            borderRadius: "0.875rem",
            border: "none",
            backgroundColor: selectedEvent
              ? "var(--warm-brown)"
              : "rgba(124, 92, 62, 0.3)",
            color: "white",
            fontSize: "0.95rem",
            fontWeight: 600,
            fontFamily: "DM Sans, sans-serif",
            cursor: selectedEvent ? "pointer" : "not-allowed",
            transition: "opacity 0.15s ease",
          }}
        >
          Save Event
        </button>
      </form>
    </div>
  );
}
