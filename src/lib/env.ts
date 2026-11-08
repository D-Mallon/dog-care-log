type AppEnv = {
  supabaseUrl: string | undefined;
  supabasePublishableKey: string | undefined;
  appUrl: string | undefined;
};

function readEnv(): AppEnv {
  return {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
    supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
      | string
      | undefined,
    appUrl: import.meta.env.VITE_APP_URL as string | undefined,
  };
}

export const env = readEnv();

export const isSupabaseConfigured = Boolean(
  env.supabaseUrl && env.supabasePublishableKey,
);

export const envErrorMessage =
  "Loggi is missing its Supabase configuration. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your environment and reload.";

/**
 * Local development fallbacks keep module import from throwing when the env is
 * missing. The app renders a configuration screen instead of a blank page.
 */
export const supabaseUrl = env.supabaseUrl ?? "http://localhost:54321";
export const supabasePublishableKey =
  env.supabasePublishableKey ?? "missing-publishable-key";
