// import { useState } from "react";
import "./App.css";
// import React from "react";

import DogStatusCard from "./components/DogStatusCard.tsx";

function App() {
  return (
    <>
      <main>
        <h1>Dog Care Log</h1>
      </main>
      <DogStatusCard />
      <DogStatusCard />
    </>
  );
}

export default App;
