import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "../lib/supabase.ts";

export default function AuthScreen() {
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
                  inputLabelText: "#9a7f6a",
                  inputPlaceholder: "#c4a882",
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
    </div>
  );
}
