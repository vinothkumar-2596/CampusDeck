import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  Copy,
  Download,
  Eye,
  Layers,
  LoaderCircle,
  Pencil,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useApp } from "../lib/context";
import { api, send } from "../lib/api";
import { makeDeck, type Template, type User } from "../lib/model";
import { Empty, Modal, Spinner } from "../components/Common";
import { Field, FormRow } from "../components/Fields";
import { SlideView } from "../components/SlideView";
type AdminData = {
  templates: Template[];
  users: User[];
  downloads: number;
  logs: { id: string; action: string; target: string; created_at: string }[];
  messages: {
    id: string;
    name: string;
    email: string;
    message: string;
    created_at: string;
  }[];
};
export default function Admin() {
  const { user, categories, loading, refresh, toast } = useApp(),
    [data, setData] = useState<AdminData | null>(null),
    [tab, setTab] = useState("templates"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<Template | null>(null),
    [category, setCategory] = useState(""),
    [parent, setParent] = useState(""),
    [categoryEdit, setCategoryEdit] = useState("");
  const load = async () => {
    try {
      setData(await api<AdminData>("/admin"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    if (user?.role === "admin") void load();
  }, [user?.id]);
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await load();
      await refresh();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (loading) return <Spinner />;
  if (user?.role !== "admin")
    return (
      <Empty
        title="Administrator access required."
        description="This area is available to authorised CampusDeck administrators."
        action={
          <Link to="/workspace" className="btn btn-primary">
            Back to workspace
          </Link>
        }
      />
    );
  if (error)
    return (
      <Empty
        title="Administration could not be loaded."
        description={error}
        action={
          <button className="btn btn-primary" onClick={() => void load()}>
            Retry
          </button>
        }
      />
    );
  if (!data) return <Spinner />;
  const edit = (patch: Partial<Template>) =>
    setEditing((e) => (e ? { ...e, ...patch } : e));
  const familyId = (t: Template) =>
    t.handoffId ? "handoff:" + t.familyKey : "legacy:" + t.family;
  const designSources = data.templates.filter(
    (t, index, list) =>
      list.findIndex((item) => familyId(item) === familyId(t)) === index,
  );
  return (
    <div className="container admin-page">
      <div className="workspace-heading">
        <div>
          <span className="section-kicker">
            <ShieldCheck size={16} />
            CAMPUSDECK ADMINISTRATION
          </span>
          <h1>A considered collection.</h1>
          <p>Manage designs, categories, and the people behind them.</p>
        </div>
        <Link className="btn btn-outline" to="/workspace">
          Your workspace <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="workspace-stats">
        <div>
          <Layers size={22} />
          <strong>{data.templates.filter((t) => t.published).length}</strong>
          <span>Published designs</span>
        </div>
        <div>
          <Users size={22} />
          <strong>{data.users.length}</strong>
          <span>Registered members</span>
        </div>
        <div>
          <Download size={22} />
          <strong>{data.downloads}</strong>
          <span>Completed exports</span>
        </div>
      </div>
      <div className="template-tabs">
        {["templates", "categories", "users", "messages", "activity"].map(
          (s) => (
            <button
              className={tab === s ? "active" : ""}
              key={s}
              onClick={() => setTab(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ),
        )}
      </div>
      {tab === "templates" && (
        <>
          <div className="workspace-section-heading">
            <h2>Template library</h2>
            <button
              className="btn btn-primary btn-small"
              onClick={() =>
                setEditing({
                  ...structuredClone(data.templates[0]),
                  id: "design-" + crypto.randomUUID().slice(0, 8),
                  name: "New design",
                  published: false,
                })
              }
            >
              <Plus size={16} />
              Create template
            </button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Design</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Access</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.templates.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div className="admin-template-name">
                        <SlideView template={t} slide={makeDeck(t).slides[0]} />
                        <strong>{t.name}</strong>
                      </div>
                    </td>
                    <td>{t.category}</td>
                    <td>
                      <span
                        className={"pill " + (t.published ? "published" : "")}
                      >
                        {t.published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td>{t.premium ? "Premium" : "Free"}</td>
                    <td>
                      <button
                        className="icon-btn"
                        aria-label={"Edit " + t.name}
                        onClick={() => setEditing(structuredClone(t))}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={"Duplicate " + t.name}
                        onClick={() =>
                          setEditing({
                            ...structuredClone(t),
                            id:
                              t.id.slice(0, 35) +
                              "-" +
                              crypto.randomUUID().slice(0, 6),
                            name: t.name + " copy",
                            published: false,
                          })
                        }
                      >
                        <Copy size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "categories" && (
        <div className="admin-categories">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void act(async () => {
                await send(
                  categoryEdit
                    ? "/admin/categories/" + categoryEdit
                    : "/admin/categories",
                  { name: category, parent: parent || null },
                  categoryEdit ? "PUT" : "POST",
                );
                setCategory("");
                setParent("");
                setCategoryEdit("");
                toast("Category saved.");
              });
            }}
          >
            <h2>{categoryEdit ? "Edit category" : "Add a new category"}</h2>
            <Field
              label="Category name"
              value={category}
              onChange={setCategory}
              required
              maxLength={80}
            />
            <Field
              label="Parent collection (optional)"
              value={parent}
              onChange={setParent}
              maxLength={80}
            />
            <button
              className="btn btn-primary"
              disabled={busy || !category.trim()}
            >
              <Plus size={15} />
              {categoryEdit ? "Save category" : "Add category"}
            </button>
            {categoryEdit && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setCategoryEdit("");
                  setCategory("");
                  setParent("");
                }}
              >
                Cancel
              </button>
            )}
          </form>
          <div>
            {categories.map((c) => (
              <div key={c.id} className="category-admin-row">
                <div>
                  <strong>{c.name}</strong>
                  <small>{c.parent || "Top-level collection"}</small>
                </div>
                <button
                  className="icon-btn"
                  aria-label={"Edit category " + c.name}
                  onClick={() => {
                    setCategoryEdit(c.id);
                    setCategory(c.name);
                    setParent(c.parent || "");
                  }}
                >
                  <Pencil size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === "users" && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      aria-label={"Role for " + u.name}
                      disabled={busy || u.id === user.id || user.platform}
                      value={u.role}
                      onChange={(e) =>
                        void act(async () => {
                          await send(
                            "/admin/users/" + u.id,
                            { role: e.target.value },
                            "PUT",
                          );
                          toast("Member role updated.");
                        })
                      }
                    >
                      <option value="user">Member</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {user.platform && (
            <p className="muted">
              Hosted administrator roles are managed through the server’s
              ADMIN_EMAILS setting.
            </p>
          )}
        </div>
      )}
      {tab === "messages" &&
        (data.messages?.length ? (
          <div className="support-messages">
            {data.messages.map((m) => (
              <article key={m.id}>
                <h3>
                  {m.name} <small>{m.email}</small>
                </h3>
                <time>
                  {new Date(m.created_at).toLocaleDateString("en-IN")}
                </time>
                <p>{m.message}</p>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="No messages yet."
            description="Messages submitted through the contact form appear here."
          />
        ))}
      {tab === "activity" &&
        (data.logs.length ? (
          <div className="activity-list">
            {data.logs.map((log) => (
              <div key={log.id}>
                <Check size={16} />
                <span>{log.action}</span>
                <time>{new Date(log.created_at).toLocaleString("en-IN")}</time>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="A fresh start."
            description="Administrator changes will appear in the audit log."
          />
        ))}
      {editing && (
        <Modal
          title="Template design studio"
          onClose={() => setEditing(null)}
          wide
        >
          <div className="admin-design-editor">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act(async () => {
                  await send("/admin/templates/" + editing.id, editing, "PUT");
                  toast(
                    editing.published
                      ? "Template published with valid export configuration."
                      : "Draft saved.",
                  );
                  setEditing(null);
                });
              }}
            >
              <Field
                label="Template name"
                value={editing.name}
                onChange={(name) => edit({ name })}
                required
                maxLength={80}
              />
              <FormRow>
                <label className="field">
                  <span>Category</span>
                  <select
                    value={editing.category}
                    onChange={(e) => edit({ category: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Design family</span>
                  <select
                    value={familyId(editing)}
                    onChange={(e) => {
                      const base = designSources.find(
                        (t) => familyId(t) === e.target.value,
                      );
                      if (base)
                        edit({
                          family: base.family,
                          handoffId: base.handoffId,
                          familyKey: base.familyKey,
                          defaultTheme: base.defaultTheme,
                          legacy: base.legacy,
                          slides: base.slides,
                          bg: base.bg,
                          ink: base.ink,
                          light: base.light,
                          accent: base.accent,
                        });
                    }}
                  >
                    {designSources.map((t) => (
                      <option key={familyId(t)} value={familyId(t)}>
                        {t.name}
                        {t.legacy ? " (original)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </FormRow>
              <Field
                label="Cover title"
                value={editing.cover}
                onChange={(cover) => edit({ cover })}
                maxLength={100}
                multiline
              />
              <Field
                label="Description"
                value={editing.description}
                onChange={(description) => edit({ description })}
                maxLength={500}
                multiline
              />
              <FormRow>
                <Field
                  label="Department"
                  value={editing.department}
                  onChange={(department) => edit({ department })}
                  maxLength={80}
                />
                <Field
                  label="Style"
                  value={editing.style}
                  onChange={(style) => edit({ style })}
                  maxLength={40}
                />
              </FormRow>
              <div className="admin-colors">
                {(["accent", "bg", "ink", "light"] as const).map((key) => (
                  <label key={key}>
                    {key}
                    <input
                      aria-label={key + " colour"}
                      type="color"
                      value={editing[key]}
                      onChange={(e) => edit({ [key]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
              <label className="check-filter">
                <input
                  type="checkbox"
                  checked={editing.published}
                  onChange={(e) => edit({ published: e.target.checked })}
                />
                Publish to the marketplace
              </label>
              <label className="check-filter">
                <input
                  type="checkbox"
                  checked={editing.premium}
                  onChange={(e) => edit({ premium: e.target.checked })}
                />
                Premium (purchases currently unavailable)
              </label>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Check size={16} />
                )}
                Save template
              </button>
            </form>
            <div>
              <SlideView
                template={editing}
                slide={makeDeck(editing).slides[0]}
              />
              <p className="muted">
                Live preview · {editing.slides} editable slides · PPTX engine
                connected
              </p>
              <div className="admin-preview-grid">
                {makeDeck(editing)
                  .slides.slice(3, 7)
                  .map((s) => (
                    <SlideView key={s.id} template={editing} slide={s} />
                  ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
