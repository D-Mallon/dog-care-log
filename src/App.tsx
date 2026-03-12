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
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);

  function changeScreen(screen: Screen) {
    setCurrentScreen(screen);
  }

  function handleDataFromChild(careEvent: CareEvent) {
    setEvents((prevEvents) => [...prevEvents, careEvent]);
    console.log("New event object:", careEvent);
    setCurrentScreen("home");
  }

  function getDogNameById(dogId: string, dogs: Dog[]): string {
    if (dogs.length === 0) return "No dog saved to profile";
    else {
      const dogSpecificEvents = dogs.find((dog) => dog.dogId === dogId);
      return dogSpecificEvents ? dogSpecificEvents.dogName : "Unknown Dog";
    }
  }

  if (currentScreen === "home") {
    const sortedEvents = [...events].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return (
      <>
        {/* Header */}
        <div className="mb-8">
          <p
            className="text-xs font-medium tracking-widest uppercase mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            your pack
          </p>
          <h1
            className="text-4xl font-bold"
            style={{
              color: "var(--warm-brown)",
              fontFamily: "Fraunces, serif",
            }}
          >
            Dog Care Log
          </h1>
        </div>

        {/* Dog Cards */}
        <div className="flex flex-col gap-4 mb-10">
          {dogs.map((dog) => (
            <DogStatusCard
              key={dog.dogId}
              dogName={dog.dogName}
              dogImage={dog.dogImage}
              lastFedHours={dog.lastFedHours}
              lastWalkMinutes={dog.lastWalkMinutes}
              lastToiletHours={dog.lastToiletHours}
              lastMedsHours={dog.lastMedsHours}
              onLogEvent={() => {
                setSelectedDogId(dog.dogId);
                changeScreen("logEvent");
              }}
            />
          ))}
        </div>

        {/* Events Log */}
        {events.length > 0 && (
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: "var(--light-tan)" }}
          >
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: "var(--warm-brown)" }}
            >
              Recent Events
            </h2>
            <ul className="flex flex-col gap-3">
              {sortedEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex justify-between items-center text-sm py-2 border-b last:border-b-0"
                  style={{
                    borderColor: "rgba(124, 92, 62, 0.15)",
                    color: "var(--text-dark)",
                  }}
                >
                  <span className="font-medium">
                    {getDogNameById(event.dogId, dogs)}
                  </span>
                  <span
                    style={{ color: "var(--text-muted)" }}
                    className="capitalize"
                  >
                    {event.type}
                  </span>
                  <span
                    style={{ color: "var(--text-muted)" }}
                    className="text-xs"
                  >
                    {new Date(event.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </>
    );
  } else if (currentScreen === "logEvent") {
    return (
      <>
        <button onClick={() => changeScreen("home")}>Home</button>
        <LogEventScreen
          selectedDogId={selectedDogId}
          onSubmitEvent={handleDataFromChild}
        />
      </>
    );
  } else {
    return <div>Unknown screen</div>;
  }
}

export default App;
