import type { EventType } from "../types/core";
import { EVENT_DISPLAY } from "../lib/eventMeta.ts";
import { careUrgencyLabel } from "../lib/careStatus.ts";
import type { CareUrgency } from "../lib/careStatus.ts";

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
  feedUrgency?: CareUrgency;
  walkUrgency?: CareUrgency;
  toiletUrgency?: CareUrgency;
  medsUrgency?: CareUrgency;
  quickLogPending?: string | null;
};

const QUICK_LOGS: {
  type: EventType;
  emoji: string;
  label: string;
  className: string;
}[] = [
  {
    type: "feed",
    emoji: "🍖",
    label: "Fed",
    className: "bg-amber-50 hover:bg-amber-100",
  },
  {
    type: "water",
    emoji: "💧",
    label: "Water",
    className: "bg-cyan-50 hover:bg-cyan-100",
  },
  {
    type: "walk",
    emoji: "🦮",
    label: "Walked",
    className: "bg-green-50 hover:bg-green-100",
  },
  {
    type: "toilet",
    emoji: "🌿",
    label: "Toilet",
    className: "bg-yellow-50 hover:bg-yellow-100",
  },
  {
    type: "meds",
    emoji: "💊",
    label: "Meds",
    className: "bg-rose-50 hover:bg-rose-100",
  },
  {
    type: "grooming",
    emoji: "✂️",
    label: "Grooming",
    className: "bg-orange-50 hover:bg-orange-100",
  },
];

function urgencyRing(urgency?: CareUrgency): string {
  if (urgency === "overdue") return "ring-2 ring-rose-400";
  if (urgency === "due-soon") return "ring-2 ring-amber-300";
  return "";
}

export default function DogStatusCard(props: DogStatusCardProps) {
  const isBusy = Boolean(props.quickLogPending);

  return (
    <div className="w-full rounded-3xl p-5 shadow-sm bg-white border border-warm-brown/10">
      <div className="flex items-center gap-4 mb-5">
        <button
          type="button"
          onClick={props.onViewProfile}
          className="flex items-center gap-4 text-left rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-brown/40"
        >
          {props.dogImage ? (
            <img
              src={props.dogImage}
              alt={props.dogName}
              className="w-14 h-14 rounded-2xl object-cover border-2 border-warm-brown/15"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-warm-brown/15 bg-light-tan text-2xl"
            >
              🐾
            </span>
          )}
          <span>
            <span className="block text-xl font-bold font-fraunces leading-tight text-warm-brown">
              {props.dogName}
            </span>
            <span className="block text-xs text-text-muted">
              {props.numOfEventsToday} events logged today
            </span>
          </span>
        </button>
      </div>

      <ul className="grid grid-cols-2 gap-2 mb-4">
        <li
          className={`rounded-xl px-3 py-2 bg-amber-50 flex justify-between items-center gap-2 ${urgencyRing(props.feedUrgency)}`}
          title={careUrgencyLabel(props.feedUrgency ?? "no-record")}
        >
          <span className="text-xs font-medium text-amber-800">
            {EVENT_DISPLAY.feed.label}
          </span>
          <span className="text-right text-xs text-amber-700">
            {props.lastFedHours}
            <span className="sr-only">
              {" "}
              ({careUrgencyLabel(props.feedUrgency ?? "no-record")})
            </span>
          </span>
        </li>
        <li
          className={`rounded-xl px-3 py-2 bg-green-50 flex justify-between items-center gap-2 ${urgencyRing(props.walkUrgency)}`}
          title={careUrgencyLabel(props.walkUrgency ?? "no-record")}
        >
          <span className="text-xs font-medium text-green-800">
            {EVENT_DISPLAY.walk.label}
          </span>
          <span className="text-right text-xs text-green-700">
            {props.lastWalkMinutes}
            <span className="sr-only">
              {" "}
              ({careUrgencyLabel(props.walkUrgency ?? "no-record")})
            </span>
          </span>
        </li>
        <li
          className={`rounded-xl px-3 py-2 bg-yellow-50 flex justify-between items-center gap-2 ${urgencyRing(props.toiletUrgency)}`}
          title={careUrgencyLabel(props.toiletUrgency ?? "no-record")}
        >
          <span className="text-xs font-medium text-yellow-800">
            {EVENT_DISPLAY.toilet.label}
          </span>
          <span className="text-right text-xs text-yellow-700">
            {props.lastToiletHours}
            <span className="sr-only">
              {" "}
              ({careUrgencyLabel(props.toiletUrgency ?? "no-record")})
            </span>
          </span>
        </li>
        <li
          className={`rounded-xl px-3 py-2 bg-rose-50 flex justify-between items-center gap-2 ${urgencyRing(props.medsUrgency)}`}
          title={careUrgencyLabel(props.medsUrgency ?? "no-record")}
        >
          <span className="text-xs font-medium text-rose-800">
            {EVENT_DISPLAY.meds.label}
          </span>
          <span className="text-right text-xs text-rose-700">
            {props.lastMedsHours}
            <span className="sr-only">
              {" "}
              ({careUrgencyLabel(props.medsUrgency ?? "no-record")})
            </span>
          </span>
        </li>
      </ul>

      {props.onQuickLog && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {QUICK_LOGS.map((quickLog) => (
            <button
              key={quickLog.type}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                props.onQuickLog?.(quickLog.type);
              }}
              disabled={isBusy}
              aria-label={`Quick log: ${quickLog.label}`}
              aria-busy={isBusy}
              title={`Quick log: ${quickLog.label}`}
              className={`py-2 rounded-lg active:scale-95 transition-all disabled:opacity-50 ${quickLog.className}`}
            >
              <span className="text-xl" aria-hidden="true">
                {quickLog.emoji}
              </span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        className="w-full py-2.5 rounded-xl text-sm font-medium bg-light-tan text-warm-brown hover:opacity-80 active:scale-95 transition-all duration-150"
        onClick={props.onLogEvent}
      >
        Log event for {props.dogName}
      </button>
    </div>
  );
}
