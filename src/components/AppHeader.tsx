import { useEffect, useRef, useState } from "react";

type AppHeaderProps = {
  displayName: string;
  email?: string;
  avatarUrl?: string;
  householdName?: string;
  onNavigate: (
    screen:
      | "home"
      | "profile"
      | "household"
      | "pricing"
      | "account",
  ) => void;
  onLogout: () => void;
};

function initialFor(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export default function AppHeader({
  displayName,
  email,
  avatarUrl,
  householdName,
  onNavigate,
  onLogout,
}: AppHeaderProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointer = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function go(screen: "home" | "profile" | "household" | "pricing" | "account") {
    setOpen(false);
    onNavigate(screen);
  }

  return (
    <header className="sticky top-0 z-30 -mx-4 mb-3 border-b border-warm-brown/10 bg-[#fdf8f1]/90 px-4 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[480px] items-center justify-between">
        <button
          type="button"
          onClick={() => go("home")}
          className="flex min-w-0 items-baseline gap-2 text-left"
          aria-label="Loggi home"
        >
          <span className="font-fraunces text-[26px] font-bold leading-none text-warm-brown">
            Loggi
          </span>
          {householdName && (
            <span className="truncate text-xs text-text-muted">
              {householdName}
            </span>
          )}
        </button>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label="Open account menu"
            aria-haspopup="menu"
            aria-expanded={open}
            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-warm-brown/20 bg-light-tan text-sm font-bold text-warm-brown transition hover:border-warm-brown/40"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              initialFor(displayName)
            )}
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 top-12 w-64 overflow-hidden rounded-2xl border border-warm-brown/15 bg-[#fffdf9] p-1.5 shadow-xl shadow-warm-brown/10"
            >
              <div className="px-3 pb-2 pt-2">
                <p className="truncate text-sm font-semibold text-text-dark">
                  {displayName}
                </p>
                {email && (
                  <p className="truncate text-xs text-text-muted">{email}</p>
                )}
              </div>
              <div className="h-px bg-warm-brown/10" />
              {[
                { label: "Your profile", screen: "profile" as const },
                { label: "Household & invite", screen: "household" as const },
                { label: "Plan & billing", screen: "pricing" as const },
                { label: "Account & data", screen: "account" as const },
              ].map((item) => (
                <button
                  key={item.screen}
                  type="button"
                  role="menuitem"
                  onClick={() => go(item.screen)}
                  className="mt-0.5 w-full rounded-xl px-3 py-2.5 text-left text-sm text-text-dark transition hover:bg-light-tan/70"
                >
                  {item.label}
                </button>
              ))}
              <div className="my-1 h-px bg-warm-brown/10" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
