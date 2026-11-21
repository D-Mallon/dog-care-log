import type { ReactNode } from "react";
import type { Screen } from "../types/navigation.ts";
import AppHeader from "./AppHeader.tsx";
import BottomNav, { type NavTab } from "./BottomNav.tsx";
import ErrorToast from "./ErrorToast.tsx";
import NoticeToast from "./NoticeToast.tsx";
import OfflineBanner from "./OfflineBanner.tsx";

type AppChromeProps = {
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
};

function activeTabFor(screen: Screen): NavTab {
  if (screen === "insights" || screen === "weeklyReport") return "insights";
  if (screen === "schedules") return "schedules";
  if (screen === "profile" || screen === "account") return "profile";
  return "home";
}

export default function AppChrome({
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
}: AppChromeProps) {
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
      <BottomNav active={activeTabFor(currentScreen)} onNavigate={onNavigate} />
      <OfflineBanner />
      {noticeMessage && onDismissNotice && (
        <NoticeToast message={noticeMessage} onDismiss={onDismissNotice} />
      )}
      <ErrorToast message={errorMessage} onDismiss={onDismissError} />
    </>
  );
}
