import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, send } from "./api";
import type { User, Template, Category, Deck } from "./model";
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
    if (t.premium)
      throw new Error(
        "Premium purchases are not available yet. Choose a free template.",
      );
    const engine = await import("./export");
    t = deck.templateSnapshot || t;
    const blob =
      format === "pptx"
        ? await engine.createPptx(deck, t)
        : await engine.createPdf(deck, t);
    if (blob.size < 1000)
      throw new Error("The export was incomplete. Please try again.");
    await send("/downloads", {
      templateId: t.id,
      title: deck.title,
      format,
      snapshot: user ? deck : undefined,
    });
    engine.downloadBlob(blob, engine.fileName(deck.title, format));
    toast(
      `${format.toUpperCase()} downloaded${format === "pptx" ? " — ready to edit in PowerPoint." : "."}`,
    );
  };
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
