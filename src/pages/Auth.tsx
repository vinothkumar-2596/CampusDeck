import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";
import { useApp } from "../lib/context";
import { send } from "../lib/api";
import { Field } from "../components/Fields";
import { SlideView } from "../components/SlideView";
import { makeDeck } from "../lib/model";
export default function Auth() {
  const { templates, authMode, refresh, user } = useApp(),
    [params] = useSearchParams(),
    navigate = useNavigate(),
    [register, setRegister] = useState(params.get("mode") === "register"),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const rawReturn = params.get("returnTo") || "/workspace",
    returnTo =
      rawReturn.startsWith("/") && !rawReturn.startsWith("//")
        ? rawReturn
        : "/workspace";
  const t = templates[0];
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send("/auth/" + (register ? "register" : "login"), {
        name,
        email,
        password,
      });
      await refresh();
      navigate(returnTo);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page container">
      <div className="auth-story">
        <span className="section-kicker">A HOME FOR YOUR BIG IDEAS</span>
        <h1>
          Start something
          <br />
          <em>worth presenting.</em>
        </h1>
        <p>
          Your presentations, your favourite designs,
          <br />
          and your next great idea. All in one place.
        </p>
        {t && (
          <div className="auth-deck">
            <SlideView template={t} slide={makeDeck(t).slides[0]} />
          </div>
        )}
        <div className="auth-points">
          <span>
            <Check size={16} />
            Save and revisit your work
          </span>
          <span>
            <Check size={16} />
            Keep your academic profile ready
          </span>
          <span>
            <Check size={16} />
            Download fully editable PowerPoints
          </span>
        </div>
      </div>
      <div className="auth-card">
        {user ? (
          <>
            <span className="pill">YOU’RE SIGNED IN</span>
            <h2>Welcome, {user.name}.</h2>
            <p>Your next presentation is waiting.</p>
            <Link className="btn btn-primary full-width" to={returnTo}>
              Continue to your workspace <ArrowRight size={16} />
            </Link>
          </>
        ) : (
          <>
            <div className="auth-symbol">
              <LockKeyhole size={23} />
            </div>
            <h2>
              {register ? "Make yourself at home." : "Good to have you back."}
            </h2>
            <p>
              {register
                ? "Create your free CampusDeck account."
                : "Sign in to pick up where you left off."}
            </p>
            {authMode === "platform" ? (
              <>
                <a
                  className="btn btn-primary full-width"
                  href={
                    "/signin-with-chatgpt?returnTo=" +
                    encodeURIComponent(returnTo)
                  }
                  target="_top"
                >
                  Continue with ChatGPT <ArrowRight size={17} />
                </a>
                <p className="auth-fineprint">
                  Secure sign-in keeps your presentations private and available
                  across devices.
                </p>
              </>
            ) : (
              <form onSubmit={submit}>
                {register && (
                  <Field
                    label="Your name"
                    required
                    value={name}
                    onChange={setName}
                    placeholder="How should we call you?"
                    maxLength={80}
                  />
                )}
                <Field
                  label="Email address"
                  type="email"
                  required
                  value={email}
                  onChange={setEmail}
                  placeholder="you@college.edu"
                  maxLength={200}
                />
                <label className="field">
                  <span>Password</span>
                  <div className="password-input">
                    <input
                      aria-label="Password"
                      type={visible ? "text" : "password"}
                      autoComplete={
                        register ? "new-password" : "current-password"
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={register ? 10 : 1}
                      maxLength={128}
                      placeholder={
                        register ? "At least 10 characters" : "Your password"
                      }
                      required
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={visible ? "Hide password" : "Show password"}
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </label>
                {error && (
                  <p role="alert" className="form-error">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  className="btn btn-primary full-width"
                  disabled={busy}
                >
                  {busy ? <LoaderCircle className="spin" size={17} /> : null}
                  {register ? "Create your account" : "Sign in"}
                  <ArrowRight size={17} />
                </button>
                <p className="auth-switch">
                  {register ? "Already have an account?" : "New here?"}{" "}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setRegister(!register);
                      setError("");
                    }}
                  >
                    {register ? "Sign in" : "Create an account"}
                  </button>
                </p>
              </form>
            )}
            <p className="auth-fineprint">
              By continuing, you agree to our{" "}
              <Link to="/terms">Terms of use</Link> and{" "}
              <Link to="/privacy">Privacy policy</Link>.
            </p>
          </>
        )}
        <Link className="auth-browse" to="/explore">
          Just browsing? Explore without an account <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
