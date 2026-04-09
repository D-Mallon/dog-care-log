import "./App.css";
// import bernerImage from "./images/berner.jpeg";
// import adaImage from "./images/adaImage.jpg";
// import bearImage from "./images/bearImage.jpg";
import DogStatusCard, { EVENT_DISPLAY } from "./components/DogStatusCard.tsx";
import LogEventScreen from "./screens/LogEventScreen.tsx";
import RegisterNewDogScreen from "./screens/RegisterNewDogScreen.tsx";
import AuthScreen from "./screens/AuthScreen.tsx";
import { useEffect, useState } from "react";
import type { CareEvent, Dog, EventType, WeightLog } from "./types/core.ts";
import { supabase } from "./lib/supabase.ts";
import type { JwtPayload } from "@supabase/supabase-js";
import DogProfileScreen from "./screens/DogProfileScreen.tsx";
import getTimeAgo from "./lib/utils.ts";
import HouseholdSetupScreen from "./screens/HouseholdSetupScreen.tsx";
import type { Household } from "./types/core.ts";

type Screen = "home" | "logEvent" | "addDog" | "dogProfile" | "householdSetup";

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("home");
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [events, setEvents] = useState<CareEvent[]>([]);
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const [claims, setClaims] = useState<JwtPayload | null>(null);
  // claims is the decoded JWT token which contains user info and is null if not authenticated. It is created when Supabase.auth.getClaims() is called, which is done on initial render and whenever the auth state changes.
  const [household, setHousehold] = useState<Household | null>(null);
  const [copied, setCopied] = useState(false);
  const [dogsLoading, setDogsLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);

  // derive combined loading state
  const isLoading = dogsLoading || eventsLoading;

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
    const { data } = await supabase.from("Dogs").select();
    setDogs(data ?? []);
    setDogsLoading(false);
  }

  async function getDogEvents() {
    const { data } = await supabase.from("DogEvent").select();
    setEvents(data ?? []);
    setEventsLoading(false);
  }

  useEffect(() => {
    if (claims) {
      getHousehold(claims.sub);
    }
  }, [claims]);

  useEffect(() => {
    if (claims && household) {
      getInitialDogs();
      getDogEvents();
      getWeightLogs();
    }
  }, [claims, household]);

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

  async function getHousehold(userId: string) {
    const { data, error } = await supabase
      .from("HouseholdMember")
      .select("householdId")
      .eq("userId", userId)
      .eq("status", "active")
      .single();

    if (error || !data) {
      setHousehold(null);
      return;
    }

    const { data: householdData } = await supabase
      .from("Household")
      .select()
      .eq("id", data.householdId)
      .single();

    setHousehold(householdData ?? null);
  }

  async function getWeightLogs() {
    const { data } = await supabase.from("WeightLog").select();
    setWeightLogs(data ?? []);
  }

  async function handleDeleteEvent(eventId: string) {
    const { error } = await supabase
      .from("DogEvent")
      .delete()
      .eq("id", eventId);
    if (error) {
      console.error("Error deleting event:", error);
      return;
    }
    setEvents((prevEvents) =>
      prevEvents.filter((event) => event.id !== eventId),
    );
  }

  async function handleDeleteDog(dogId: string) {
    const { error } = await supabase.from("Dogs").delete().eq("dogId", dogId);
    if (error) {
      console.error("Error deleting dog:", error);
      return;
    }
    setDogs((prevDogs) => prevDogs.filter((dog) => dog.dogId !== dogId));
    setEvents((prevEvents) =>
      prevEvents.filter((event) => event.dogId !== dogId),
    );
    setCurrentScreen("home");
  }

  if (!claims) return <AuthScreen />;

  if (!household)
    return (
      <HouseholdSetupScreen
        userIdInDB={claims.sub}
        onHouseholdReady={(h) => setHousehold(h)}
      />
    );
  if (currentScreen === "home") {
    if (isLoading) {
      return <p style={{ color: "var(--text-muted)" }}>Loading your pack...</p>;
    }

    const sortedEvents = [...events].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    const todaysEvents = sortedEvents.filter((event) => {
      const eventDate = new Date(event.timestamp).toDateString();
      const todayDate = new Date().toDateString();
      return eventDate === todayDate;
    });

    const getNumberOfEventsForDog = (dogId: string, events: CareEvent[]) => {
      return events.filter((event) => event.dogId === dogId).length;
    };

    return (
      <>
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="text-xs font-medium tracking-widest uppercase text-text-muted mb-1">
                your pack
              </p>
              <h1 className="text-4xl font-bold font-fraunces text-warm-brown">
                Loggi
              </h1>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={() => supabase.auth.signOut()}
                className="text-sm px-3 py-1.5 rounded-lg text-text-muted border border-warm-brown/20 bg-transparent hover:bg-light-tan transition-colors"
              >
                Log out
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(household.inviteCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="text-sm px-3 py-1.5 rounded-lg text-warm-brown border border-warm-brown/20 hover:bg-light-tan transition-colors"
              >
                {copied ? "Copied! ✓" : "Share 🐾"}
              </button>
            </div>
          </div>

          <button
            className="w-full py-3 rounded-xl bg-warm-brown text-white text-sm font-bold hover:opacity-90 transition-opacity"
            onClick={() => changeScreen("addDog")}
          >
            + Add a Dog
          </button>
        </div>

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
                  numOfEventsToday={getNumberOfEventsForDog(
                    dog.dogId,
                    todaysEvents,
                  )}
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

        {todaysEvents.length > 0 ? (
          <div className="rounded-2xl p-5 bg-light-tan">
            <h2 className="text-lg font-semibold mb-4 text-warm-brown">
              Today's Events
            </h2>
            <ul className="flex flex-col gap-3">
              {todaysEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex justify-between items-center text-sm py-2 border-b border-warm-brown/15 text-text-dark last:border-b-0"
                >
                  <span className="font-medium">
                    {getDogNameById(event.dogId, dogs)}
                  </span>
                  <span className="text-text-muted">
                    {EVENT_DISPLAY[event.type].label}
                  </span>
                  <span className="text-xs text-text-muted">
                    {getTimeAgo(event.timestamp)}
                  </span>
                  <button
                    onClick={() => {
                      if (window.confirm("Delete this event?")) {
                        handleDeleteEvent(event.id);
                      }
                    }}
                    className="text-xs text-rose-400 hover:text-rose-600 transition-colors ml-2 flex-shrink-0"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-text-muted text-center py-2">
            No events logged today yet. Tap a dog card to log one.
          </p>
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
          householdId={household?.id ?? ""}
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
        <button
          onClick={() => changeScreen("home")}
          className="flex items-center gap-1.5 text-sm font-medium text-warm-brown mb-6 hover:opacity-70 transition-opacity"
        >
          ← Back
        </button>{" "}
        <DogProfileScreen
          dog={selectedDog}
          events={selectedDogEvents}
          weightLogs={weightLogs.filter((w) => w.dogId === selectedDogId)}
          onSave={getInitialDogs}
          householdId={household?.id ?? ""}
          userIdInDB={claims.sub}
          onDeleteEvent={handleDeleteEvent}
          onDeleteDog={handleDeleteDog}
          onWeightLogged={getWeightLogs}
        />
      </>
    );
  } else {
    return <div>Unknown screen</div>;
  }
}

export default App;
