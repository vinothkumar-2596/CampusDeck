import { useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
} from "lucide-react";
import { useApp } from "../lib/context";
import { send } from "../lib/api";
import { Logo } from "../components/Shell";
import { MiniSlide } from "./Home";
export default function Auth() {
  const { templates, authMode, refresh, user } = useApp();
  const [params] = useSearchParams();
  const location = useLocation(),
    navigate = useNavigate();
  const register =
    location.pathname === "/sign-up" ||
    (location.pathname === "/auth" && params.get("mode") === "register");
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const rawReturn = params.get("returnTo") || "/workspace";
  const returnTo =
    rawReturn.startsWith("/") &&
    !rawReturn.startsWith("//") &&
    !rawReturn.includes("\\")
      ? rawReturn
      : "/workspace";
  const returnQuery = `?returnTo=${encodeURIComponent(returnTo)}`;
  useEffect(() => {
    setError("");
    setPassword("");
    setVisible(false);
  }, [register]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await send("/auth/" + (register ? "register" : "login"), {
        name: name.trim(),
        email: email.trim(),
        password,
      });
      await refresh();
      navigate(returnTo);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cd-auth">
      <div className="cd-auth-left">
        <header className="cd-auth-header">
          <Logo />
          <Link className="cd-text-link" to="/templates">
            <ArrowLeft size={15} />
            Back to templates
          </Link>
        </header>
        <div className="cd-auth-main">
          <div className="cd-auth-form">
            {user ? (
              <>
                <span className="cd-eyebrow">You’re signed in</span>
                <h1>Welcome, {user.name}.</h1>
                <p>Your presentations and saved templates are ready.</p>
                <Link className="cd-btn cd-btn-primary" to={returnTo}>
                  Continue to your workspace
                  <ArrowRight size={17} />
                </Link>
              </>
            ) : (
              <>
                <nav className="cd-auth-tabs" aria-label="Account">
                  <Link
                    to={`/sign-in${returnQuery}`}
                    aria-current={!register ? "page" : undefined}
                    className={!register ? "active" : ""}
                  >
                    Sign in
                  </Link>
                  <Link
                    to={`/sign-up${returnQuery}`}
                    aria-current={register ? "page" : undefined}
                    className={register ? "active" : ""}
                  >
                    Create account
                  </Link>
                </nav>
                <div>
                  <h1>{register ? "Create your account" : "Welcome back"}</h1>
                  <p>
                    {register
                      ? "Save templates and keep your presentation details in one place."
                      : "Sign in to pick up where you left off."}
                  </p>
                </div>
                {authMode === "platform" ? (
                  <a
                    className="cd-btn cd-btn-primary"
                    href={`/signin-with-chatgpt?returnTo=${encodeURIComponent(returnTo)}`}
                    target="_top"
                  >
                    Continue with ChatGPT
                    <ArrowRight size={17} />
                  </a>
                ) : (
                  <form onSubmit={submit}>
                    {register && (
                      <label className="cd-auth-field">
                        <span>Your name</span>
                        <input
                          autoComplete="name"
                          aria-label="Your name"
                          required
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          placeholder="e.g. Kaaviya"
                          maxLength={80}
                        />
                      </label>
                    )}
                    <label className="cd-auth-field">
                      <span>Email address</span>
                      <input
                        type="email"
                        autoComplete="email"
                        aria-label="Email address"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@college.edu"
                        maxLength={200}
                      />
                    </label>
                    <label className="cd-auth-field">
                      <span>Password</span>
                      <span className="cd-password-input">
                        <input
                          aria-label="Password"
                          type={visible ? "text" : "password"}
                          autoComplete={
                            register ? "new-password" : "current-password"
                          }
                          required
                          minLength={register ? 10 : 1}
                          maxLength={128}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder={
                            register
                              ? "At least 10 characters"
                              : "Your password"
                          }
                        />
                        <button
                          type="button"
                          className="cd-icon-button"
                          aria-label={
                            visible ? "Hide password" : "Show password"
                          }
                          aria-pressed={visible}
                          onClick={() => setVisible(!visible)}
                        >
                          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </span>
                      {register && (
                        <small>
                          Use at least 10 characters for a strong password.
                        </small>
                      )}
                    </label>
                    {error && (
                      <p className="form-error" role="alert">
                        {error}
                      </p>
                    )}
                    <button
                      className="cd-btn cd-btn-primary"
                      type="submit"
                      disabled={busy}
                    >
                      {busy && <LoaderCircle size={17} className="spin" />}
                      {register ? "Create your account" : "Sign in"}
                      <ArrowRight size={17} />
                    </button>
                    <p className="cd-auth-switch">
                      {register
                        ? "Already have an account?"
                        : "New to CampusDeck?"}{" "}
                      <Link
                        to={`${register ? "/sign-in" : "/sign-up"}${returnQuery}`}
                      >
                        {register ? "Sign in" : "Create an account"}
                      </Link>
                    </p>
                  </form>
                )}
                <p className="cd-auth-fineprint">
                  By continuing, you agree to our{" "}
                  <Link to="/terms">Terms of use</Link> and{" "}
                  <Link to="/privacy">Privacy policy</Link>.
                </p>
              </>
            )}
            <Link className="cd-auth-browse" to="/templates">
              Explore without an account
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
      <aside className="cd-auth-showcase">
        <div>
          <span className="cd-eyebrow">
            Your next presentation, considered.
          </span>
          <h2>A better starting point for your best work.</h2>
          <p>
            From the first review to the final viva, keep your presentations and
            ideas together.
          </p>
          <ul>
            {[
              "Save templates for each project and review",
              "Keep your title, team and guide ready to reuse",
              "Download editable PowerPoint and PDF presentations",
            ].map((point) => (
              <li key={point}>
                <Check size={18} />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="cd-auth-slides" aria-hidden="true">
          {["atlas", "halcyon", "tropic"].map((id, index) => (
            <div key={id}>
              <MiniSlide
                template={
                  templates.find((t) => t.id === id) || templates[index]
                }
              />
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
