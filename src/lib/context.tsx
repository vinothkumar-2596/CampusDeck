import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import type { User, Template, Category, Deck } from "./model";
import { Modal } from "../components/Common";
import {
  isModuleLoadError,
  rememberDownload,
  takeDownload,
  type PendingDownload,
} from "./recovery";
type Context = {
  user: User | null;
  authMode: string;
  templates: Template[];
  categories: Category[];
  loading: boolean;
  error: string;
  saved: string[];
  refresh: () => Promise<void>;
  toast: (message: string) => void;
  toggleSaved: (id: string) => Promise<void>;
  exportDeck: (
    deck: Deck,
    t: Template,
    format?: "pptx" | "pdf",
  ) => Promise<void>;
};
const AppContext = createContext<Context>(null!);
function guestSaved(): string[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem("campusdeck.saved") || "[]",
    );
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}
export const useApp = () => useContext(AppContext);
export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [authMode, setAuthMode] = useState("password"),
    [templates, setTemplates] = useState<Template[]>([]),
    [categories, setCategories] = useState<Category[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [saved, setSaved] = useState<string[]>([]),
    [message, setMessage] = useState("");
  const [recovery, setRecovery] = useState<PendingDownload | null>(null);
  const [recoveryError, setRecoveryError] = useState("");
  const checkedRecovery = useRef(false);
  const toast = (value: string) => setMessage(value);
  const refresh = async () => {
    try {
      const [me, t, c] = await Promise.all([
        api<{ user: User | null; authMode: string }>("/me"),
        api<Template[]>("/templates"),
        api<Category[]>("/categories"),
      ]);
      setUser(me.user);
      setAuthMode(me.authMode);
      setTemplates(t);
      setCategories(c);
      setSaved(me.user ? await api<string[]>("/saved") : guestSaved());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [message]);
  const toggleSaved = async (id: string) => {
    if (!user) {
      setSaved((previous) => {
        const next = previous.includes(id)
          ? previous.filter((item) => item !== id)
          : [...previous, id];
        try {
          localStorage.setItem("campusdeck.saved", JSON.stringify(next));
        } catch {
          /* In-memory saves remain usable when browser storage is blocked. */
        }
        return next;
      });
      return;
    }
    try {
      await api("/saved/" + id, {
        method: saved.includes(id) ? "DELETE" : "PUT",
        body: saved.includes(id) ? undefined : "{}",
      });
      setSaved((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const exportDeck = async (
    deck: Deck,
    t: Template,
    format: "pptx" | "pdf" = "pptx",
  ) => {
    t = deck.templateSnapshot || t;
    if (t.premium)
      throw new Error(
        "Premium purchases are not available yet. Choose a free template.",
      );
    try {
      const engine = await import("./export");
      const blob =
        format === "pptx"
          ? await engine.createPptx(deck, t)
          : await engine.createPdf(deck, t);
      if (blob.size < 1000)
        throw new Error("The export was incomplete. Please try again.");
      // The file has already been generated. A history service outage must not
      // discard it, and a stalled connection must not leave Download spinning.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      let recorded = true;
      try {
        await api("/downloads", {
          method: "POST",
          signal: controller.signal,
          body: JSON.stringify({
            templateId: t.id,
            title: deck.title,
            format,
            snapshot: user ? deck : undefined,
          }),
        });
      } catch {
        recorded = false;
      } finally {
        clearTimeout(timeout);
      }
      engine.downloadBlob(blob, engine.fileName(deck.title, format));
      toast(
        recorded
          ? `${format.toUpperCase()} downloaded${format === "pptx" ? " — ready to edit in PowerPoint." : "."}`
          : `${format.toUpperCase()} downloaded. Download history could not be updated.`,
      );
    } catch (error) {
      if (!isModuleLoadError(error)) throw error;
      setMessage("");
      setRecoveryError("");
      setRecovery({
        deck: structuredClone(deck),
        template: structuredClone(t),
        format,
        ownerId: user?.id || null,
        path: window.location.pathname + window.location.search,
        createdAt: Date.now(),
      });
    }
  };
  useEffect(() => {
    if (loading || error || checkedRecovery.current) return;
    checkedRecovery.current = true;
    let pending: PendingDownload | null = null;
    try {
      pending = takeDownload(
        sessionStorage,
        user?.id || null,
        window.location.pathname + window.location.search,
      );
    } catch {
      /* Browser storage may be disabled. */
    }
    if (pending) {
      toast("Finishing your download…");
      void exportDeck(pending.deck, pending.template, pending.format).catch(
        (error: unknown) =>
          toast(
            error instanceof Error
              ? error.message
              : "The download could not be completed. Please try again.",
          ),
      );
    }
  }, [loading, error, user?.id]);
  return (
    <AppContext.Provider
      value={{
        user,
        authMode,
        templates,
        categories,
        loading,
        error,
        saved,
        refresh,
        toast,
        toggleSaved,
        exportDeck,
      }}
    >
      {children}
      {recovery && (
        <Modal title="Finish your download" onClose={() => setRecovery(null)}>
          <p className="muted">
            The download tools could not load. This can happen after an update
            or a connection interruption.
          </p>
          <p>
            Reload to get the latest version and finish your{" "}
            {recovery.format.toUpperCase()} download. Your presentation and
            selected design will be kept in this tab.
          </p>
          {recoveryError && (
            <p role="alert" className="form-error">
              {recoveryError}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="btn btn-outline"
              onClick={() => setRecovery(null)}
            >
              Keep editing
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                let saved = false;
                try {
                  saved = rememberDownload(
                    { ...recovery, createdAt: Date.now() },
                    sessionStorage,
                  );
                } catch {
                  /* Keep the current page if storage is disabled. */
                }
                if (!saved) {
                  setRecoveryError(
                    "This browser could not preserve the presentation for a reload. Keep this tab open and save your work to your account before refreshing.",
                  );
                  return;
                }
                window.location.reload();
              }}
            >
              Reload and download
            </button>
          </div>
        </Modal>
      )}
      {message && (
        <div className="toast" role="status">
          <span className="toast-dot" />
          {message}
          <button
            aria-label="Dismiss notification"
            onClick={() => setMessage("")}
          >
            ×
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
