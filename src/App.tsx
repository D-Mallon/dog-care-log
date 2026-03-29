import "./App.css";
// import bernerImage from "./images/berner.jpeg";
// import adaImage from "./images/adaImage.jpg";
// import bearImage from "./images/bearImage.jpg";
import DogStatusCard from "./components/DogStatusCard.tsx";
import LogEventScreen from "./screens/LogEventScreen.tsx";
import RegisterNewDogScreen from "./screens/RegisterNewDogScreen.tsx";
import AuthScreen from "./screens/AuthScreen.tsx";
import { useEffect, useState } from "react";
import type { CareEvent, Dog, EventType } from "./types/core.ts";
import { supabase } from "./lib/supabase.ts";
import type { JwtPayload } from "@supabase/supabase-js";
import DogProfileScreen from "./screens/DogProfileScreen.tsx";
import getTimeAgo from "./lib/utils.ts";

type Screen = "home" | "logEvent" | "addDog" | "dogProfile";

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("home");
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [events, setEvents] = useState<CareEvent[]>([]);
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const [claims, setClaims] = useState<JwtPayload | null>(null);
  // claims is the decoded JWT token which contains user info and is null if not authenticated. It is created when Supabase.auth.getClaims() is called, which is done on initial render and whenever the auth state changes.
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session using getClaims
    supabase.auth.getClaims().then(({ data }) => {
      setClaims(data?.claims ?? null);
    });
    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      supabase.auth.getClaims().then(({ data }) => {
        setClaims(data?.claims ?? null);
      });
    });
    return () => subscription.unsubscribe();
  }, []);

  function changeScreen(screen: Screen) {
    setCurrentScreen(screen);
  }

  async function getInitialDogs() {
    const { data, error } = await supabase.from("Dogs").select();
    console.log("data:", data);
    console.log("error:", error);
    setDogs(data ?? []);
    setIsLoading(false);
  }

  async function getDogEvents() {
    const { data, error } = await supabase.from("DogEvent").select();
    console.log("data:", data);
    console.log("error:", error);
    setEvents(data ?? []);
  }

  useEffect(() => {
    if (claims) {
      getInitialDogs();
      getDogEvents();
    }
  }, [claims]);

  function handleDataFromChildNewEvent(careEvent: CareEvent) {
    setEvents((prevEvents) => [...prevEvents, careEvent]);
    console.log("New event object:", careEvent);
    setCurrentScreen("home");
  }

  function handleDataFromChildNewDog(newDog: Dog) {
    console.log("New dog object:", newDog);
    getInitialDogs();
    setCurrentScreen("home");
  }

  function getDogNameById(dogId: string, dogs: Dog[]): string {
    if (dogs.length === 0) return "No dog saved to profile";
    else {
      const dogSpecificEvents = dogs.find((dog) => dog.dogId === dogId);
      return dogSpecificEvents ? dogSpecificEvents.dogName : "Unknown Dog";
    }
  }

  function getTheDogsLastEventTime(
    dogId: string,
    eventType: EventType,
    events: CareEvent[],
  ): string | null {
    const matching = events.filter(
      (event) => event.dogId === dogId && event.type === eventType,
    );

    const sorted = [...matching].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return sorted[0]?.timestamp ?? null;
  }

  function handleViewProfile(dogId: string) {
    setSelectedDogId(dogId);
    changeScreen("dogProfile");
  }

  if (!claims) return <AuthScreen />;
  else if (currentScreen === "home") {
    if (isLoading) {
      return <p style={{ color: "var(--text-muted)" }}>Loading your pack...</p>;
    }

    const sortedEvents = [...events].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return (
      <>
        <div className="flex justify-between items-center mb-8">
          <div>
            <p className="text-xs font-medium tracking-widest uppercase text-text-muted mb-1">
              your pack
            </p>
            <h1 className="text-4xl font-bold font-fraunces text-warm-brown">
              Dog Care Log
            </h1>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm px-3 py-1.5 rounded-lg text-text-muted border border-warm-brown/20 bg-transparent hover:bg-light-tan transition-colors"
          >
            Log out
          </button>
        </div>

        <button
          className="mb-6 px-4 py-2 rounded-lg bg-warm-brown text-white font-bold hover:opacity-90 transition-opacity"
          onClick={() => changeScreen("addDog")}
        >
          + Add a Dog
        </button>

        <div className="flex flex-col gap-4 mb-10">
          {dogs.length === 0 ? (
            <p className="text-text-muted">
              You haven't linked any dogs to your account yet.
            </p>
          ) : (
            dogs.map((dog) => {
              const lastFedTimestamp = getTheDogsLastEventTime(
                dog.dogId,
                "feed",
                events,
              );
              const lastWalkTimestamp = getTheDogsLastEventTime(
                dog.dogId,
                "walk",
                events,
              );
              const lastToiletTimestamp = getTheDogsLastEventTime(
                dog.dogId,
                "toilet",
                events,
              );
              const lastMedsTimestamp = getTheDogsLastEventTime(
                dog.dogId,
                "meds",
                events,
              );

              return (
                <DogStatusCard
                  key={dog.dogId}
                  dogName={dog.dogName}
                  dogImage={dog.dogImage}
                  lastFedHours={
                    lastFedTimestamp
                      ? getTimeAgo(lastFedTimestamp)
                      : "Nothing recorded yet."
                  }
                  onViewProfile={() => handleViewProfile(dog.dogId)}
                  lastWalkMinutes={
                    lastWalkTimestamp
                      ? getTimeAgo(lastWalkTimestamp)
                      : "Nothing recorded yet."
                  }
                  lastToiletHours={
                    lastToiletTimestamp
                      ? getTimeAgo(lastToiletTimestamp)
                      : "Nothing recorded yet."
                  }
                  lastMedsHours={
                    lastMedsTimestamp
                      ? getTimeAgo(lastMedsTimestamp)
                      : "Nothing recorded yet."
                  }
                  onLogEvent={() => {
                    setSelectedDogId(dog.dogId);
                    changeScreen("logEvent");
                  }}
                />
              );
            })
          )}
        </div>

        {events.length > 0 && (
          <div className="rounded-2xl p-5 bg-light-tan">
            <h2 className="text-lg font-semibold mb-4 text-warm-brown">
              Recent Events
            </h2>
            <ul className="flex flex-col gap-3">
              {sortedEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex justify-between items-center text-sm py-2 border-b border-warm-brown/15 text-text-dark last:border-b-0"
                >
                  <span className="font-medium">
                    {getDogNameById(event.dogId, dogs)}
                  </span>
                  <span className="capitalize text-text-muted">
                    {event.type}
                  </span>
                  <span className="text-xs text-text-muted">
                    {getTimeAgo(event.timestamp)}
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
        <button
          onClick={() => changeScreen("home")}
          className="mb-6 px-4 py-2 rounded-lg bg-warm-brown text-white font-bold"
        >
          Home
        </button>
        <LogEventScreen
          selectedDogId={selectedDogId}
          onSubmitEvent={handleDataFromChildNewEvent}
          userIdInDB={claims.sub}
        />
      </>
    );
  } else if (currentScreen === "addDog") {
    return (
      <>
        <button
          onClick={() => changeScreen("home")}
          className="mb-6 px-4 py-2 rounded-lg bg-warm-brown text-white font-bold"
        >
          Home
        </button>
        <RegisterNewDogScreen
          userIdInDB={claims.sub}
          onSubmitDog={handleDataFromChildNewDog}
        />
      </>
    );
  } else if (currentScreen === "dogProfile") {
    const selectedDog = dogs.find((dog) => dog.dogId === selectedDogId);
    const selectedDogEvents = events.filter(
      (event) => event.dogId === selectedDogId,
    );
    if (!selectedDog) {
      return <div>Dog not found</div>;
    }
    return (
      <>
        <button onClick={() => changeScreen("home")}>Back</button>
        <DogProfileScreen
          dog={selectedDog}
          events={selectedDogEvents}
          onSave={getInitialDogs}
          userIdInDB={claims.sub}
        />
      </>
    );
  } else {
    return <div>Unknown screen</div>;
  }
}

export default App;
