type EventType = "feed" | "walk" | "toilet" | "meds";

type DogStatusCardProps = {
  dogName: string;
  dogImage: string;
  lastFedHours: number;
  lastWalkMinutes: number;
  lastToiletHours: number;
  lastMedsHours: number;
};

// EVENT_DISPLAY is an object that must contain an entry for every event type, and each entry must describe how that event looks.
const EVENT_DISPLAY: Record<EventType, { label: string; colourClass: string }> =
  {
    feed: {
      label: "Fed",
      colourClass: "bg-green-100 text-green-800",
    },
    walk: {
      label: "Walked",
      colourClass: "bg-blue-100 text-blue-800",
    },
    toilet: {
      label: "Toilet",
      colourClass: "bg-yellow-100 text-yellow-800",
    },
    meds: {
      label: "Meds",
      colourClass: "bg-purple-100 text-purple-800",
    },
  };

export default function DogStatusCard(props: DogStatusCardProps) {
  return (
    <div className="max-w-xs w-full p-6 border rounded-lg shadow-sm bg-white">
      <div className="flex flex-col items-center">
        <img
          src={props.dogImage}
          alt={props.dogName}
          className="w-24 h-24 rounded-full mb-4"
        />

        <h3 className="text-lg font-semibold mb-4">{props.dogName}</h3>

        <ul className="w-full space-y-2 text-sm">
          <li className="flex justify-between items-center">
            <span
              className={`px-2 py-0.5 rounded ${EVENT_DISPLAY.feed.colourClass}`}
            >
              {EVENT_DISPLAY.feed.label}
            </span>
            <span>{props.lastFedHours}h ago</span>
          </li>

          <li className="flex justify-between items-center">
            <span
              className={`px-2 py-0.5 rounded ${EVENT_DISPLAY.walk.colourClass}`}
            >
              {EVENT_DISPLAY.walk.label}
            </span>
            <span>{props.lastWalkMinutes}m ago</span>
          </li>

          <li className="flex justify-between items-center">
            <span
              className={`px-2 py-0.5 rounded ${EVENT_DISPLAY.toilet.colourClass}`}
            >
              {EVENT_DISPLAY.toilet.label}
            </span>
            <span>{props.lastToiletHours}h ago</span>
          </li>

          <li className="flex justify-between items-center">
            <span
              className={`px-2 py-0.5 rounded ${EVENT_DISPLAY.meds.colourClass}`}
            >
              {EVENT_DISPLAY.meds.label}
            </span>
            <span>{props.lastMedsHours}h ago</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
