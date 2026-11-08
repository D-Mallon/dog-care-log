import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "../lib/supabase.ts";
import { useEffect, useState } from "react";

type AuthView =
  | "sign_in"
  | "sign_up"
  | "forgotten_password"
  | "update_password";

type AuthScreenProps = {
  initialView?: AuthView;
  onPasswordUpdated?: () => void;
};

export default function AuthScreen({
  initialView = "sign_in",
  onPasswordUpdated,
}: AuthScreenProps) {
  const [view, setView] = useState<AuthView>(initialView);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    // Supabase emits PASSWORD_RECOVERY while processing the reset redirect.
    // App also inspects the URL on mount because the event can fire before
    // this component exists.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setView("update_password");
      }
      if (event === "USER_UPDATED") {
        setView("sign_in");
        onPasswordUpdated?.();
      }
    });

    return () => subscription.unsubscribe();
  }, [onPasswordUpdated]);

  return (
    <div className="min-h-screen bg-cream bg-auth-pattern flex flex-col items-center justify-center p-8">
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-3xl bg-warm-brown flex items-center justify-center mx-auto mb-4 text-3xl">
          🐾
        </div>
        <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-1">
          welcome to
        </p>
        <h1 className="text-4xl font-bold font-fraunces text-warm-brown m-0">
          Loggi
        </h1>
        <p className="text-sm text-text-muted mt-2">
          Keep your pack happy and healthy
        </p>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-warm-brown/10 shadow-card">
        <Auth
          supabaseClient={supabase}
          view={view}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: "#7c5c3e",
                  brandAccent: "#a0785a",
                  brandButtonText: "white",
                  inputBackground: "#fdf6ee",
                  inputBorder: "rgba(124, 92, 62, 0.2)",
                  inputBorderFocus: "#7c5c3e",
                  inputBorderHover: "#a0785a",
                  inputText: "#3b2a1a",
                  inputLabelText: "#6f5946",
                  inputPlaceholder: "#8a6f58",
                },
                radii: {
                  borderRadiusButton: "12px",
                  buttonBorderRadius: "12px",
                  inputBorderRadius: "12px",
                },
                fonts: {
                  bodyFontFamily: "DM Sans, sans-serif",
                  buttonFontFamily: "DM Sans, sans-serif",
                  inputFontFamily: "DM Sans, sans-serif",
                  labelFontFamily: "DM Sans, sans-serif",
                },
              },
            },
          }}
          providers={[]}
        />
      </div>

      {view === "update_password" && (
        <button
          type="button"
          onClick={() => {
            setView("sign_in");
            onPasswordUpdated?.();
          }}
          className="mt-5 text-xs font-medium text-text-muted underline underline-offset-2 hover:text-warm-brown"
        >
          Cancel password update
        </button>
      )}
    </div>
  );
}
