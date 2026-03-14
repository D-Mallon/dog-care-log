import type { EventType } from "../types/core";

type DogStatusCardProps = {
  dogName: string;
  dogImage: string;
  lastFedHours: string;
  lastWalkMinutes: string;
  lastToiletHours: string;
  lastMedsHours: string;
  onLogEvent: () => void;
};

const EVENT_DISPLAY: Record<
  EventType,
  { label: string; colourClass: string; dot: string }
> = {
  feed: {
    label: "Fed",
    colourClass: "bg-amber-50 text-amber-800",
    dot: "bg-amber-400",
  },
  walk: {
    label: "Walked",
    colourClass: "bg-sage-50 text-green-800",
    dot: "bg-green-400",
  },
  toilet: {
    label: "Toilet",
    colourClass: "bg-yellow-50 text-yellow-800",
    dot: "bg-yellow-400",
  },
  meds: {
    label: "Meds",
    colourClass: "bg-rose-50 text-rose-800",
    dot: "bg-rose-400",
  },
};

export default function DogStatusCard(props: DogStatusCardProps) {
  return (
    <div
      className="w-full rounded-3xl p-5 shadow-sm"
      style={{
        backgroundColor: "#fff",
        border: "1px solid rgba(124, 92, 62, 0.1)",
      }}
    >
      {/* Dog header */}
      <div className="flex items-center gap-4 mb-5">
        <img
          src={props.dogImage}
          alt={props.dogName}
          className="w-14 h-14 rounded-2xl object-cover"
          style={{ border: "2px solid rgba(124, 92, 62, 0.15)" }}
        />
        <div>
          <h3
            className="text-xl font-bold leading-tight"
            style={{
              fontFamily: "Fraunces, serif",
              color: "var(--warm-brown)",
            }}
          >
            {props.dogName}
          </h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            all good today
          </p>
        </div>
      </div>

      {/* Status grid */}
      <ul className="grid grid-cols-2 gap-2 mb-4">
        <li className="rounded-xl px-3 py-2 bg-amber-50 flex justify-between items-center">
          <span className="text-xs font-medium text-amber-800">
            {EVENT_DISPLAY.feed.label}
          </span>
          <span className="text-xs text-amber-600">{props.lastFedHours}</span>
        </li>
        <li className="rounded-xl px-3 py-2 bg-green-50 flex justify-between items-center">
          <span className="text-xs font-medium text-green-800">
            {EVENT_DISPLAY.walk.label}
          </span>
          <span className="text-xs text-green-600">
            {props.lastWalkMinutes}
          </span>
        </li>
        <li className="rounded-xl px-3 py-2 bg-yellow-50 flex justify-between items-center">
          <span className="text-xs font-medium text-yellow-800">
            {EVENT_DISPLAY.toilet.label}
          </span>
          <span className="text-xs text-yellow-600">
            {props.lastToiletHours}
          </span>
        </li>
        <li className="rounded-xl px-3 py-2 bg-rose-50 flex justify-between items-center">
          <span className="text-xs font-medium text-rose-800">
            {EVENT_DISPLAY.meds.label}
          </span>
          <span className="text-xs text-rose-600">{props.lastMedsHours}</span>
        </li>
      </ul>

      {/* Log button */}
      <button
        className="w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-150 hover:opacity-80 active:scale-95"
        style={{
          backgroundColor: "var(--light-tan)",
          color: "var(--warm-brown)",
        }}
        onClick={props.onLogEvent}
      >
        Log event for {props.dogName}
      </button>
    </div>
  );
}
