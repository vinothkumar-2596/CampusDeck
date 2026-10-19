import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  GraduationCap,
  ImagePlus,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { useApp } from "../lib/context";
import {
  blankProfile,
  makeDeck,
  personalise,
  type Profile,
} from "../lib/model";
import { api, readImage, send } from "../lib/api";
import { Field, FormRow } from "../components/Fields";
import { SlideView } from "../components/SlideView";
import { Empty, Spinner } from "../components/Common";
export default function Customise() {
  const { id } = useParams(),
    [params] = useSearchParams(),
    navigate = useNavigate(),
    { templates, user, toast, loading } = useApp(),
    [step, setStep] = useState(0),
    [profile, setProfile] = useState<Profile>({ ...blankProfile }),
    [values, setValues] = useState<Record<string, string>>({}),
    [saveProfile, setSaveProfile] = useState(true),
    [busy, setBusy] = useState(false);
  const t = templates.find((x) => x.id === id);
  const deck = useMemo(() => {
    if (!t) return null;
    const value = personalise(makeDeck(t), values, profile);
    const theme = Number(params.get("theme"));
    if (
      params.has("theme") &&
      Number.isInteger(theme) &&
      theme >= 0 &&
      theme <= 2
    )
      value.theme = theme;
    return value;
  }, [t, values, profile, params]);
  useEffect(() => {
    if (user)
      api<Profile | null>("/profile")
        .then((p) => {
          if (p) setProfile(p);
        })
        .catch(() => {});
  }, [user]);
  const p = (key: keyof Profile, value: string) =>
      setProfile((prev) => ({ ...prev, [key]: value })),
    v = (key: string, value: string) =>
      setValues((prev) => ({ ...prev, [key]: value }));
  const finish = async () => {
    if (!deck || !t) return;
    setBusy(true);
    try {
      if (user && saveProfile) await send("/profile", profile, "PUT");
      sessionStorage.setItem(
        `campus-draft-${user?.id || "guest"}-${deck.id}`,
        JSON.stringify(deck),
      );
      navigate("/editor/" + deck.id, {
        state: { deck, ownerId: user?.id || null },
      });
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (loading) return <Spinner />;
  if (!t || !deck)
    return (
      <Empty
        title="Choose a template first."
        description="Your perfect starting point is waiting in the collection."
        action={
          <Link className="btn btn-primary" to="/explore">
            Explore templates
          </Link>
        }
      />
    );
  return (
    <div className="container customise-page">
      <div className="breadcrumbs">
        <Link to={"/templates/" + t.id}>{t.name}</Link>
        <ChevronRight size={12} />
        <span>Make it yours</span>
      </div>
      <div className="customise-heading">
        <span className="section-kicker">A LITTLE ABOUT YOUR BIG IDEA</span>
        <h1>Your story. Beautifully presented.</h1>
        <p>
          Add the details that make this presentation yours. You can edit
          everything later.
        </p>
      </div>
      <div className="customise-layout">
        <div>
          <div className="form-steps">
            {["Your project", "Your people", "Your content"].map((s, i) => (
              <button
                key={s}
                className={step === i ? "active" : step > i ? "done" : ""}
                onClick={() => setStep(i)}
              >
                <span>{step > i ? <Check size={14} /> : i + 1}</span>
                {s}
              </button>
            ))}
          </div>
          <div className="customise-form">
            {step === 0 ? (
              <>
                <h2>Let’s start with the essentials.</h2>
                <p>
                  A title, a college, and the beginning of a great presentation.
                </p>
                <Field
                  label="Presentation title"
                  value={values.title || ""}
                  onChange={(val) => v("title", val)}
                  placeholder={t.cover.replace(/\n/g, " ")}
                  maxLength={160}
                  hint="Leave blank to keep the sample title."
                />
                <Field
                  label="College / organisation name"
                  value={profile.college}
                  onChange={(val) => p("college", val)}
                  placeholder="Your college or organisation"
                />
                <FormRow>
                  <Field
                    label="Department"
                    value={profile.department}
                    onChange={(val) => p("department", val)}
                    placeholder="e.g. Computer Science"
                    maxLength={100}
                  />
                  <Field
                    label="Degree / course"
                    value={profile.degree}
                    onChange={(val) => p("degree", val)}
                    placeholder="e.g. B.E. / B.Tech"
                    maxLength={80}
                  />
                </FormRow>
                <Field
                  label="University (optional)"
                  value={profile.university}
                  onChange={(val) => p("university", val)}
                  placeholder="University name"
                />
                <label className="upload-zone compact">
                  <ImagePlus size={23} />
                  <div>
                    <strong>
                      {profile.logo
                        ? "Replace your college logo"
                        : "Add your college logo"}
                    </strong>
                    <span>
                      PNG or JPEG · up to 10 MB, resized automatically
                    </span>
                  </div>
                  <input
                    aria-label="Upload college logo"
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        try {
                          p("logo", await readImage(f));
                        } catch (err) {
                          toast((err as Error).message);
                        }
                    }}
                  />
                  {profile.logo && (
                    <img src={profile.logo} alt="College logo" />
                  )}
                </label>
              </>
            ) : step === 1 ? (
              <>
                <h2>Give your team the credit.</h2>
                <p>Make the people behind the work part of the story.</p>
                <Field
                  label="Student / team names"
                  value={profile.students}
                  onChange={(val) => p("students", val)}
                  placeholder="Add names, separated by commas"
                  maxLength={250}
                />
                <Field
                  label="Register numbers"
                  value={profile.registerNumbers}
                  onChange={(val) => p("registerNumbers", val)}
                  placeholder="Your student register numbers"
                  maxLength={200}
                />
                <Field
                  label="Guide / supervisor"
                  value={profile.guide}
                  onChange={(val) => p("guide", val)}
                  placeholder="Guide or supervisor name"
                  maxLength={100}
                />
                <Field
                  label="Academic year"
                  value={profile.year}
                  onChange={(val) => p("year", val)}
                  placeholder="2026–2027"
                  maxLength={30}
                />
                {user && (
                  <label className="check-filter">
                    <input
                      type="checkbox"
                      checked={saveProfile}
                      onChange={(e) => setSaveProfile(e.target.checked)}
                    />
                    Save these details to my reusable academic profile
                  </label>
                )}
                <div className="form-note">
                  <GraduationCap size={20} />
                  <span>
                    These details appear on your opening slide. Your college
                    name carries through the rest of the presentation.
                  </span>
                </div>
              </>
            ) : (
              <>
                <h2>Bring your ideas into focus.</h2>
                <p>
                  Add what you have. Clear placeholders will remain for
                  everything else.
                </p>
                {[
                  ["abstract", "Abstract / introduction"],
                  ["problem", "Problem statement"],
                  ["objectives", "Objectives"],
                  ["methodology", "Methodology"],
                  ["technologies", "Technologies / architecture"],
                  ["implementation", "Implementation plan"],
                  ["results", "Verified results"],
                  ["conclusion", "Conclusion"],
                  ["future", "Future scope"],
                ].map(([key, label]) => (
                  <Field
                    key={key}
                    label={label}
                    multiline
                    value={values[key] || ""}
                    onChange={(val) => v(key, val)}
                    placeholder={"Add your " + label.toLowerCase() + "…"}
                    maxLength={2000}
                    hint={
                      key === "results"
                        ? "Include only your own verified findings."
                        : "Put each key point on a new line."
                    }
                  />
                ))}
              </>
            )}
            <div className="form-navigation">
              {step > 0 ? (
                <button
                  className="btn btn-outline"
                  onClick={() => setStep(step - 1)}
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              ) : (
                <Link to={"/templates/" + t.id} className="text-link">
                  <ArrowLeft size={15} />
                  Back to template
                </Link>
              )}
              {step < 2 ? (
                <button
                  className="btn btn-primary"
                  onClick={() => setStep(step + 1)}
                >
                  Continue <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => void finish()}
                  disabled={busy}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  Open in editor
                </button>
              )}
            </div>
            {step < 2 && (
              <button
                className="skip-editor link-button"
                onClick={() => void finish()}
                disabled={busy}
              >
                I’ll add the details in the editor <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
        <aside className="customise-preview">
          <div className="preview-sticky">
            <div className="live-preview-label">
              <span className="status-dot" />
              YOUR LIVE PREVIEW<span>01 / 16</span>
            </div>
            <SlideView template={t} deck={deck} slide={deck.slides[0]} />
            <div className="preview-description">
              <span className="pill">{t.style}</span>
              <h3>{t.name}</h3>
              <p>
                Your details are added as you type.
                <br />
                Fine-tune every slide in the next step.
              </p>
            </div>
            <div className="preview-small-slides">
              {deck.slides.slice(3, 5).map((s, i) => (
                <SlideView
                  key={s.id}
                  template={t}
                  deck={deck}
                  slide={s}
                  index={i + 3}
                />
              ))}
            </div>
            <div className="form-note">
              <Check size={17} />
              <span>
                Nothing gets invented. Missing details stay as clearly labelled
                placeholders.
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
