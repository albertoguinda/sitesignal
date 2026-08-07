import { useState } from "react";
import { Activity, Mail, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { requestMagicLink } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await requestMagicLink(email);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send magic link");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base p-4">
        <div className="w-full max-w-md">
          <div className="panel p-8 text-center">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-ok-wash">
              <Mail className="size-8 text-ok" />
            </div>
            <h1 className="text-xl font-semibold text-ink">Check your email</h1>
            <p className="mt-2 text-sm text-ink-muted">
              We sent a magic link to <span className="font-medium text-ink">{email}</span>
            </p>
            <p className="mt-4 text-xs text-ink-faint">
              Didn't receive it? Check your spam folder or{" "}
              <button
                type="button"
                onClick={() => setSuccess(false)}
                className="text-brand hover:underline"
              >
                try again
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-lg border border-brand/40 bg-brand-wash">
            <Activity className="size-6 text-brand" />
          </div>
          <h1 className="text-2xl font-bold text-ink">
            Site<span className="text-brand">Signal</span>
          </h1>
          <p className="mt-2 text-sm text-ink-muted">Industrial asset monitoring dashboard</p>
        </div>

        {/* Login Form */}
        <div className="panel p-6">
          <h2 className="text-lg font-semibold text-ink">Sign in</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Enter your email to receive a magic link. No password needed.
          </p>

          <form onSubmit={handleSubmit} className="mt-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink">
                Work email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder-ink-faint focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>

            {error && (
              <div className="mt-4 rounded-md bg-critical-wash p-3 text-sm text-critical">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !email}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-brand-contrast transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  Send magic link
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-ink-faint">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
