import "./App.css";
import DogStatusCard from "./components/DogStatusCard.tsx";
import LogEventScreen from "./screens/LogEventScreen.tsx";
import RegisterNewDogScreen from "./screens/RegisterNewDogScreen.tsx";
import AuthScreen from "./screens/AuthScreen.tsx";
import DogProfileScreen from "./screens/DogProfileScreen.tsx";
import HouseholdSetupScreen from "./screens/HouseholdSetupScreen.tsx";
import HouseholdScreen from "./screens/HouseholdScreen.tsx";
import PricingScreen from "./screens/PricingScreen.tsx";
import LegalScreen from "./screens/LegalScreen.tsx";
import AccountScreen from "./screens/AccountScreen.tsx";
import ErrorToast from "./components/ErrorToast.tsx";
import NoticeToast from "./components/NoticeToast.tsx";
import EventReactions from "./components/EventReactions.tsx";
import TodayPlan from "./components/TodayPlan.tsx";
import WeeklyReport from "./components/WeeklyReport.tsx";
import SchedulesScreen from "./screens/SchedulesScreen.tsx";
import ProfileSettingsScreen from "./screens/ProfileSettingsScreen.tsx";
import InsightsScreen from "./screens/InsightsScreen.tsx";
import InsightsSummaryCard from "./components/InsightsSummaryCard.tsx";
import OnboardingChecklist from "./components/OnboardingChecklist.tsx";
import OnDutyCard from "./components/OnDutyCard.tsx";
import AppHeader from "./components/AppHeader.tsx";
import BottomNav, { type NavTab } from "./components/BottomNav.tsx";
import Modal from "./components/Modal.tsx";
import OfflineBanner from "./components/OfflineBanner.tsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  CareEvent,
  CareSchedule,
  CareTaskCompletion,
  Dog,
  EventComment,
  EventReaction,
  EventType,
  Household,
  HouseholdMember,
  WeightLog,
} from "./types/core.ts";
import { supabase } from "./lib/supabase.ts";
import { isSupabaseConfigured, envErrorMessage } from "./lib/env.ts";
import getTimeAgo from "./lib/utils.ts";
import { EVENT_DISPLAY } from "./lib/eventMeta.ts";
import { getCareUrgency } from "./lib/careStatus.ts";
import { subscribeToHouseholdChanges } from "./lib/realtime.ts";
import {
  clearHouseholdSnapshot,
  loadHouseholdSnapshot,
  saveHouseholdSnapshot,
} from "./lib/offlineCache.ts";
import { copyText } from "./lib/clipboard.ts";
import { canAddAnotherDog } from "./lib/planLimits.ts";
import { buildWeeklyReport } from "./lib/weeklyReport.ts";
import { buildHealthBaseline } from "./lib/healthBaseline.ts";
import { isDemoDog } from "./lib/demoData.ts";
import { AccountError, deleteAccount } from "./lib/account.ts";
import {
  accountExportFilename,
  buildAccountExportCsv,
} from "./lib/accountExport.ts";
import {
  addComment,
  deleteComment,
  listEventSocial,
  toggleReaction,
} from "./lib/eventSocialApi.ts";
import {
  listCompletions,
  listSchedules,
  setTaskCompletion,
  updateSchedule,
} from "./lib/scheduleApi.ts";
import {
  getTodayPlan,
  toLocalDateKey,
  type TodayTask,
} from "./lib/schedules.ts";
import {
  getMemberLabel,
  isHouseholdOwner,
  sortHouseholdMembers,
} from "./lib/householdMembers.ts";
import {
  BillingError,
  getBillingSummary,
  openBillingPortal,
  startCheckout,
} from "./lib/billing.ts";
import type { BillingPlan, BillingSummary } from "./types/billing.ts";
import type { HouseholdMemberView } from "./screens/HouseholdScreen.tsx";

type SessionClaims = {
  sub: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
};

type Screen =
  | "home"
  | "logEvent"
  | "addDog"
  | "dogProfile"
  | "household"
  | "pricing"
  | "legal"
  | "account"
  | "profile"
  | "weeklyReport"
  | "schedules"
  | "insights";

function detectRecoveryRedirect(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  return (
    url.searchParams.get("type") === "recovery" ||
    hash.get("type") === "recovery"
  );
}

function SplashScreen({ message = "Loading your household…" }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="text-center">
        <h1 className="text-5xl font-bold font-fraunces text-warm-brown mb-2">
          Loggi
        </h1>
        <p className="text-sm text-text-muted">{message}</p>
      </div>
    </div>
  );
}

function FullScreenMessage({
  title,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream p-6">
      <div className="w-full max-w-sm rounded-3xl border border-warm-brown/10 bg-white p-6 text-center shadow-sm">
        <div className="mb-3 text-4xl" aria-hidden="true">
          🐾
        </div>
        <h1 className="mb-2 text-xl font-bold font-fraunces text-warm-brown">
          {title}
        </h1>
        <p className="mb-5 text-sm text-text-muted">{message}</p>
        <button
          type="button"
          onClick={onAction}
          className="w-full rounded-xl bg-warm-brown py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          {actionLabel}
        </button>
        {secondaryLabel && onSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            className="mt-3 w-full rounded-xl border border-warm-brown/20 py-3 text-sm font-medium text-warm-brown hover:bg-light-tan"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function AppChrome({
  children,
  errorMessage,
  onDismissError,
  noticeMessage,
  onDismissNotice,
  currentScreen,
  displayName,
  email,
  avatarUrl,
  householdName,
  onNavigate,
  onLogout,
}: {
  children: ReactNode;
  errorMessage: string | null;
  onDismissError: () => void;
  noticeMessage?: string | null;
  onDismissNotice?: () => void;
  currentScreen: Screen;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  householdName?: string;
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
}) {
  const activeTab: NavTab =
    currentScreen === "insights" || currentScreen === "weeklyReport"
      ? "insights"
      : currentScreen === "schedules"
        ? "schedules"
        : currentScreen === "profile" || currentScreen === "account"
          ? "profile"
          : "home";

  return (
    <>
      <AppHeader
        displayName={displayName}
        email={email}
        avatarUrl={avatarUrl}
        householdName={householdName}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />
      {children}
      <BottomNav active={activeTab} onNavigate={onNavigate} />
      <OfflineBanner />
      {noticeMessage && onDismissNotice && (
        <NoticeToast message={noticeMessage} onDismiss={onDismissNotice} />
      )}
      <ErrorToast message={errorMessage} onDismiss={onDismissError} />
    </>
  );
}

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("home");
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [events, setEvents] = useState<CareEvent[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [reactions, setReactions] = useState<EventReaction[]>([]);
  const [comments, setComments] = useState<EventComment[]>([]);
  const [schedules, setSchedules] = useState<CareSchedule[]>([]);
  const [completions, setCompletions] = useState<CareTaskCompletion[]>([]);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const [claims, setClaims] = useState<SessionClaims | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [household, setHousehold] = useState<Household | null>(null);
  const [householdLoading, setHouseholdLoading] = useState(true);
  const [householdError, setHouseholdError] = useState<string | null>(null);
  const [dogsLoading, setDogsLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [quickToiletDogId, setQuickToiletDogId] = useState<string | null>(null);
  const [quickLogPending, setQuickLogPending] = useState<string | null>(null);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [confirmDeleteEventId, setConfirmDeleteEventId] = useState<
    string | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(
    detectRecoveryRedirect,
  );
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(
    null,
  );
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const currentUserIdRef = useRef<string | null>(null);
  const hasLoadedDataRef = useRef(false);

  const currentUserId = claims?.sub ?? "";
  const isHouseholdOwnerUser =
    household !== null &&
    (members.length > 0
      ? isHouseholdOwner(members, currentUserId)
      : household.createdBy === currentUserId);

  const isPremium = billingSummary?.entitlement.isEntitled ?? false;
  const canAddDog = canAddAnotherDog(
    isPremium,
    dogs.length,
    billingSummary !== null,
  );

  const dogInsightCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const dog of dogs) {
      counts[dog.dogId] = buildHealthBaseline(
        dog,
        events.filter((event) => event.dogId === dog.dogId),
        weightLogs.filter((weight) => weight.dogId === dog.dogId),
      ).insights.filter(
        (insight) =>
          insight.kind !== "logging" && insight.severity !== "info",
      ).length;
    }
    return counts;
  }, [dogs, events, weightLogs]);

  const memberViews = useMemo<HouseholdMemberView[]>(
    () =>
      sortHouseholdMembers(members).map((member) => ({
        userId: member.userId,
        displayName: member.displayName?.trim() || "Household member",
        role: member.role,
        status: member.status,
        joinedAt: member.joinedAt ?? null,
      })),
    [members],
  );

  const resetDomainState = useCallback(() => {
    setDogs([]);
    setEvents([]);
    setWeightLogs([]);
    setReactions([]);
    setComments([]);
    setSchedules([]);
    setCompletions([]);
    setMembers([]);
    setHousehold(null);
    setSelectedDogId(null);
    setBillingSummary(null);
    setBillingError(null);
    setDataError(null);
    setHouseholdError(null);
    setDogsLoading(true);
    setEventsLoading(true);
    setHouseholdLoading(true);
    setCurrentScreen("home");
    hasLoadedDataRef.current = false;
  }, []);

  const loadHousehold = useCallback(async (userId: string) => {
    setHouseholdLoading(true);
    setHouseholdError(null);

    const isStale = () => currentUserIdRef.current !== userId;

    try {
      const { data: membership, error: membershipError } = await supabase
        .from("HouseholdMember")
        .select("householdId")
        .eq("userId", userId)
        .eq("status", "active")
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (isStale()) return;

      if (!membership) {
        setHousehold(null);
        setHouseholdLoading(false);
        return;
      }

      const { data: householdData, error: householdLookupError } = await supabase
        .from("Household")
        .select()
        .eq("id", membership.householdId)
        .maybeSingle();

      if (householdLookupError) throw householdLookupError;
      if (isStale()) return;

      setHousehold((householdData as Household | null) ?? null);
    } catch (error) {
      if (isStale()) return;
      console.error("Error loading household:", error);
      setHousehold(null);
      setHouseholdError(
        "We couldn't load your household. Check your connection and try again.",
      );
    } finally {
      if (!isStale()) setHouseholdLoading(false);
    }
  }, []);

  const loadHouseholdData = useCallback(
    async (activeHousehold: Household, userId: string) => {
      const isInitialLoad = !hasLoadedDataRef.current;
      if (isInitialLoad) {
        setDogsLoading(true);
        setEventsLoading(true);
      }
      setDataError(null);

      const isStale = () =>
        Boolean(userId) && currentUserIdRef.current !== userId;

      try {
        const { data: dogsData, error: dogsError } = await supabase
          .from("Dogs")
          .select()
          .eq("householdId", activeHousehold.id);

        if (dogsError) throw dogsError;
        if (isStale()) return;

        const nextDogs = (dogsData ?? []) as Dog[];
        setDogs(nextDogs);

        const dogIds = nextDogs.map((dog) => dog.dogId);
        let nextEvents: CareEvent[] = [];
        let nextWeights: WeightLog[] = [];

        if (dogIds.length > 0) {
          const { data: eventsData, error: eventsError } = await supabase
            .from("DogEvent")
            .select()
            .in("dogId", dogIds);

          if (eventsError) throw eventsError;
          if (isStale()) return;
          nextEvents = (eventsData ?? []) as CareEvent[];
          setEvents(nextEvents);

          const { data: weightData, error: weightError } = await supabase
            .from("WeightLog")
            .select()
            .in("dogId", dogIds);

          if (weightError) throw weightError;
          if (isStale()) return;
          nextWeights = (weightData ?? []) as WeightLog[];
          setWeightLogs(nextWeights);
        } else {
          setEvents([]);
          setWeightLogs([]);
        }

        const eventIds = nextEvents.map((event) => event.id);
        const social = await listEventSocial(eventIds);
        setReactions(social.reactions);
        setComments(social.comments);

        const nextSchedules = await listSchedules(activeHousehold.id);
        setSchedules(nextSchedules);
        if (nextSchedules.length > 0) {
          const today = new Date();
          const weekAgo = new Date(today);
          weekAgo.setDate(today.getDate() - 7);
          const dateKey = (date: Date) =>
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          const nextCompletions = await listCompletions(
            nextSchedules.map((schedule) => schedule.id),
            dateKey(weekAgo),
            dateKey(today),
          );
          setCompletions(nextCompletions);
        } else {
          setCompletions([]);
        }

        const { data: memberData, error: memberError } = await supabase
          .from("HouseholdMember")
          .select(
            "householdId,userId,role,status,joinedAt,displayName",
          )
          .eq("householdId", activeHousehold.id);

        if (isStale()) return;
        if (memberError) {
          console.error("Error loading household members:", memberError);
          setErrorMessage(
            "Couldn't load the household member list. Pull to refresh or try again.",
          );
        } else {
          setMembers((memberData ?? []) as HouseholdMember[]);
        }

        if (userId) {
          saveHouseholdSnapshot(userId, {
            dogs: nextDogs,
            events: nextEvents,
            weightLogs: nextWeights,
          });
        }

        hasLoadedDataRef.current = true;
      } catch (error) {
        if (isStale()) return;
        console.error("Error loading household data:", error);

        if (hasLoadedDataRef.current) {
          setErrorMessage(
            "Couldn't refresh the latest care data. Your saved view is still shown.",
          );
          return;
        }

        const cached = userId ? loadHouseholdSnapshot(userId) : null;
        if (cached) {
          setDogs(cached.dogs);
          setEvents(cached.events);
          setWeightLogs(cached.weightLogs);
          hasLoadedDataRef.current = true;
          setErrorMessage(
            "You're offline. Showing the last data saved on this device.",
          );
        } else {
          setDataError(
            "We couldn't load your care history. Check your connection and try again.",
          );
        }
      } finally {
        if (!isStale()) {
          setDogsLoading(false);
          setEventsLoading(false);
        }
      }
    },
    [],
  );

  const loadBilling = useCallback(async (activeHousehold: Household) => {
    setBillingLoading(true);
    setBillingError(null);
    try {
      const summary = await getBillingSummary(activeHousehold.id);
      setBillingSummary(summary);
    } catch (error) {
      console.error("Error loading billing:", error);
      setBillingSummary(null);
      setBillingError(
        error instanceof BillingError
          ? error.message
          : "Couldn't load your plan. Please try again.",
      );
    } finally {
      setBillingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsInitializing(false);
      return;
    }

    let cancelled = false;

    async function initialiseAuth() {
      try {
        const { data, error } = await supabase.auth.getClaims();
        if (cancelled) return;
        if (error) {
          console.error("Error reading session:", error);
          setClaims(null);
          return;
        }
        const sub = data?.claims?.sub;
        const metadata =
          (data?.claims as { user_metadata?: Record<string, unknown> } | undefined)
            ?.user_metadata ?? {};
        const nextClaims: SessionClaims | null = sub
          ? {
              sub,
              email: data?.claims?.email ?? undefined,
              displayName:
                typeof metadata.display_name === "string"
                  ? metadata.display_name
                  : typeof metadata.full_name === "string"
                    ? metadata.full_name
                    : undefined,
              avatarUrl:
                typeof metadata.avatar_url === "string"
                  ? metadata.avatar_url
                  : undefined,
            }
          : null;
        currentUserIdRef.current = nextClaims?.sub ?? null;
        setClaims(nextClaims);
      } catch (error) {
        console.error("Error initialising auth:", error);
        if (!cancelled) setClaims(null);
      } finally {
        if (!cancelled) setIsInitializing(false);
      }
    }

    void initialiseAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
      }
      if (event === "USER_UPDATED") {
        setIsPasswordRecovery(false);
      }
      if (event === "SIGNED_OUT") {
        const previousUserId = currentUserIdRef.current;
        if (previousUserId) clearHouseholdSnapshot(previousUserId);
        currentUserIdRef.current = null;
        setClaims(null);
        resetDomainState();
        return;
      }

      const metadata = session?.user?.user_metadata ?? {};
      const nextClaims: SessionClaims | null = session?.user
        ? {
            sub: session.user.id,
            email: session.user.email ?? undefined,
            displayName:
              typeof metadata.display_name === "string"
                ? metadata.display_name
                : typeof metadata.full_name === "string"
                  ? metadata.full_name
                  : undefined,
            avatarUrl:
              typeof metadata.avatar_url === "string"
                ? metadata.avatar_url
                : undefined,
          }
        : null;
      const nextUserId = nextClaims?.sub ?? null;
      if (nextUserId !== currentUserIdRef.current) {
        currentUserIdRef.current = nextUserId;
        if (nextUserId) resetDomainState();
      }
      setClaims(nextClaims);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [resetDomainState]);

  useEffect(() => {
    if (!claims?.sub) {
      setHousehold(null);
      setHouseholdLoading(false);
      return;
    }
    void loadHousehold(claims.sub);
  }, [claims?.sub, loadHousehold]);

  useEffect(() => {
    if (!household) return;
    void loadHouseholdData(household, claims?.sub ?? "");
    void loadBilling(household);
  }, [household, claims?.sub, loadHouseholdData, loadBilling]);

  useEffect(() => {
    if (!household) return;

    let refreshTimer: number | undefined;
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        void loadHouseholdData(household, claims?.sub ?? "");
      }, 400);
    };

    const unsubscribe = subscribeToHouseholdChanges(scheduleRefresh);
    const handleFocus = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      unsubscribe();
      window.clearTimeout(refreshTimer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [household, claims?.sub, loadHouseholdData]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (checkout === "success") {
      setNoticeMessage(
        "Payment received. Your plan will appear in a moment — refresh if it doesn't.",
      );
    } else if (checkout === "cancelled") {
      setNoticeMessage("Checkout cancelled. No charge was made.");
    }

    if (checkout) {
      params.delete("checkout");
      params.delete("session_id");
      const query = params.toString();
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}${
          window.location.hash
        }`,
      );
    }
  }, []);

  useEffect(() => {
    if (!noticeMessage) return;
    const timeout = window.setTimeout(() => setNoticeMessage(null), 7000);
    return () => window.clearTimeout(timeout);
  }, [noticeMessage]);

  function changeScreen(screen: Screen) {
    setCurrentScreen(screen);
  }

  function getDogNameById(dogId: string): string {
    if (dogs.length === 0) return "No dog saved to profile";
    const matchingDog = dogs.find((dog) => dog.dogId === dogId);
    return matchingDog ? matchingDog.dogName : "Unknown Dog";
  }

  function getTheDogsLastEventTime(
    dogId: string,
    eventType: EventType,
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

  function getNumberOfEventsForDog(dogId: string): number {
    const today = new Date().toDateString();
    return events.filter(
      (event) =>
        event.dogId === dogId &&
        new Date(event.timestamp).toDateString() === today,
    ).length;
  }

  function handleViewProfile(dogId: string) {
    setSelectedDogId(dogId);
    changeScreen("dogProfile");
  }

  function handleDataFromChildNewEvent(careEvent: CareEvent) {
    setEvents((previousEvents) => [...previousEvents, careEvent]);
    setCurrentScreen("home");
  }

  function handleAddDogClick() {
    if (billingLoading) {
      setNoticeMessage("Checking your plan — please try again in a moment.");
      return;
    }

    if (!canAddDog) {
      setNoticeMessage(
        "Your free plan includes one dog. Upgrade to add more dogs to your pack.",
      );
      changeScreen("pricing");
      return;
    }
    changeScreen("addDog");
  }

  function handleDataFromChildNewDog() {
    if (household) {
      void loadHouseholdData(household, claims?.sub ?? "");
    }
    setCurrentScreen("home");
  }

  async function handleDeleteEvent(eventId: string) {
    const { error } = await supabase
      .from("DogEvent")
      .delete()
      .eq("id", eventId);
    if (error) {
      console.error("Error deleting event:", error);
      setErrorMessage("Failed to delete event. Please try again.");
      return;
    }
    setEvents((previousEvents) =>
      previousEvents.filter((event) => event.id !== eventId),
    );
    setReactions((previous) =>
      previous.filter((reaction) => reaction.eventId !== eventId),
    );
    setComments((previous) =>
      previous.filter((comment) => comment.eventId !== eventId),
    );
  }

  async function handleDeleteDog(dogId: string) {
    const { error } = await supabase.from("Dogs").delete().eq("dogId", dogId);
    if (error) {
      console.error("Error deleting dog:", error);
      setErrorMessage("Failed to delete dog. Please try again.");
      return;
    }

    setDogs((previousDogs) => previousDogs.filter((dog) => dog.dogId !== dogId));
    const removedEventIds = new Set(
      events.filter((event) => event.dogId === dogId).map((event) => event.id),
    );
    setEvents((previousEvents) =>
      previousEvents.filter((event) => event.dogId !== dogId),
    );
    setReactions((previous) =>
      previous.filter((reaction) => !removedEventIds.has(reaction.eventId)),
    );
    setComments((previous) =>
      previous.filter((comment) => !removedEventIds.has(comment.eventId)),
    );
    setWeightLogs((previousWeights) =>
      previousWeights.filter((weight) => weight.dogId !== dogId),
    );
    setCurrentScreen("home");
  }

  async function handleQuickLog(dogId: string, eventType: EventType) {
    if (!claims?.sub) return;

    if (eventType === "toilet") {
      setQuickToiletDogId(dogId);
      return;
    }

    const pendingKey = `${dogId}:${eventType}`;
    if (quickLogPending) return;
    setQuickLogPending(pendingKey);

    const newEvent: CareEvent = {
      id: crypto.randomUUID(),
      dogId,
      type: eventType,
      timestamp: new Date().toISOString(),
      userId: claims.sub,
    };

    try {
      const { error } = await supabase.from("DogEvent").insert({
        id: newEvent.id,
        dogId,
        type: eventType,
        timestamp: newEvent.timestamp,
        userId: newEvent.userId,
        note: null,
      });

      if (error) throw error;
      setEvents((previousEvents) => [...previousEvents, newEvent]);
    } catch (error) {
      console.error("Error inserting quick event:", error);
      setErrorMessage("Couldn't save that event. Please try again.");
    } finally {
      setQuickLogPending(null);
    }
  }

  async function handleQuickToilet(
    dogId: string,
    subtype: "pee" | "poo",
    isAccident = false,
  ) {
    if (!claims?.sub) return;
    if (quickLogPending) return;
    setQuickLogPending(`${dogId}:toilet`);

    const newEvent: CareEvent = {
      id: crypto.randomUUID(),
      dogId,
      type: "toilet",
      subtype,
      isAccident,
      pottyOutcome: isAccident ? "accident" : "success",
      timestamp: new Date().toISOString(),
      userId: claims.sub,
    };

    try {
      const { error } = await supabase.from("DogEvent").insert({
        id: newEvent.id,
        dogId,
        type: "toilet",
        subtype,
        isAccident,
        pottyOutcome: newEvent.pottyOutcome ?? null,
        timestamp: newEvent.timestamp,
        userId: newEvent.userId,
        note: null,
      });

      if (error) throw error;
      setEvents((previousEvents) => [...previousEvents, newEvent]);
      setQuickToiletDogId(null);
    } catch (error) {
      console.error("Error inserting quick toilet event:", error);
      setErrorMessage("Couldn't save that toilet event. Please try again.");
    } finally {
      setQuickLogPending(null);
    }
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
      setErrorMessage("Couldn't sign out. Please try again.");
      return;
    }
    if (currentUserId) clearHouseholdSnapshot(currentUserId);
    resetDomainState();
  }

  async function refreshAccountClaims() {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return;
    const metadata = user.user_metadata ?? {};
    setClaims({
      sub: user.id,
      email: user.email ?? undefined,
      displayName:
        typeof metadata.display_name === "string"
          ? metadata.display_name
          : typeof metadata.full_name === "string"
            ? metadata.full_name
            : undefined,
      avatarUrl:
        typeof metadata.avatar_url === "string"
          ? metadata.avatar_url
          : undefined,
    });
  }

  async function handleCopyInviteCode(): Promise<boolean> {
    if (!household) return false;
    const copied = await copyText(household.inviteCode);
    if (!copied) {
      setErrorMessage(
        "Couldn't copy the invite code. Show it and copy it manually.",
      );
    }
    return copied;
  }

  async function handleRenameHousehold(name: string) {
    const { error } = await supabase.rpc("rename_household", {
      p_name: name.trim(),
    });
    if (error) {
      console.error("Error renaming household:", error);
      setErrorMessage("Couldn't rename the household. Please try again.");
      return;
    }
    setHousehold((current) =>
      current ? { ...current, name: name.trim() } : current,
    );
  }

  async function handleRegenerateInviteCode() {
    const { data, error } = await supabase.rpc("regenerate_invite_code");
    if (error) {
      console.error("Error regenerating invite code:", error);
      setErrorMessage("Couldn't generate a new invite code. Please try again.");
      return;
    }
    if (typeof data === "string" && data.length > 0) {
      setHousehold((current) =>
        current ? { ...current, inviteCode: data } : current,
      );
      setErrorMessage(null);
    }
  }

  async function handleRemoveMember(userId: string) {
    const { error } = await supabase.rpc("remove_household_member", {
      p_user_id: userId,
    });
    if (error) {
      console.error("Error removing household member:", error);
      setErrorMessage("Couldn't remove that member. Please try again.");
      return;
    }
    if (household) {
      void loadHouseholdData(household, claims?.sub ?? "");
    }
  }

  async function handleLeaveHousehold() {
    const { error } = await supabase.rpc("leave_household");
    if (error) {
      console.error("Error leaving household:", error);
      setErrorMessage("Couldn't leave the household. Please try again.");
      return;
    }
    if (currentUserId) clearHouseholdSnapshot(currentUserId);
    resetDomainState();
    setHouseholdLoading(false);
    setCurrentScreen("home");
  }

  async function handleSelectPlan(plan: BillingPlan) {
    setBillingLoading(true);
    setBillingError(null);
    try {
      const { url } = await startCheckout(plan);
      window.location.assign(url);
    } catch (error) {
      console.error("Error starting checkout:", error);
      setBillingError(
        error instanceof BillingError
          ? error.message
          : "Couldn't open checkout. Please try again.",
      );
    } finally {
      setBillingLoading(false);
    }
  }

  async function handleManageBilling() {
    setBillingLoading(true);
    setBillingError(null);
    try {
      const { url } = await openBillingPortal();
      window.location.assign(url);
    } catch (error) {
      console.error("Error opening billing portal:", error);
      setBillingError(
        error instanceof BillingError
          ? error.message
          : "Couldn't open the billing portal. Please try again.",
      );
    } finally {
      setBillingLoading(false);
    }
  }

  function handleExportAllData() {
    const eventLabels = Object.fromEntries(
      Object.entries(EVENT_DISPLAY).map(([type, meta]) => [type, meta.label]),
    ) as Record<string, string>;

    const csv = buildAccountExportCsv(
      dogs,
      events,
      weightLogs,
      eventLabels,
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = accountExportFilename();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleDeleteAccount(): Promise<boolean> {
    setIsDeletingAccount(true);
    setErrorMessage(null);

    try {
      await deleteAccount();

      if (currentUserId) clearHouseholdSnapshot(currentUserId);
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch (error) {
        console.warn("Local sign-out after account deletion failed:", error);
      }
      setClaims(null);
      resetDomainState();
      setCurrentScreen("home");
      return true;
    } catch (error) {
      console.error("Error deleting account:", error);
      setErrorMessage(
        error instanceof AccountError
          ? error.message
          : "Couldn't delete your account. Please try again.",
      );
      return false;
    } finally {
      setIsDeletingAccount(false);
    }
  }

  async function handleTakeTask(task: TodayTask) {
    if (!currentUserId) return;
    try {
      await updateSchedule(task.schedule.id, { assignedTo: currentUserId });
      setSchedules((previous) =>
        previous.map((schedule) =>
          schedule.id === task.schedule.id
            ? { ...schedule, assignedTo: currentUserId }
            : schedule,
        ),
      );
      setNoticeMessage(`You’re on ${task.schedule.title.toLowerCase()}.`);
    } catch (error) {
      console.error("Error taking task:", error);
      setErrorMessage("Couldn't assign that task. Please try again.");
    }
  }

  async function handleToggleTask(task: TodayTask, done: boolean) {
    if (!currentUserId) return;
    const dueDate = toLocalDateKey(new Date(task.dueAt));

    try {
      await setTaskCompletion(
        task.schedule.id,
        dueDate,
        done,
        currentUserId,
      );
      if (done) {
        setCompletions((previous) => [
          ...previous.filter(
            (completion) =>
              !(
                completion.scheduleId === task.schedule.id &&
                completion.dueDate === dueDate
              ),
          ),
          {
            id: crypto.randomUUID(),
            scheduleId: task.schedule.id,
            dueDate,
            completedBy: currentUserId,
            completedAt: new Date().toISOString(),
          },
        ]);
      } else {
        setCompletions((previous) =>
          previous.filter(
            (completion) =>
              !(
                completion.scheduleId === task.schedule.id &&
                completion.dueDate === dueDate
              ),
          ),
        );
      }
    } catch (error) {
      console.error("Error updating task completion:", error);
      setErrorMessage("Couldn't update that task. Please try again.");
    }
  }

  async function handleToggleReaction(eventId: string, emoji: string) {
    if (!currentUserId) return;
    const existing = reactions.find(
      (reaction) =>
        reaction.eventId === eventId &&
        reaction.userId === currentUserId &&
        reaction.emoji === emoji,
    );

    try {
      await toggleReaction(eventId, currentUserId, emoji, !existing);
      setReactions((previous) =>
        existing
          ? previous.filter(
              (reaction) =>
                !(
                  reaction.eventId === eventId &&
                  reaction.userId === currentUserId &&
                  reaction.emoji === emoji
                ),
            )
          : [
              ...previous,
              {
                eventId,
                userId: currentUserId,
                emoji,
                createdAt: new Date().toISOString(),
              },
            ],
      );
    } catch (error) {
      console.error("Error toggling reaction:", error);
      setErrorMessage("Couldn't save that reaction. Please try again.");
    }
  }

  async function handleAddComment(eventId: string, body: string) {
    if (!currentUserId) return;
    try {
      const comment = await addComment(eventId, currentUserId, body);
      setComments((previous) => [...previous, comment]);
    } catch (error) {
      console.error("Error adding comment:", error);
      setErrorMessage("Couldn't add that comment. Please try again.");
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      await deleteComment(commentId);
      setComments((previous) =>
        previous.filter((comment) => comment.id !== commentId),
      );
    } catch (error) {
      console.error("Error deleting comment:", error);
      setErrorMessage("Couldn't delete that comment. Please try again.");
    }
  }

  const handlePasswordUpdated = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <FullScreenMessage
        title="Configuration needed"
        message={envErrorMessage}
        actionLabel="Reload"
        onAction={() => window.location.reload()}
      />
    );
  }

  const chromeProps = {
    currentScreen,
    displayName:
      claims?.displayName?.trim() ||
      claims?.email?.split("@")[0] ||
      "You",
    email: claims?.email,
    avatarUrl: claims?.avatarUrl,
    householdName: household?.name,
    onNavigate: changeScreen,
    onLogout: () => void handleSignOut(),
  };

  if (isInitializing || (claims && householdLoading)) {
    return <SplashScreen />;
  }

  if (isPasswordRecovery) {
    return (
      <AuthScreen
        initialView="update_password"
        onPasswordUpdated={handlePasswordUpdated}
      />
    );
  }

  if (!claims) {
    return <AuthScreen />;
  }

  if (householdError && !household) {
    return (
      <FullScreenMessage
        title="Couldn't load your household"
        message={householdError}
        actionLabel="Try again"
        onAction={() => void loadHousehold(claims.sub)}
        secondaryLabel="Sign out"
        onSecondary={() => void handleSignOut()}
      />
    );
  }

  if (!household) {
    if (currentScreen === "profile") {
      return (
        <AppChrome
          {...chromeProps}
          errorMessage={errorMessage}
          onDismissError={() => setErrorMessage(null)}
        >
          <ProfileSettingsScreen
            onBack={() => changeScreen("home")}
            onUpdated={() => void refreshAccountClaims()}
          />
        </AppChrome>
      );
    }

    return (
      <HouseholdSetupScreen
        userIdInDB={claims.sub}
        onOpenProfile={() => changeScreen("profile")}
        onHouseholdReady={(readyHousehold) => {
          setHousehold(readyHousehold);
          setHouseholdLoading(false);
        }}
      />
    );
  }

  if (currentScreen === "home") {
    if (dogsLoading || eventsLoading) {
      return <SplashScreen message="Loading your household…" />;
    }

    if (dataError) {
      return (
        <FullScreenMessage
          title="Couldn't load your care history"
          message={dataError}
          actionLabel="Try again"
          onAction={() =>
            void loadHouseholdData(household, claims.sub ?? "")
          }
        />
      );
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

    return (
      <AppChrome
        {...chromeProps}
        errorMessage={errorMessage}
        onDismissError={() => setErrorMessage(null)}
        noticeMessage={noticeMessage}
        onDismissNotice={() => setNoticeMessage(null)}
      >
        <div className="mb-5">
          <p className="text-xs font-medium tracking-wide text-text-muted">
            {new Date().getHours() < 12
              ? "Good morning"
              : new Date().getHours() < 18
                ? "Good afternoon"
                : "Good evening"}
          </p>
          <h1 className="mt-1 text-[2.15rem] font-bold leading-tight font-fraunces text-warm-brown">
            Here’s today
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>

        <OnboardingChecklist
          dogs={dogs}
          events={events}
          schedules={schedules}
          members={members}
          weightLogs={weightLogs}
          onNavigate={changeScreen}
        />

        <OnDutyCard
          tasks={getTodayPlan(schedules, completions)}
          members={members}
          currentUserId={currentUserId}
          onTakeTask={(task) => void handleTakeTask(task)}
          onOpenPlan={() => changeScreen("schedules")}
        />

        {dogs.length > 0 && (
          <div className="mb-5">
            <TodayPlan
              tasks={getTodayPlan(schedules, completions)}
              dogs={dogs.map((dog) => ({
                dogId: dog.dogId,
                dogName: dog.dogName,
              }))}
              members={members}
              currentUserId={currentUserId}
              onToggle={(task, done) => void handleToggleTask(task, done)}
              onAddSchedule={() => changeScreen("schedules")}
            />
          </div>
        )}

        <InsightsSummaryCard
          dogs={dogs}
          events={events}
          weightLogs={weightLogs}
          onOpenInsights={() => changeScreen("insights")}
        />

        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Your household
            </p>
            <h2 className="font-fraunces text-xl font-bold text-warm-brown">
              The dogs
            </h2>
          </div>
          {canAddDog && (
            <button
              type="button"
              onClick={handleAddDogClick}
              className="rounded-xl border border-warm-brown/20 px-3 py-2 text-xs font-semibold text-warm-brown hover:bg-light-tan"
            >
              + Add a dog
            </button>
          )}
        </div>

        <div className="mb-7 flex flex-col gap-4">
          {dogs.length === 0 ? (
            <div className="rounded-3xl border border-warm-brown/10 bg-white p-5 text-center">
              <p className="text-3xl" aria-hidden="true">
                🐾
              </p>
              <h2 className="mt-2 font-fraunces text-lg font-bold text-warm-brown">
                Start with your dog
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                Add a name, a breed and a photo. You can fill in the rest later.
              </p>
              <button
                type="button"
                onClick={handleAddDogClick}
                className="mt-4 rounded-xl bg-warm-brown px-4 py-2.5 text-sm font-semibold text-white"
              >
                Add your first dog
              </button>
            </div>
          ) : (
            dogs.map((dog) => {
              const lastFedTimestamp = getTheDogsLastEventTime(dog.dogId, "feed");
              const lastWalkTimestamp = getTheDogsLastEventTime(dog.dogId, "walk");
              const lastToiletTimestamp = getTheDogsLastEventTime(dog.dogId, "toilet");
              const lastMedsTimestamp = getTheDogsLastEventTime(dog.dogId, "meds");

              return (
                <DogStatusCard
                  key={dog.dogId}
                  dogName={dog.dogName}
                  dogImage={dog.dogImage}
                  insightCount={dogInsightCounts[dog.dogId]}
                  isDemo={isDemoDog(dog)}
                  lastFedHours={
                    lastFedTimestamp
                      ? getTimeAgo(lastFedTimestamp)
                      : "Nothing recorded yet."
                  }
                  numOfEventsToday={getNumberOfEventsForDog(dog.dogId)}
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
                  feedUrgency={getCareUrgency(lastFedTimestamp, "feed")}
                  walkUrgency={getCareUrgency(lastWalkTimestamp, "walk")}
                  toiletUrgency={getCareUrgency(lastToiletTimestamp, "toilet")}
                  medsUrgency={getCareUrgency(lastMedsTimestamp, "meds")}
                  quickLogPending={quickLogPending}
                  onLogEvent={() => {
                    setSelectedDogId(dog.dogId);
                    changeScreen("logEvent");
                  }}
                  onQuickLog={(eventType) =>
                    void handleQuickLog(dog.dogId, eventType)
                  }
                />
              );
            })
          )}
        </div>

        {dogs.length > 0 && todaysEvents.length > 0 && (
          <section className="mb-2">
            <div className="mb-3 flex items-end justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  Lately
                </p>
                <h2 className="font-fraunces text-xl font-bold text-warm-brown">
                  Recent activity
                </h2>
              </div>
              {todaysEvents.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllActivity((value) => !value)}
                  className="text-xs font-semibold text-warm-brown underline underline-offset-2"
                >
                  {showAllActivity ? "Show less" : `View all ${todaysEvents.length}`}
                </button>
              )}
            </div>

            <div className="space-y-2">
              {(showAllActivity ? todaysEvents : todaysEvents.slice(0, 3)).map(
                (event) => {
                  const eventReactions = reactions.filter(
                    (reaction) => reaction.eventId === event.id,
                  );
                  const eventComments = comments.filter(
                    (comment) => comment.eventId === event.id,
                  );

                  return (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-warm-brown/10 bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-text-dark">
                            {getDogNameById(event.dogId)} ·{" "}
                            {EVENT_DISPLAY[event.type]?.label ?? event.type}
                            {event.type === "toilet" &&
                              event.subtype &&
                              ` ${event.subtype === "pee" ? "💧" : event.subtype === "poo" ? "💩" : ""}`}
                            {event.type === "toilet" &&
                              event.pottyOutcome === "success" &&
                              " ✅"}
                            {(event.isAccident ||
                              event.pottyOutcome === "accident") &&
                              " ⚠️"}
                          </p>
                          <p className="mt-0.5 text-xs text-text-muted">
                            {getMemberLabel(members, event.userId, currentUserId)} ·{" "}
                            {getTimeAgo(event.timestamp)}
                          </p>
                        </div>
                        {(isHouseholdOwnerUser ||
                          event.userId === currentUserId) && (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteEventId(event.id)}
                            aria-label="Delete event"
                            className="shrink-0 rounded-lg p-1 text-xs text-rose-400 hover:text-rose-600"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <details className="mt-2">
                        <summary className="cursor-pointer list-none text-xs font-medium text-warm-brown">
                          {eventReactions.length > 0 || eventComments.length > 0
                            ? `${eventReactions.length} reactions · ${eventComments.length} comments`
                            : "React or leave a note"}
                        </summary>
                        <EventReactions
                          eventId={event.id}
                          reactions={eventReactions}
                          comments={eventComments}
                          currentUserId={currentUserId}
                          members={members}
                          isOwner={isHouseholdOwnerUser}
                          onToggleReaction={(eventId, emoji) =>
                            void handleToggleReaction(eventId, emoji)
                          }
                          onAddComment={(eventId, body) =>
                            void handleAddComment(eventId, body)
                          }
                          onDeleteComment={(commentId) =>
                            void handleDeleteComment(commentId)
                          }
                        />
                      </details>
                    </div>
                  );
                },
              )}
            </div>
          </section>
        )}

        <footer className="mt-8 flex flex-wrap justify-center gap-x-3 gap-y-2 border-t border-warm-brown/10 pt-4 text-[11px] text-text-muted">
          <button
            type="button"
            onClick={() => window.open("https://forms.gle/cMtnvK4MEdMrGmyH6", "_blank")}
            className="hover:text-warm-brown"
          >
            Send feedback
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => changeScreen("legal")}
            className="hover:text-warm-brown"
          >
            Privacy & terms
          </button>
        </footer>

        {confirmDeleteEventId && (
          <Modal
            title="Delete this event?"
            description="This action cannot be undone."
            onClose={() => setConfirmDeleteEventId(null)}
            size="sm"
            footer={
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void handleDeleteEvent(confirmDeleteEventId);
                    setConfirmDeleteEventId(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteEventId(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-warm-brown border border-warm-brown/20 hover:bg-light-tan transition-colors"
                >
                  Cancel
                </button>
              </div>
            }
          >
            <p className="text-sm text-text-muted">
              This removes the care event from the household history.
            </p>
          </Modal>
        )}

        {quickToiletDogId && (
          <Modal
            title={`Quick log toilet for ${getDogNameById(quickToiletDogId)}`}
            description="Choose what happened."
            onClose={() => setQuickToiletDogId(null)}
            size="sm"
          >
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() => void handleQuickToilet(quickToiletDogId, "pee")}
                disabled={Boolean(quickLogPending)}
                className="py-4 rounded-xl bg-yellow-50 hover:bg-yellow-100 border-2 border-yellow-200 active:scale-95 transition-all disabled:opacity-50"
              >
                <div className="text-3xl mb-1">💧</div>
                <div className="text-sm font-semibold text-yellow-800">
                  Pee
                </div>
              </button>

              <button
                type="button"
                onClick={() => void handleQuickToilet(quickToiletDogId, "poo")}
                disabled={Boolean(quickLogPending)}
                className="py-4 rounded-xl bg-yellow-50 hover:bg-yellow-100 border-2 border-yellow-200 active:scale-95 transition-all disabled:opacity-50"
              >
                <div className="text-3xl mb-1">💩</div>
                <div className="text-sm font-semibold text-yellow-800">
                  Poo
                </div>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() =>
                  void handleQuickToilet(quickToiletDogId, "pee", true)
                }
                disabled={Boolean(quickLogPending)}
                className="py-3 rounded-xl bg-rose-50 hover:bg-rose-100 border-2 border-rose-200 active:scale-95 transition-all disabled:opacity-50"
              >
                <div className="text-sm font-semibold text-rose-700">
                  💧 Accident
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  void handleQuickToilet(quickToiletDogId, "poo", true)
                }
                disabled={Boolean(quickLogPending)}
                className="py-3 rounded-xl bg-rose-50 hover:bg-rose-100 border-2 border-rose-200 active:scale-95 transition-all disabled:opacity-50"
              >
                <div className="text-sm font-semibold text-rose-700">
                  💩 Accident
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setQuickToiletDogId(null)}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-warm-brown border border-warm-brown/20 hover:bg-light-tan transition-colors"
            >
              Cancel
            </button>
          </Modal>
        )}

      </AppChrome>
    );
  }

  if (currentScreen === "logEvent") {
    return (
      <AppChrome
        {...chromeProps}
        errorMessage={errorMessage}
        onDismissError={() => setErrorMessage(null)}
      >
        <button
          type="button"
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
      </AppChrome>
    );
  }

  if (currentScreen === "addDog") {
    return (
      <AppChrome
        {...chromeProps}
        errorMessage={errorMessage}
        onDismissError={() => setErrorMessage(null)}
      >
        <button
          type="button"
          onClick={() => changeScreen("home")}
          className="mb-6 px-4 py-2 rounded-lg bg-warm-brown text-white font-bold"
        >
          Home
        </button>
        <RegisterNewDogScreen
          householdId={household.id}
          onSubmitDog={handleDataFromChildNewDog}
        />
      </AppChrome>
    );
  }

  if (currentScreen === "dogProfile") {
    const selectedDog = dogs.find((dog) => dog.dogId === selectedDogId);
    const selectedDogEvents = events.filter(
      (event) => event.dogId === selectedDogId,
    );

    if (!selectedDog) {
      return (
        <FullScreenMessage
          title="Dog not found"
          message="This dog may have been removed from the household."
          actionLabel="Back home"
          onAction={() => changeScreen("home")}
        />
      );
    }

    return (
      <AppChrome
        {...chromeProps}
        errorMessage={errorMessage}
        onDismissError={() => setErrorMessage(null)}
      >
        <button
          type="button"
          onClick={() => changeScreen("home")}
          className="flex items-center gap-1.5 text-sm font-medium text-warm-brown mb-6 hover:opacity-70 transition-opacity"
        >
          ← Back
        </button>
        <DogProfileScreen
          dog={selectedDog}
          events={selectedDogEvents}
          weightLogs={weightLogs.filter(
            (weight) => weight.dogId === selectedDogId,
          )}
          onSave={() =>
            void loadHouseholdData(household, claims.sub ?? "")
          }
          householdId={household.id}
          userIdInDB={claims.sub}
          isOwner={isHouseholdOwnerUser}
          reactions={reactions}
          comments={comments}
          members={members}
          onToggleReaction={(eventId, emoji) =>
            void handleToggleReaction(eventId, emoji)
          }
          onAddComment={(eventId, body) =>
            void handleAddComment(eventId, body)
          }
          onDeleteComment={(commentId) =>
            void handleDeleteComment(commentId)
          }
          onDeleteEvent={handleDeleteEvent}
          onDeleteDog={handleDeleteDog}
          onWeightLogged={() =>
            void loadHouseholdData(household, claims.sub ?? "")
          }
        />
      </AppChrome>
    );
  }

  if (currentScreen === "household") {
    return (
      <AppChrome
        {...chromeProps}
        errorMessage={errorMessage}
        onDismissError={() => setErrorMessage(null)}
      >
        <HouseholdScreen
          householdName={household.name}
          inviteCode={household.inviteCode}
          currentUserId={currentUserId}
          isOwner={isHouseholdOwnerUser}
          members={memberViews}
          isLoading={false}
          error={null}
          onBack={() => changeScreen("home")}
          onCopyCode={handleCopyInviteCode}
          onRename={handleRenameHousehold}
          onRegenerateCode={handleRegenerateInviteCode}
          onRemoveMember={handleRemoveMember}
          onLeave={handleLeaveHousehold}
        />
      </AppChrome>
    );
  }

  if (currentScreen === "pricing") {
    return (
      <AppChrome
        {...chromeProps}
        errorMessage={errorMessage}
        onDismissError={() => setErrorMessage(null)}
      >
        <PricingScreen
          currentPlan={billingSummary?.entitlement.plan ?? null}
          isEntitled={billingSummary?.entitlement.isEntitled ?? false}
          isOwner={billingSummary?.isOwner ?? isHouseholdOwnerUser}
          isLoading={billingLoading}
          error={billingError}
          onSelectPlan={(plan) => void handleSelectPlan(plan)}
          onManageBilling={() => void handleManageBilling()}
          onRetry={() => void loadBilling(household)}
          onBack={() => changeScreen("home")}
        />
      </AppChrome>
    );
  }

  if (currentScreen === "schedules") {
    return (
      <AppChrome
        {...chromeProps}
        errorMessage={errorMessage}
        onDismissError={() => setErrorMessage(null)}
      >
        <SchedulesScreen
          householdId={household.id}
          dogs={dogs}
          members={members}
          currentUserId={currentUserId}
          schedules={schedules}
          onChanged={() =>
            void loadHouseholdData(household, claims.sub ?? "")
          }
          onBack={() => changeScreen("home")}
        />
      </AppChrome>
    );
  }

  if (currentScreen === "weeklyReport") {
    return (
      <AppChrome
        {...chromeProps}
        errorMessage={errorMessage}
        onDismissError={() => setErrorMessage(null)}
      >
        <button
          type="button"
          onClick={() => changeScreen("home")}
          className="mb-6 flex items-center gap-1.5 text-sm font-medium text-warm-brown hover:opacity-70"
        >
          ← Back
        </button>
        <WeeklyReport
          report={buildWeeklyReport(dogs, events, weightLogs)}
        />
      </AppChrome>
    );
  }

  if (currentScreen === "insights") {
    return (
      <AppChrome
        {...chromeProps}
        errorMessage={errorMessage}
        onDismissError={() => setErrorMessage(null)}
      >
        <InsightsScreen
          dogs={dogs}
          events={events}
          weightLogs={weightLogs}
          householdId={household.id}
          userId={claims.sub}
          onAddDog={handleAddDogClick}
        />
      </AppChrome>
    );
  }

  if (currentScreen === "profile") {
    return (
      <AppChrome
        {...chromeProps}
        errorMessage={errorMessage}
        onDismissError={() => setErrorMessage(null)}
      >
        <ProfileSettingsScreen
          onBack={() => changeScreen("account")}
          onOpenAccount={() => changeScreen("account")}
          onUpdated={() => {
            void loadHouseholdData(household, claims.sub ?? "");
            void refreshAccountClaims();
          }}
        />
      </AppChrome>
    );
  }

  if (currentScreen === "account") {
    return (
      <AppChrome
        {...chromeProps}
        errorMessage={errorMessage}
        onDismissError={() => setErrorMessage(null)}
      >
        <AccountScreen
          email={claims.email ?? ""}
          householdName={household.name}
          planLabel={
            billingSummary?.entitlement.plan
              ? billingSummary.entitlement.plan.charAt(0).toUpperCase() +
                billingSummary.entitlement.plan.slice(1)
              : "Free"
          }
          isOwner={isHouseholdOwnerUser}
          isEntitled={billingSummary?.entitlement.isEntitled ?? false}
          isDeleting={isDeletingAccount}
          onExport={handleExportAllData}
          onDelete={handleDeleteAccount}
          onBack={() => changeScreen("home")}
          onOpenProfile={() => changeScreen("profile")}
        />
      </AppChrome>
    );
  }

  if (currentScreen === "legal") {
    return (
      <AppChrome
        {...chromeProps}
        errorMessage={errorMessage}
        onDismissError={() => setErrorMessage(null)}
      >
        <LegalScreen onBack={() => changeScreen("home")} />
      </AppChrome>
    );
  }

  return (
    <FullScreenMessage
      title="Unknown screen"
      message="Something went wrong while navigating. Go back home and try again."
      actionLabel="Back home"
      onAction={() => changeScreen("home")}
    />
  );
}

export default App;
