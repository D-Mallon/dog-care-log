import { useState } from "react";

export default function LogEventScreen() {
  const [selectedDog, setSelectedDog] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [userOptionalNote, setUserOptionalNote] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    console.log("Submitting form with values:");
    console.log("Selected Dog:", selectedDog);
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
          <select
            name="selectedDog"
            onChange={(e) => setSelectedDog(e.target.value)}
          >
            <option value="bear">Bear K</option>
            <option value="ada">Ada the Shark</option>
            <option value="bella">Bella</option>
          </select>
        </label>
        <p>
          <label>
            <input
              type="radio"
              name="myRadio"
              value="option1"
              onChange={() => setSelectedEvent("Fed")}
            />
            Fed
          </label>
          <label>
            <input
              type="radio"
              name="myRadio"
              value="option2"
              onChange={() => setSelectedEvent("Walked")}
            />
            Walked
          </label>
          <label>
            <input
              type="radio"
              name="myRadio"
              value="option3"
              onChange={() => setSelectedEvent("Toilet")}
            />
            Toilet
          </label>
          <label>
            <input
              type="radio"
              name="myRadio"
              value="option4"
              onChange={() => setSelectedEvent("Meds")}
            />
            Meds
          </label>
        </p>
        <label>
          Optional notes:{" "}
          <input
            name="userOptionalNote"
            onChange={(e) => setUserOptionalNote(e.target.value)}
          />
        </label>
        <button type="submit">Log Event</button>
      </form>
    </>
  );
}
