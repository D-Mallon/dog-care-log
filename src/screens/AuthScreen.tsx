import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "../lib/supabase.ts";

export default function AuthScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--cream)",
        backgroundImage:
          "radial-gradient(ellipse at 20% 10%, rgba(232, 169, 106, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(143, 168, 136, 0.12) 0%, transparent 50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.25rem",
      }}
    >
      {/* Logo / header */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "20px",
            backgroundColor: "var(--warm-brown)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1rem",
            fontSize: "28px",
          }}
        >
          🐾
        </div>
        <p
          style={{
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: "0.25rem",
          }}
        >
          welcome to
        </p>
        <h1
          style={{
            fontFamily: "Fraunces, serif",
            fontSize: "2.25rem",
            fontWeight: 700,
            color: "var(--warm-brown)",
            margin: 0,
          }}
        >
          Dog Care Log
        </h1>
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: "0.875rem",
            marginTop: "0.5rem",
          }}
        >
          Keep your pack happy and healthy
        </p>
      </div>

      {/* Auth card */}
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "white",
          borderRadius: "1.5rem",
          padding: "2rem",
          border: "1px solid rgba(124, 92, 62, 0.1)",
          boxShadow: "0 4px 24px rgba(124, 92, 62, 0.08)",
        }}
      >
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
