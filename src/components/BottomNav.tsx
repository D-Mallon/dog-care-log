export type NavTab = "home" | "insights" | "schedules" | "profile";

type BottomNavProps = {
  active: NavTab;
  onNavigate: (tab: NavTab) => void;
};

const TABS: { id: NavTab; label: string; icon: React.ReactNode }[] = [
  {
    id: "home",
    label: "Home",
    icon: (
      <path d="M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5" />
    ),
  },
  {
    id: "insights",
    label: "Insights",
    icon: (
      <>
        <path d="M4 18V9m5 9V5m5 13v-7m5 7V8" />
        <path d="M3 20h18" />
      </>
    ),
  },
  {
    id: "schedules",
    label: "Plan",
    icon: (
      <>
        <rect x="3.5" y="5" width="17" height="15" rx="3" />
        <path d="M8 3v4M16 3v4M3.5 10h17M8 14h3M8 17h6" />
      </>
    ),
  },
  {
    id: "profile",
    label: "You",
    icon: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.8-3.6 3.5-5.5 7-5.5s6.2 1.9 7 5.5" />
      </>
    ),
  },
];

export default function BottomNav({ active, onNavigate }: BottomNavProps) {
  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-warm-brown/10 bg-[#fffdf9]/95 backdrop-blur-md"
    >
      <div className="mx-auto grid max-w-[480px] grid-cols-4 px-2 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-1.5">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              aria-current={isActive ? "page" : undefined}
              className={`group flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium transition-colors ${
                isActive
                  ? "text-warm-brown"
                  : "text-text-muted hover:text-warm-brown"
              }`}
            >
              <span
                className={`flex h-8 w-11 items-center justify-center rounded-full transition-colors ${
                  isActive ? "bg-light-tan" : "bg-transparent"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-[21px] w-[21px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {tab.icon}
                </svg>
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
