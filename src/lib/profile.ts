import { supabase } from "./supabase.ts";
import type { UserPreference } from "../types/core.ts";

export const MIN_PASSWORD_LENGTH = 8;

export type ProfilePreferences = Pick<
  UserPreference,
  "emailReminders" | "weeklySummary" | "productUpdates" | "timezone"
>;

export type AccountUser = {
  userId: string;
  email: string;
  displayName: string;
};

const DEFAULT_TIMEZONE = "Europe/Dublin";

export function currentTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export function defaultPreferences(): ProfilePreferences {
  return {
    emailReminders: false,
    weeklySummary: false,
    productUpdates: false,
    timezone: currentTimezone(),
  };
}

export function validateDisplayName(value: string): string | null {
  const name = value.trim();
  if (name.length < 1) return "Enter a display name.";
  if (name.length > 80) return "Display name must be 80 characters or fewer.";
  return null;
}

export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return "Enter an email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Enter a valid email address.";
  }
  return null;
}

export function validatePasswordChange(
  currentPassword: string,
  newPassword: string,
  confirmation: string,
): string | null {
  if (!currentPassword) return "Enter your current password.";
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (newPassword !== confirmation) return "New passwords do not match.";
  if (newPassword === currentPassword) {
    return "New password must be different from your current password.";
  }
  return null;
}

export async function loadAccountUser(): Promise<AccountUser> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const user = data.user;
  if (!user) throw new Error("You are not signed in.");

  const metadata = user.user_metadata ?? {};
  const rawName =
    metadata.display_name ?? metadata.full_name ?? metadata.name ?? "";
  const fallbackName = user.email?.split("@")[0] ?? "Member";

  return {
    userId: user.id,
    email: user.email ?? "",
    displayName: String(rawName || fallbackName).trim() || "Member",
  };
}

export async function updateDisplayName(name: string): Promise<void> {
  const validation = validateDisplayName(name);
  if (validation) throw new Error(validation);

  const { error } = await supabase.rpc("update_display_name", {
    p_name: name.trim(),
  });
  if (error) throw error;
}

export async function loadPreferences(
  userId: string,
): Promise<ProfilePreferences> {
  const { data, error } = await supabase
    .from("UserPreference")
    .select("*")
    .eq("userId", userId)
    .maybeSingle();

  if (error) throw error;
  if (data) {
    const preference = data as UserPreference;
    return {
      emailReminders: preference.emailReminders,
      weeklySummary: preference.weeklySummary,
      productUpdates: preference.productUpdates,
      timezone: preference.timezone || currentTimezone(),
    };
  }

  const defaults = defaultPreferences();
  const { data: inserted, error: insertError } = await supabase
    .from("UserPreference")
    .insert({ userId, ...defaults })
    .select("*")
    .single();

  if (insertError) throw insertError;
  const preference = inserted as UserPreference;
  return {
    emailReminders: preference.emailReminders,
    weeklySummary: preference.weeklySummary,
    productUpdates: preference.productUpdates,
    timezone: preference.timezone || defaults.timezone,
  };
}

export async function savePreferences(
  userId: string,
  preferences: ProfilePreferences,
): Promise<void> {
  const { error } = await supabase.from("UserPreference").upsert(
    {
      userId,
      emailReminders: preferences.emailReminders,
      weeklySummary: preferences.weeklySummary,
      productUpdates: preferences.productUpdates,
      timezone: preferences.timezone || currentTimezone(),
      updatedAt: new Date().toISOString(),
    },
    { onConflict: "userId" },
  );
  if (error) throw error;
}

export async function requestEmailChange(email: string): Promise<void> {
  const validation = validateEmail(email);
  if (validation) throw new Error(validation);

  const { error } = await supabase.auth.updateUser({ email: email.trim() });
  if (error) throw error;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmation: string,
): Promise<void> {
  const validation = validatePasswordChange(
    currentPassword,
    newPassword,
    confirmation,
  );
  if (validation) throw new Error(validation);

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const email = data.user?.email;
  if (!email) throw new Error("No email address is attached to this account.");

  // Re-authenticate first so an unattended session cannot silently change the
  // password. This creates a fresh session for the same user.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (reauthError) {
    throw new Error("Current password is incorrect.");
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) throw updateError;

  // Keep this session, revoke other devices. Failure here should not make the
  // password change look unsuccessful.
  try {
    await supabase.auth.signOut({ scope: "others" });
  } catch {
    // Non-fatal: the password itself changed successfully.
  }
}

export async function signOutOtherSessions(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) throw error;
}
