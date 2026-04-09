import type { EventType } from "../types/core";

type DogStatusCardProps = {
  dogName: string;
  dogImage: string;
  lastFedHours: string;
  lastWalkMinutes: string;
  lastToiletHours: string;
  lastMedsHours: string;
  numOfEventsToday: number;
  onLogEvent: () => void;
  onViewProfile: () => void;
  onQuickLog?: (eventType: EventType) => void;
};

export const EVENT_DISPLAY: Record<
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
  sick: {
    label: "Sick",
    colourClass: "bg-red-50 text-red-800",
    dot: "bg-red-400",
  },
  nap_time: {
    label: "Nap Time",
    colourClass: "bg-purple-50 text-purple-800",
    dot: "bg-purple-400",
  },
  play_time: {
    label: "Play Time",
    colourClass: "bg-blue-50 text-blue-800",
    dot: "bg-blue-400",
  },
};

export default function DogStatusCard(props: DogStatusCardProps) {
  return (
    <div className="w-full rounded-3xl p-5 shadow-sm bg-white border border-warm-brown/10">
      <div className="flex items-center gap-4 mb-5">
        <div
          onClick={props.onViewProfile}
          className="flex items-center gap-4 cursor-pointer"
        >
          <img
            src={props.dogImage}
            alt={props.dogName}
            className="w-14 h-14 rounded-2xl object-cover border-2 border-warm-brown/15"
          />
          <div>
            <h3 className="text-xl font-bold font-fraunces leading-tight text-warm-brown">
              {props.dogName}
            </h3>
            <p className="text-xs text-text-muted">
              {props.numOfEventsToday} events logged today
            </p>
          </div>
        </div>
      </div>

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
      {props.onQuickLog && (
        <div className="grid grid-cols-4 gap-2 mb-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onQuickLog?.("feed");
            }}
            className="py-2 rounded-lg bg-amber-50 hover:bg-amber-100 active:scale-95 transition-all"
            title="Quick log: Fed"
          >
            <span className="text-xl">🍖</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onQuickLog?.("walk");
            }}
            className="py-2 rounded-lg bg-green-50 hover:bg-green-100 active:scale-95 transition-all"
            title="Quick log: Walked"
          >
            <span className="text-xl">🦮</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onQuickLog?.("toilet");
            }}
            className="py-2 rounded-lg bg-yellow-50 hover:bg-yellow-100 active:scale-95 transition-all"
            title="Quick log: Toilet"
          >
            <span className="text-xl">🌿</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onQuickLog?.("meds");
            }}
            className="py-2 rounded-lg bg-rose-50 hover:bg-rose-100 active:scale-95 transition-all"
            title="Quick log: Meds"
          >
            <span className="text-xl">💊</span>
          </button>
        </div>
      )}

      <button
        className="w-full py-2.5 rounded-xl text-sm font-medium bg-light-tan text-warm-brown hover:opacity-80 active:scale-95 transition-all duration-150"
        onClick={props.onLogEvent}
      >
        Log event for {props.dogName}
      </button>
    </div>
  );
}
