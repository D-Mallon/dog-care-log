import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "../lib/supabase.ts";

export default function AuthScreen() {
  return (
    <div>
      <h1>Dog Care Log</h1>
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={[]}
        // update providers to include Google and GitHub for easier testing
      />
    </div>
  );
}
