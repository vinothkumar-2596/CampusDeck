import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Clock,
  Copy,
  Download,
  FileSliders,
  GraduationCap,
  Grid2X2,
  ImagePlus,
  LoaderCircle,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { useApp } from "../lib/context";
import { api, readImage, send } from "../lib/api";
import {
  blankProfile,
  makeDeck,
  uid,
  type Deck,
  type Profile,
} from "../lib/model";
import { Empty, Modal, Spinner, TemplateCard } from "../components/Common";
import { SlideView } from "../components/SlideView";
import { Field, FormRow } from "../components/Fields";
type DownloadRecord = {
  id: string;
  title: string;
  template_id: string;
  format: "pptx" | "pdf";
  created_at: string;
};
const date = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export default function Workspace() {
  const {
      user,
      templates,
      loading,
      saved,
      refresh,
      toast,
      exportDeck,
      authMode,
    } = useApp(),
    navigate = useNavigate(),
    [params, setParams] = useSearchParams(),
    tab = params.get("tab") || "overview";
  const [projects, setProjects] = useState<Deck[]>([]),
    [downloads, setDownloads] = useState<DownloadRecord[]>([]),
    [profile, setProfile] = useState<Profile>({ ...blankProfile }),
    [fetching, setFetching] = useState(true),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(""),
    [remove, setRemove] = useState<Deck | null>(null),
    [rename, setRename] = useState<Deck | null>(null),
    [name, setName] = useState(""),
    [menu, setMenu] = useState("");
  const load = async () => {
    if (!user) return;
    setFetching(true);
    try {
      const [ps, ds, p] = await Promise.all([
        api<Deck[]>("/projects"),
        api<DownloadRecord[]>("/downloads"),
        api<Profile | null>("/profile"),
      ]);
      setProjects(ps);
      setDownloads(ds);
      if (p) setProfile(p);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFetching(false);
    }
  };
  useEffect(() => {
    void load();
  }, [user?.id]);
  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy("");
      setMenu("");
    }
  };
  if (loading) return <Spinner />;
  if (!user)
    return (
      <div className="container workspace-signin">
        <Empty
          title="A space for your next big idea."
          description="Sign in to save presentations, collect favourite designs, and keep your college profile ready."
          action={
            <Link className="btn btn-primary" to="/auth?returnTo=/workspace">
              Open your workspace <ArrowRight size={16} />
            </Link>
          }
        />
      </div>
    );
  const tabs = [
    ["overview", "Overview", Grid2X2],
    ["presentations", "My presentations", FileSliders],
    ["saved", "Saved templates", Bookmark],
    ["downloads", "Downloads", Download],
    ["profile", "Academic profile", GraduationCap],
    ["purchases", "Purchases", ShoppingBag],
    ["settings", "Account", Settings],
  ] as const;
  const visibleProjects = projects.filter((d) =>
    d.title.toLowerCase().includes(query.toLowerCase()),
  );
  const savedTemplates = templates.filter((t) => saved.includes(t.id));
  const projectCards = (items: Deck[]) =>
    items.length ? (
      <div className="template-grid workspace-grid">
        {items.map((d) => {
          const t =
            d.templateSnapshot || templates.find((t) => t.id === d.templateId);
          return (
            <article className="project-card" key={d.id}>
              <Link to={"/editor/" + d.id}>
                {t ? (
                  <SlideView deck={d} template={t} slide={d.slides[0]} />
                ) : (
                  <div className="unavailable-preview">Saved presentation</div>
                )}
              </Link>
              <div className="project-card-info">
                <div>
                  <Link to={"/editor/" + d.id}>
                    <h3>{d.title}</h3>
                  </Link>
                  <p>
                    {d.slides.length} slides <span>·</span> Edited{" "}
                    {date(d.updatedAt)}
                  </p>
                </div>
                <div className="project-menu">
                  <button
                    className="icon-btn"
                    aria-label={"Actions for " + d.title}
                    onClick={() => setMenu(menu === d.id ? "" : d.id)}
                  >
                    <MoreHorizontal size={20} />
                  </button>
                  {menu === d.id && (
                    <>
                      <button
                        className="dropdown-dismiss"
                        onClick={() => setMenu("")}
                        aria-label="Close presentation actions"
                      />
                      <div className="action-menu">
                        <Link to={"/editor/" + d.id}>
                          <Pencil size={14} />
                          Edit presentation
                        </Link>
                        <button
                          onClick={() => {
                            setRename(d);
                            setName(d.title);
                            setMenu("");
                          }}
                        >
                          <Pencil size={14} />
                          Rename
                        </button>
                        <button
                          onClick={() =>
                            void act(d.id, async () => {
                              const copy = {
                                ...structuredClone(d),
                                id: uid(),
                                title: d.title + " (copy)",
                              };
                              await send("/projects/" + copy.id, copy, "PUT");
                              await load();
                              toast("Presentation duplicated.");
                            })
                          }
                        >
                          <Copy size={14} />
                          Duplicate
                        </button>
                        <button
                          disabled={!t || !!busy}
                          onClick={() =>
                            void act(d.id, async () => {
                              if (t) await exportDeck(d, t);
                            })
                          }
                        >
                          <Download size={14} />
                          Download PPTX
                        </button>
                        <button
                          className="danger"
                          onClick={() => {
                            setRemove(d);
                            setMenu("");
                          }}
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    ) : (
      <Empty
        title={
          query
            ? "No presentations found."
            : "Your first great presentation starts here."
        }
        description={
          query
            ? "Try another search."
            : "Choose a template, make it yours, and it will appear here."
        }
        action={
          <Link to="/explore" className="btn btn-primary">
            Find a template <Plus size={16} />
          </Link>
        }
      />
    );
  return (
    <div className="workspace-layout container">
      <aside className="workspace-sidebar">
        <div className="workspace-user">
          <span className="avatar">{user.name.charAt(0).toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <small>Your creative space</small>
          </div>
        </div>
        <nav aria-label="Workspace">
          {tabs.map(([id, label, Icon]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => {
                setParams(id === "overview" ? {} : { tab: id });
                setQuery("");
              }}
            >
              <Icon size={18} />
              {label}
              {id === "presentations" && <small>{projects.length}</small>}
            </button>
          ))}
          {user.role === "admin" && (
            <Link to="/admin">
              <ShieldCheck size={18} />
              Administration
            </Link>
          )}
        </nav>
        <div className="workspace-sidebar-note">
          <span className="powerpoint-icon">P</span>
          <p>
            A little head start.
            <br />A lot of possibility.
          </p>
          <Link to="/explore">
            Find your next design <ArrowUpRight size={14} />
          </Link>
        </div>
      </aside>
      <section className="workspace-main">
        {error && (
          <div className="form-error" role="alert">
            {error}{" "}
            <button className="link-button" onClick={() => void load()}>
              Retry
            </button>
          </div>
        )}
        <div className="workspace-heading">
          <div>
            <span className="section-kicker">YOUR CAMPUSDECK</span>
            <h1>
              {tab === "overview"
                ? `Hello, ${user.name.split(" ")[0]}.`
                : tabs.find((t) => t[0] === tab)?.[1] || "Your workspace"}
            </h1>
            <p>
              {tab === "overview"
                ? "Your ideas, all together. What will you present next?"
                : tab === "profile"
                  ? "Add your details once. Make every new presentation feel like yours."
                  : tab === "saved"
                    ? "Good designs, kept close. Come back whenever inspiration strikes."
                    : tab === "downloads"
                      ? "Your exported presentations, ready whenever you need them."
                      : tab === "presentations"
                        ? "A home for the work you’re proud of."
                        : "Manage your CampusDeck experience."}
            </p>
          </div>
          {["overview", "presentations"].includes(tab) && (
            <Link className="btn btn-primary" to="/create">
              <Plus size={17} />
              New presentation
            </Link>
          )}
        </div>
        {fetching ? (
          <Spinner />
        ) : (
          <>
            {tab === "overview" && (
              <>
                <div className="workspace-stats">
                  <div>
                    <FileSliders size={20} />
                    <strong>{projects.length}</strong>
                    <span>Presentations</span>
                  </div>
                  <div>
                    <Bookmark size={20} />
                    <strong>{savedTemplates.length}</strong>
                    <span>Saved designs</span>
                  </div>
                  <div>
                    <Download size={20} />
                    <strong>{downloads.length}</strong>
                    <span>Recent downloads</span>
                  </div>
                </div>
                <div className="workspace-section-heading">
                  <h2>Pick up where you left off.</h2>
                  {projects.length > 3 && (
                    <button
                      className="text-link"
                      onClick={() => setParams({ tab: "presentations" })}
                    >
                      See all <ArrowRight size={14} />
                    </button>
                  )}
                </div>
                {projectCards(projects.slice(0, 3))}
                <div className="workspace-profile-callout">
                  <GraduationCap size={31} />
                  <div>
                    <h3>Your details, on standby.</h3>
                    <p>
                      A saved academic profile makes your next presentation a
                      little easier.
                    </p>
                  </div>
                  <button
                    className="text-link"
                    onClick={() => setParams({ tab: "profile" })}
                  >
                    Your profile <ArrowUpRight size={16} />
                  </button>
                </div>
              </>
            )}
            {tab === "presentations" && (
              <>
                <div className="search-field workspace-search">
                  <Search size={17} />
                  <input
                    aria-label="Search your presentations"
                    placeholder="Search your presentations…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                {projectCards(visibleProjects)}
              </>
            )}
            {tab === "saved" &&
              (savedTemplates.length ? (
                <div className="template-grid workspace-grid">
                  {savedTemplates.map((t, i) => (
                    <TemplateCard key={t.id} template={t} index={i + 1} />
                  ))}
                </div>
              ) : (
                <Empty
                  title="Keep a little inspiration close."
                  description="Use the bookmark on a template to add it to your collection."
                  action={
                    <Link to="/explore" className="btn btn-primary">
                      Explore designs <ArrowUpRight size={16} />
                    </Link>
                  }
                />
              ))}
            {tab === "downloads" &&
              (downloads.length ? (
                <div className="download-list">
                  {downloads.map((d) => (
                    <div key={d.id}>
                      <span className="file-icon">
                        {d.format === "pptx" ? "P" : "PDF"}
                      </span>
                      <div>
                        <h3>{d.title}</h3>
                        <p>
                          {date(d.created_at)} · {d.format.toUpperCase()}
                        </p>
                      </div>
                      <button
                        className="btn btn-outline btn-small"
                        disabled={!!busy}
                        onClick={() =>
                          void act(d.id, async () => {
                            const snapshot = await api<Deck | null>(
                              "/downloads/" + d.id,
                            );
                            const t =
                              snapshot?.templateSnapshot ||
                              templates.find((t) => t.id === d.template_id);
                            if (!t)
                              throw new Error(
                                "This template has been unpublished. Your saved presentation remains in your workspace.",
                              );
                            await exportDeck(
                              snapshot || makeDeck(t),
                              t,
                              d.format,
                            );
                          })
                        }
                      >
                        {busy === d.id ? (
                          <LoaderCircle size={15} className="spin" />
                        ) : (
                          <Download size={15} />
                        )}
                        Download again
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  title="Your downloads will live here."
                  description="Download a presentation while signed in and return to the exact exported version any time."
                />
              ))}
            {tab === "profile" && (
              <form
                className="profile-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act("profile", async () => {
                    await send("/profile", profile, "PUT");
                    toast("Your academic profile is saved.");
                  });
                }}
              >
                <FormRow>
                  {[
                    ["college", "College / organisation"],
                    ["department", "Department"],
                    ["degree", "Degree / course"],
                    ["university", "University"],
                    ["students", "Student / team names"],
                    ["registerNumbers", "Register numbers"],
                    ["guide", "Guide / supervisor"],
                    ["year", "Academic year"],
                  ].map(([key, label]) => (
                    <Field
                      key={key}
                      label={label}
                      value={profile[key as keyof Profile] || ""}
                      onChange={(value) =>
                        setProfile({ ...profile, [key]: value })
                      }
                      maxLength={
                        key === "students"
                          ? 250
                          : key === "registerNumbers"
                            ? 200
                            : key === "year"
                              ? 30
                              : key === "degree"
                                ? 80
                                : key === "department" || key === "guide"
                                  ? 100
                                  : 150
                      }
                    />
                  ))}
                </FormRow>
                <label className="upload-zone compact">
                  <ImagePlus size={24} />
                  <div>
                    <strong>
                      {profile.logo
                        ? "Replace college logo"
                        : "Add college logo"}
                    </strong>
                    <span>PNG or JPEG · up to 10 MB</span>
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    aria-label="Upload profile logo"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        try {
                          setProfile({ ...profile, logo: await readImage(f) });
                        } catch (err) {
                          toast((err as Error).message);
                        }
                    }}
                  />
                  {profile.logo && (
                    <img src={profile.logo} alt="College logo" />
                  )}
                </label>
                {profile.logo && (
                  <button
                    type="button"
                    className="link-button danger"
                    onClick={() => setProfile({ ...profile, logo: undefined })}
                  >
                    Remove logo
                  </button>
                )}
                <button disabled={!!busy} className="btn btn-primary">
                  {busy === "profile" && (
                    <LoaderCircle size={16} className="spin" />
                  )}
                  Save profile
                </button>
              </form>
            )}
            {tab === "purchases" && (
              <Empty
                title="No purchases yet."
                description="The launch collection is free. Premium purchases are not enabled, and no payment information is collected."
                action={
                  <Link className="btn btn-primary" to="/explore">
                    Explore the free collection
                  </Link>
                }
              />
            )}{" "}
            {tab === "settings" && (
              <div className="settings-card">
                <h2>Your account</h2>
                <dl>
                  <dt>Name</dt>
                  <dd>{user.name}</dd>
                  <dt>Email</dt>
                  <dd>{user.email}</dd>
                  <dt>Account access</dt>
                  <dd>{user.role === "admin" ? "Administrator" : "Member"}</dd>
                  <dt>Sign-in method</dt>
                  <dd>
                    {authMode === "platform"
                      ? "Secure ChatGPT sign-in"
                      : "Email and password"}
                  </dd>
                </dl>
                <p className="muted">
                  Your presentations and profile are private to your account.
                </p>
                {authMode === "platform" ? (
                  <a
                    className="btn btn-outline"
                    href="/signout-with-chatgpt?returnTo=/"
                    target="_top"
                  >
                    <LogOut size={16} />
                    Sign out
                  </a>
                ) : (
                  <button
                    className="btn btn-outline"
                    onClick={() =>
                      void act("logout", async () => {
                        await send("/auth/logout", {});
                        await refresh();
                        navigate("/");
                      })
                    }
                  >
                    <LogOut size={16} />
                    Sign out
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </section>
      {remove && (
        <Modal
          title="Delete this presentation?"
          onClose={() => setRemove(null)}
        >
          <p>
            “{remove.title}” will be removed from your workspace. Download a
            copy first if you want to keep it.
          </p>
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setRemove(null)}>
              Keep presentation
            </button>
            <button
              className="btn btn-danger"
              disabled={!!busy}
              onClick={() =>
                void act(remove.id, async () => {
                  await api("/projects/" + remove.id, { method: "DELETE" });
                  sessionStorage.removeItem(
                    `campus-draft-${user.id}-${remove.id}`,
                  );
                  setProjects(projects.filter((p) => p.id !== remove.id));
                  setRemove(null);
                  toast("Presentation deleted.");
                })
              }
            >
              Delete presentation
            </button>
          </div>
        </Modal>
      )}
      {rename && (
        <Modal title="Give it a new name" onClose={() => setRename(null)}>
          <Field
            label="Presentation name"
            value={name}
            onChange={setName}
            maxLength={160}
          />
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setRename(null)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={!!busy || !name.trim()}
              onClick={() =>
                void act(rename.id, async () => {
                  const updated = { ...rename, title: name.trim() };
                  await send("/projects/" + updated.id, updated, "PUT");
                  setProjects(
                    projects.map((p) => (p.id === updated.id ? updated : p)),
                  );
                  setRename(null);
                  toast("Presentation renamed.");
                })
              }
            >
              Save name
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
