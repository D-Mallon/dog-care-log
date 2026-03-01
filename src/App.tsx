// import { useState } from "react";
import "./App.css";
// import React from "react";
import bernerImage from "./images/berner.jpeg";

import DogStatusCard from "./components/DogStatusCard.tsx";

const dogs = [
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

function App() {
  return (
    <>
      <main>
        <h1>Dog Care Log</h1>
      </main>
      {dogs.map((dog, index) => (
        <DogStatusCard
          key={index}
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
}

export default App;
