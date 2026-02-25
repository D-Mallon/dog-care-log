// import { useState } from "react";
import "./App.css";
// import React from "react";
import bernerImage from "src/images/berner.jpeg";

import DogStatusCard from "./components/DogStatusCard.tsx";

function App() {
  return (
    <>
      <main>
        <h1>Dog Care Log</h1>
      </main>
      <DogStatusCard
        dogName="Bear K"
        dogImage={bernerImage}
        lastFedHours={2}
        lastWalkMinutes={30}
        lastToiletHours={1}
        lastMedsHours={4}
      />
      <DogStatusCard
        dogName="Ada the Shark"
        dogImage={bernerImage}
        lastFedHours={6}
        lastWalkMinutes={90}
        lastToiletHours={2}
        lastMedsHours={2}
      />
    </>
  );
}

export default App;
