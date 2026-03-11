import "./App.css";
import bernerImage from "./images/berner.jpeg";
import adaImage from "./images/adaImage.jpg";
import bearImage from "./images/bearImage.jpg";
import DogStatusCard from "./components/DogStatusCard.tsx";
import LogEventScreen from "./screens/LogEventScreen.tsx";
import { useState } from "react";
import type { CareEvent, Dog, EventType } from "./types/core.ts";

const initialDogs: Dog[] = [
  {
    dogId: "1",
    dogName: "Bear K",
    dogImage: bearImage,
    lastFedHours: 2,
    lastWalkMinutes: 30,
    lastToiletHours: 1,
    lastMedsHours: 4,
  },
  {
    dogId: "2",
    dogName: "Ada the Shark",
    dogImage: adaImage,
    lastFedHours: 6,
    lastWalkMinutes: 90,
    lastToiletHours: 2,
    lastMedsHours: 2,
  },
  {
    dogId: "3",
    dogName: "Bruno",
    dogImage: bernerImage,
    lastFedHours: 1,
    lastWalkMinutes: 45,
    lastToiletHours: 3,
    lastMedsHours: 1,
  },
];

type Screen = "home" | "logEvent";

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("home");
  const [dogs, setDogs] = useState<Dog[]>(initialDogs);
  const [events, setEvents] = useState<CareEvent[]>([]);

  function changeScreen(screen: Screen) {
    setCurrentScreen(screen);
  }

  function handleDataFromChild(careEvent: CareEvent) {
    setEvents((prevEvents) => [...prevEvents, careEvent]);
    console.log("New event object:", careEvent);
    setCurrentScreen("home");
  }

  function getDogSpecificEventsById(dogId: string, dogs: Dog[]): string {
    if (dogs.length === 0) return "No dog saved to profile";
    else {
      const dogSpecificEvents = dogs.find((dog) => dog.dogId === dogId);
      return dogSpecificEvents ? dogSpecificEvents.dogName : "Unknown Dog";
    }
  }

  if (currentScreen === "home") {
    return (
      <>
        <button onClick={() => changeScreen("logEvent")}>Log event</button>
        <main>
          <h1>Dog Care Log</h1>
        </main>
        {dogs.map((dog) => (
          <DogStatusCard
            key={dog.dogId}
            dogName={dog.dogName}
            dogImage={dog.dogImage}
            lastFedHours={dog.lastFedHours}
            lastWalkMinutes={dog.lastWalkMinutes}
            lastToiletHours={dog.lastToiletHours}
            lastMedsHours={dog.lastMedsHours}
          />
        ))}
        <div>
          <h1>List of Dog Events</h1>
          <ul>
            {events.map((event) => (
              <li key={event.id}>
                {getDogSpecificEventsById(event.dogId, dogs)} - {event.type} at
                time: {event.timestamp}
              </li>
            ))}
          </ul>
        </div>
      </>
    );
  } else if (currentScreen === "logEvent") {
    return (
      <>
        <button onClick={() => changeScreen("home")}>Home</button>
        <LogEventScreen dogs={dogs} onSubmitEvent={handleDataFromChild} />
      </>
    );
  } else {
    return <div>Unknown screen</div>;
  }
}

export default App;
