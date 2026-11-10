import { useEffect, useState } from "react";
import {
  changePassword,
  loadAccountUser,
  loadPreferences,
  requestEmailChange,
  savePreferences,
  signOutOtherSessions,
  updateDisplayName,
  validateEmail,
  validatePasswordChange,
  type AccountUser,
  type ProfilePreferences,
} from "../lib/profile.ts";

type ProfileSettingsScreenProps = {
  onBack: () => void;
  onOpenAccount: () => void;
  onUpdated: () => void;
};

const inputClass =
  "w-full rounded-xl border border-warm-brown/20 bg-cream px-3 py-2.5 text-sm text-text-dark focus:outline-none focus:border-warm-brown";
const labelClass =
  "mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted";

type Notice = { type: "success" | "error"; text: string } | null;

export default function ProfileSettingsScreen({
  onBack,
  onOpenAccount,
  onUpdated,
}: ProfileSettingsScreenProps) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [preferences, setPreferences] = useState<ProfilePreferences | null>(
    null,
  );
  const [displayName, setDisplayName] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [signingOutOthers, setSigningOutOthers] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const account = await loadAccountUser();
        const prefs = await loadPreferences(account.userId);
        if (!active) return;
        setUser(account);
        setDisplayName(account.displayName);
        setPreferences(prefs);
      } catch (error) {
        console.error("Error loading profile:", error);
        if (active) {
          setNotice({
            type: "error",
            text: "Couldn't load your profile. Please reload and try again.",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  async function handleSaveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || savingName) return;
    setSavingName(true);
    setNotice(null);
    try {
      await updateDisplayName(displayName);
      setUser({ ...user, displayName: displayName.trim() });
      setDisplayName(displayName.trim());
      setNotice({ type: "success", text: "Display name updated." });
      onUpdated();
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Couldn't update your display name.",
      });
    } finally {
      setSavingName(false);
    }
  }

  async function handleEmailChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingEmail) return;
    const validation = validateEmail(newEmail);
    if (validation) {
      setNotice({ type: "error", text: validation });
      return;
    }
    setSavingEmail(true);
    setNotice(null);
    try {
      await requestEmailChange(newEmail);
      setEmailOpen(false);
      setNewEmail("");
      setNotice({
        type: "success",
        text: "Confirmation sent. Check the new inbox and follow the link before signing in with it.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Couldn't start the email change. Please try again.",
      });
    } finally {
      setSavingEmail(false);
    }
  }

  async function handlePasswordChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingPassword) return;
    const validation = validatePasswordChange(
      currentPassword,
      newPassword,
      confirmPassword,
    );
    if (validation) {
      setNotice({ type: "error", text: validation });
      return;
    }
    setSavingPassword(true);
    setNotice(null);
    try {
      await changePassword(currentPassword, newPassword, confirmPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice({
        type: "success",
        text: "Password updated. Other devices have been signed out.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Couldn't update your password. Please try again.",
      });
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSavePreferences() {
    if (!user || !preferences || savingPreferences) return;
    setSavingPreferences(true);
    setNotice(null);
    try {
      await savePreferences(user.userId, preferences);
      setNotice({
        type: "success",
        text: "Notification preferences saved.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Couldn't save your preferences.",
      });
    } finally {
      setSavingPreferences(false);
    }
  }

  async function handleSignOutOthers() {
    if (signingOutOthers) return;
    if (
      !window.confirm(
        "Sign out every other device? This device will stay signed in.",
      )
    ) {
      return;
    }
    setSigningOutOthers(true);
    setNotice(null);
    try {
      await signOutOtherSessions();
      setNotice({
        type: "success",
        text: "Other sessions have been signed out.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Couldn't sign out other sessions.",
      });
    } finally {
      setSigningOutOthers(false);
    }
  }

  if (loading) {
    return (
      <div className="pt-4">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 flex items-center gap-1.5 text-sm font-medium text-warm-brown hover:opacity-70"
        >
          ← Back
        </button>
        <p role="status" className="text-sm text-text-muted">
          Loading your profile…
        </p>
      </div>
    );
  }

  if (!user || !preferences) {
    return (
      <div className="pt-4">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 flex items-center gap-1.5 text-sm font-medium text-warm-brown hover:opacity-70"
        >
          ← Back
        </button>
        <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          {notice?.text ?? "Couldn't load your profile."}
        </p>
      </div>
    );
  }

  const initial = user.displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="pt-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 flex items-center gap-1.5 text-sm font-medium text-warm-brown hover:opacity-70"
      >
        ← Back
      </button>

      <div className="mb-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-text-muted">
          your account
        </p>
        <h1 className="text-4xl font-bold font-fraunces text-warm-brown">
          Your profile
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Update how you appear to your household and manage sign-in security.
        </p>
      </div>

      {notice && (
        <p
          role={notice.type === "error" ? "alert" : "status"}
          className={`mb-5 rounded-xl p-3 text-sm ${
            notice.type === "error"
              ? "bg-rose-50 text-rose-700"
              : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {notice.text}
        </p>
      )}

      <section className="mb-6 rounded-3xl border border-warm-brown/10 bg-white p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-light-tan font-fraunces text-xl font-bold text-warm-brown">
            {initial}
          </div>
          <div>
            <h2 className="font-fraunces text-lg font-bold text-warm-brown">
              Household identity
            </h2>
            <p className="text-xs text-text-muted">
              Shown as “Logged by …” to other members.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveName}>
          <label htmlFor="profile-display-name" className={labelClass}>
            Display name
          </label>
          <div className="flex gap-2">
            <input
              id="profile-display-name"
              value={displayName}
              maxLength={80}
              onChange={(event) => setDisplayName(event.target.value)}
              className={inputClass}
              autoComplete="nickname"
            />
            <button
              type="submit"
              disabled={savingName || displayName.trim() === user.displayName}
              className="shrink-0 rounded-xl bg-warm-brown px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
            >
              {savingName ? "Saving…" : "Save"}
            </button>
          </div>
        </form>

        <div className="mt-5 border-t border-warm-brown/10 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className={labelClass}>Email</p>
              <p className="text-sm font-medium text-text-dark">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEmailOpen((open) => !open);
                setNewEmail("");
              }}
              className="text-sm font-semibold text-warm-brown underline underline-offset-2 hover:opacity-70"
            >
              {emailOpen ? "Cancel" : "Change email"}
            </button>
          </div>

          {emailOpen && (
            <form onSubmit={handleEmailChange} className="mt-3">
              <label htmlFor="profile-new-email" className={labelClass}>
                New email
              </label>
              <div className="flex gap-2">
                <input
                  id="profile-new-email"
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  className={inputClass}
                  autoComplete="email"
                  required
                />
                <button
                  type="submit"
                  disabled={savingEmail}
                  className="shrink-0 rounded-xl bg-warm-brown px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
                >
                  {savingEmail ? "Sending…" : "Send link"}
                </button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-text-muted">
                A confirmation link is sent to the new address. The change is
                not active until you open it. Email delivery is still being
                configured, so if the link does not arrive, try again later.
              </p>
            </form>
          )}
        </div>
      </section>

      <section className="mb-6 rounded-3xl border border-warm-brown/10 bg-white p-5">
        <h2 className="mb-1 font-fraunces text-lg font-bold text-warm-brown">
          Notifications
        </h2>
        <p className="mb-4 text-xs leading-relaxed text-text-muted">
          These are saved now and will drive email reminders and summaries when
          email delivery is enabled.
        </p>

        <div className="space-y-3">
          {[
            {
              key: "emailReminders" as const,
              label: "Care reminders",
              detail: "Feeding, walks, toilet breaks and medication.",
            },
            {
              key: "weeklySummary" as const,
              label: "Weekly progress summary",
              detail: "A seven-day recap of care and potty progress.",
            },
            {
              key: "productUpdates" as const,
              label: "Product updates",
              detail: "Occasional news about new Loggi features.",
            },
          ].map((item) => (
            <label
              key={item.key}
              className="flex cursor-pointer items-start gap-3 rounded-xl bg-cream p-3"
            >
              <input
                type="checkbox"
                checked={preferences[item.key]}
                onChange={(event) =>
                  setPreferences({
                    ...preferences,
                    [item.key]: event.target.checked,
                  })
                }
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-warm-brown focus:ring-warm-brown"
              />
              <span>
                <span className="block text-sm font-medium text-text-dark">
                  {item.label}
                </span>
                <span className="block text-xs text-text-muted">
                  {item.detail}
                </span>
              </span>
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void handleSavePreferences()}
          disabled={savingPreferences}
          className="mt-4 w-full rounded-xl bg-warm-brown py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
        >
          {savingPreferences ? "Saving…" : "Save preferences"}
        </button>
      </section>

      <section className="mb-6 rounded-3xl border border-warm-brown/10 bg-white p-5">
        <h2 className="mb-1 font-fraunces text-lg font-bold text-warm-brown">
          Password
        </h2>
        <p className="mb-4 text-xs text-text-muted">
          Enter your current password to set a new one. Other devices will be
          signed out.
        </p>

        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label htmlFor="profile-current-password" className={labelClass}>
              Current password
            </label>
            <input
              id="profile-current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className={inputClass}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label htmlFor="profile-new-password" className={labelClass}>
              New password
            </label>
            <input
              id="profile-new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className={inputClass}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label htmlFor="profile-confirm-password" className={labelClass}>
              Confirm new password
            </label>
            <input
              id="profile-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={inputClass}
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={savingPassword}
            className="w-full rounded-xl border border-warm-brown/20 py-2.5 text-sm font-semibold text-warm-brown hover:bg-light-tan disabled:opacity-40"
          >
            {savingPassword ? "Updating…" : "Update password"}
          </button>
        </form>
      </section>

      <section className="mb-6 rounded-3xl border border-warm-brown/10 bg-white p-5">
        <h2 className="mb-1 font-fraunces text-lg font-bold text-warm-brown">
          Security
        </h2>
        <p className="mb-4 text-xs text-text-muted">
          Sign out of Loggi on any other phone, tablet or computer.
        </p>
        <button
          type="button"
          onClick={() => void handleSignOutOthers()}
          disabled={signingOutOthers}
          className="w-full rounded-xl border border-warm-brown/20 py-2.5 text-sm font-semibold text-warm-brown hover:bg-light-tan disabled:opacity-40"
        >
          {signingOutOthers ? "Signing out…" : "Sign out other sessions"}
        </button>
      </section>

      <button
        type="button"
        onClick={onOpenAccount}
        className="w-full rounded-2xl border border-warm-brown/10 bg-light-tan p-4 text-left hover:bg-cream"
      >
        <span className="block text-sm font-semibold text-warm-brown">
          Account & data →
        </span>
        <span className="mt-1 block text-xs text-text-muted">
          Export household data, review your plan, or delete your account.
        </span>
      </button>
    </div>
  );
}
