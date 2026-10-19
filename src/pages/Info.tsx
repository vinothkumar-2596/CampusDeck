import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight, Check, LoaderCircle, Send } from "lucide-react";
import { FAQ } from "./Home";
import { Field } from "../components/Fields";
import { send } from "../lib/api";
export default function Info() {
  const { pathname } = useLocation(),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState("");
  const page = pathname.slice(1);
  return (
    <div className="container info-page">
      <span className="section-kicker">CAMPUSDECK / {page.toUpperCase()}</span>
      {page === "help" ? (
        <>
          <h1>A little help, a lot of clarity.</h1>
          <p className="lead">
            Everything you need to turn a starting point into your presentation.
          </p>
          <FAQ />
          <div className="form-note">
            Need help with something else?{" "}
            <Link to="/contact">
              Send us a message <ArrowUpRight size={14} />
            </Link>
          </div>
        </>
      ) : page === "about" ? (
        <>
          <h1>
            Good ideas deserve
            <br />
            <em>a great presentation.</em>
          </h1>
          <p className="lead">
            CampusDeck helps students and professionals spend more time on their
            ideas, and less time wrestling with slide layouts.
          </p>
          <h2>Built around your next milestone.</h2>
          <p>
            We start with the moments that matter: your final-year review, your
            thesis defence, your first pitch. Our original templates bring a
            clear structure and a considered visual style to each one.
          </p>
          <h2>Your work stays yours.</h2>
          <p>
            Every design is a real PowerPoint template. Customise it in your
            browser, download it, and keep editing in Microsoft PowerPoint. No
            AI account or external design subscription is needed.
          </p>
          <h2>A small, thoughtful collection.</h2>
          <p>
            Our launch library includes 18 original design families, with 12
            focused on college presentations. Every family includes 16 working
            slide layouts with editable text, shapes, charts, and tables.
          </p>
          <Link to="/explore" className="btn btn-primary">
            Meet the collection <ArrowUpRight size={16} />
          </Link>
        </>
      ) : page === "contact" ? (
        <>
          <h1>Let’s make things clearer.</h1>
          <p className="lead">
            A question, a suggestion, or a design you’d love to see? Leave a
            message for the CampusDeck administrator.
          </p>
          {sent ? (
            <div className="contact-success" role="status">
              <Check size={32} />
              <h2>Your message has been saved.</h2>
              <p>
                The administrator can read it in the support inbox. Thank you
                for helping shape CampusDeck.
              </p>
              <button
                className="btn btn-outline"
                onClick={() => {
                  setSent(false);
                  setMessage("");
                }}
              >
                Send another message
              </button>
            </div>
          ) : (
            <form
              className="contact-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await send("/contact", { name, email, message });
                  setSent(true);
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field
                label="Your name"
                value={name}
                onChange={setName}
                required
                maxLength={80}
              />
              <Field
                label="Email address"
                type="email"
                value={email}
                onChange={setEmail}
                required
                maxLength={200}
              />
              <Field
                label="Your message"
                value={message}
                onChange={setMessage}
                multiline
                required
                maxLength={3000}
              />
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button className="btn btn-primary" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Send size={16} />
                )}
                Send message
              </button>
            </form>
          )}
        </>
      ) : page === "privacy" ? (
        <>
          <h1>
            Your ideas are personal.
            <br />
            We treat them that way.
          </h1>
          <p className="lead">CampusDeck privacy notice · October 2026</p>
          <h2>What this application stores</h2>
          <p>
            When you create a standalone account, the application stores your
            name, email, and a salted password hash. Hosted sign-in uses the
            identity provided by the hosting platform. Your saved presentations,
            uploaded images, academic profile, bookmarks, and download history
            are associated with your account.
          </p>
          <h2>How your information is used</h2>
          <p>
            Your information is used to operate your workspace, populate
            presentation details, and let you revisit your downloads. Private
            decks and uploads are available through authorised account requests.
            Administrators can manage templates, member roles, support messages,
            and aggregate export activity.
          </p>
          <h2>Browser storage and cookies</h2>
          <p>
            Standalone sign-in uses an HTTP-only session cookie. Theme
            preferences are kept in local storage. Guest drafts are stored in
            the current browser tab’s session storage. Guest drafts do not sync
            between devices. No advertising or third-party analytics are
            included in this application.
          </p>
          <h2>Contact and deletion requests</h2>
          <p>
            Use the <Link to="/contact">contact form</Link> to request help or
            account-data deletion from the administrator. Messages and your
            contact details are stored in the support inbox. Deployment
            operators are responsible for their retention policies and legally
            required notices.
          </p>
          <h2>Payments</h2>
          <p>
            Payments are currently disabled. This application does not collect
            card or banking information.
          </p>
        </>
      ) : page === "terms" ? (
        <>
          <h1>A clear starting point.</h1>
          <p className="lead">CampusDeck terms of use · October 2026</p>
          <h2>Using the templates</h2>
          <p>
            You may use and customise the original CampusDeck templates for
            academic, personal, and commercial presentations. You may share your
            completed presentation. Do not resell or redistribute the unmodified
            template collection as a competing library.
          </p>
          <h2>Your content and responsibility</h2>
          <p>
            You retain responsibility for text, data, images, and other material
            you add. Upload only files you have permission to use. Sample
            presentations, data, and references are illustrative and must be
            replaced with your verified information before presenting them as
            research or completed work.
          </p>
          <h2>Accounts and availability</h2>
          <p>
            Keep your sign-in credentials secure. Account access is personal.
            Export a backup of important work. The service is provided as
            available; deployment administrators are responsible for operating
            and maintaining their installation.
          </p>
          <h2>Purchases and billing</h2>
          <p>
            Premium purchases are not enabled in this release. No payment or
            paid entitlement is granted by a preview or a disabled purchase
            action.
          </p>
          <h2>Questions</h2>
          <p>
            Contact the administrator through the{" "}
            <Link to="/contact">support form</Link> for questions about the
            application or these terms.
          </p>
        </>
      ) : (
        <>
          <h1>That page took a different path.</h1>
          <p>Let’s find your next great presentation instead.</p>
          <Link to="/explore" className="btn btn-primary">
            Explore templates
          </Link>
        </>
      )}
    </div>
  );
}
