type SplashScreenProps = {
  message?: string;
};

export default function SplashScreen({
  message = "Loading your household…",
}: SplashScreenProps) {
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
