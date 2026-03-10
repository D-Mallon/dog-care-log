import { useState } from "react";
import type { CareEvent, Dog, EventType } from "../types/core.ts";

type LogEventScreenProps = {
  dogs: Dog[];
  onSubmitEvent: (event: CareEvent) => void;
};

export default function LogEventScreen(props: LogEventScreenProps) {
  const [selectedDogId, setSelectedDogId] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<EventType | "">("");
  const [userOptionalNote, setUserOptionalNote] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDogId || !selectedEvent) {
      console.log("Please select a dog and event type");
      return;
    }

    const updatedData = {
      dogId: selectedDogId,
      eventType: selectedEvent,
      note: userOptionalNote,
    };

    const newEvent: CareEvent = {
      id: crypto.randomUUID(),
      dogId: selectedDogId,
      type: selectedEvent,
      timestamp: new Date().toISOString(),
      userId: "demo-user", // Replace with actual user ID in a real app
      note: userOptionalNote,
    };

    props.onSubmitEvent(newEvent);

    console.log("Submitting form with values:");
    console.log("Selected dogId:", selectedDogId);
    console.log("Selected Event:", selectedEvent);
    console.log("User Optional Note:", userOptionalNote);
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <h1>Log an event</h1>
        <hr />
        <label>
          Which dog?:
          <select onChange={(e) => setSelectedDogId(e.target.value)}>
            <option value="">Select a dog...</option>
            {props.dogs.map((dog) => (
              <option key={dog.dogId} value={dog.dogId}>
                {dog.dogName}
              </option>
            ))}
          </select>
        </label>
        <p>
          <label>
            <input
              type="radio"
              name="event"
              value="feed"
              checked={selectedEvent === "feed"}
              onChange={(e) => setSelectedEvent(e.target.value as EventType)}
            />
            Fed
          </label>

          <label>
            <input
              type="radio"
              name="event"
              value="walk"
              checked={selectedEvent === "walk"}
              onChange={(e) => setSelectedEvent(e.target.value as EventType)}
            />
            Walked
          </label>

          <label>
            <input
              type="radio"
              name="event"
              value="toilet"
              checked={selectedEvent === "toilet"}
              onChange={(e) => setSelectedEvent(e.target.value as EventType)}
            />
            Toilet
          </label>

          <label>
            <input
              type="radio"
              name="event"
              value="meds"
              checked={selectedEvent === "meds"}
              onChange={(e) => setSelectedEvent(e.target.value as EventType)}
            />
            Meds
          </label>
        </p>
        <label>
          Optional notes:{" "}
          <input
            name="userOptionalNote"
            value={userOptionalNote}
            onChange={(e) => setUserOptionalNote(e.target.value)}
          />
        </label>
        <button type="submit">Log Event</button>
      </form>
    </>
  );
}
