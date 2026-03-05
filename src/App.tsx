import "./App.css";
import bernerImage from "./images/berner.jpeg";
import DogStatusCard from "./components/DogStatusCard.tsx";
import LogEventScreen from "./screens/LogEventScreen.tsx";
import { useState } from "react";
import type { Dog } from "./types/core.ts";

const initialDogs: Dog[] = [
  {
    dogId: "1",
    dogName: "Bear K",
    dogImage: bernerImage,
    lastFedHours: 2,
    lastWalkMinutes: 30,
    lastToiletHours: 1,
    lastMedsHours: 4,
  },
  {
    dogId: "2",
    dogName: "Ada the Shark",
    dogImage: bernerImage,
    lastFedHours: 6,
    lastWalkMinutes: 90,
    lastToiletHours: 2,
    lastMedsHours: 2,
  },
  {
    dogId: "3",
    dogName: "Bella",
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

  function changeScreen(screen: Screen) {
    setCurrentScreen(screen);
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
      </>
    );
  } else if (currentScreen === "logEvent") {
    return (
      <>
        <button onClick={() => changeScreen("home")}>Home</button>
        <LogEventScreen dogs={dogs} />
      </>
    );
  } else {
    return <div>Unknown screen</div>;
  }
}

export default App;
