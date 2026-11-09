import { supabase } from "./supabase.ts";

export class AccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountError";
  }
}

async function readErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  if (typeof error === "object" && error !== null) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload: unknown = await context.clone().json();
        if (
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof (payload as { error?: unknown }).error === "string"
        ) {
          return (payload as { error: string }).error;
        }
      } catch {
        // Fall through to the FunctionsError message.
      }
    }

    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
}

/**
 * Permanently delete the signed-in user's account.
 *
 * The Edge Function cancels any open subscription, removes the household (if
 * the caller is a sole owner), deletes memberships and billing mappings, then
 * deletes the auth user. It refuses to delete an owner who still has other
 * household members.
 */
export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke("delete-account");

  if (error) {
    throw new AccountError(
      await readErrorMessage(
        error,
        "Couldn't delete your account. Please try again.",
      ),
    );
  }

  if (
    typeof data !== "object" ||
    data === null ||
    (data as { deleted?: unknown }).deleted !== true
  ) {
    throw new AccountError(
      "Account deletion did not complete. Please contact support.",
    );
  }
}
