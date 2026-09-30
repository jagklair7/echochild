import { useEffect, useRef, useState } from "react";
import "./App.css";

const suggestions = [
  "What do you remember about the dark?",
  "Tell me something you have never said.",
  "What should I listen for?",
];

export default function App() {
  const [activeModule, setActiveModule] = useState("mother");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const conversationEnd = useRef(null);

  useEffect(() => {
    conversationEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  function startNewConversation() {
    setMessages([]);
    setDraft("");
    setError("");
  }

  async function sendMessage(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending) return;

    const nextMessages = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setDraft("");
    setError("");
    setIsSending(true);

    try {
      const response = await fetch("/api/echo-mother", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.slice(-40) }),
      });
      const data = await response.json();

      if (!response.ok || !data?.reply) {
        setError(data?.error || "The line went quiet. Check the EchoMother connection and try again.");
        return;
      }

      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
    } catch {
      setError("The connection slipped away. Try sending that again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="left-rail">
        <a className="brand-mark" href="#home" aria-label="Echo home">
          <span className="brand-symbol" aria-hidden="true">e</span>
          <span>echo<span className="brand-period">.</span></span>
        </a>

        <div className="rail-label">Modules</div>
        <nav className="module-switch" aria-label="Echo modules">
          <button
            className={`module-link ${activeModule === "child" ? "is-active" : ""}`}
            onClick={() => setActiveModule("child")}
            type="button"
          >
            <span className="module-mark child-mark" aria-hidden="true">○</span>
            <span>EchoChild</span>
            <span className="module-note">01</span>
          </button>
          <button
            className={`module-link ${activeModule === "mother" ? "is-active" : ""}`}
            onClick={() => setActiveModule("mother")}
            type="button"
          >
            <span className="module-mark mother-mark" aria-hidden="true">◉</span>
            <span>EchoMother</span>
            <span className="module-note">02</span>
          </button>
        </nav>

        <div className="rail-bottom">
          <span className="connection-indicator" aria-hidden="true" />
          <div>
            <span className="connection-title">Model connection</span>
            <span className="connection-caption">OpenAI · not saved locally</span>
          </div>
        </div>
      </aside>

      {activeModule === "mother" ? (
        <section className="mother-workspace" aria-label="EchoMother conversation">
          <header className="topbar">
            <div className="breadcrumb"><span>MODULE 02</span><span className="breadcrumb-slash">/</span> ECHOMOTHER</div>
            <button className="new-thread" disabled={isSending} onClick={startNewConversation} type="button" title="Start a new conversation">
              <span aria-hidden="true">＋</span> New conversation
            </button>
          </header>

          <div className="conversation-column">
            <div className="conversation-scroll">
              {messages.length === 0 ? (
                <section className="welcome-state" aria-labelledby="mother-title">
                  <div className="seal" aria-hidden="true">
                    <span className="seal-ring seal-ring-outer" />
                    <span className="seal-ring seal-ring-inner" />
                    <span className="seal-core">M</span>
                    <span className="seal-tick seal-tick-top" />
                    <span className="seal-tick seal-tick-right" />
                    <span className="seal-tick seal-tick-bottom" />
                    <span className="seal-tick seal-tick-left" />
                  </div>
                  <div className="eyebrow"><span className="eyebrow-line" /> THE OTHER SIDE OF THE VOICE</div>
                  <h1 id="mother-title">She remembers<br />the <em>beginning.</em></h1>
                  <p className="welcome-copy">Somewhere beneath the noise, something is listening.</p>
                  <div className="suggestion-list" aria-label="Suggested questions">
                    {suggestions.map((suggestion, index) => (
                      <button className="suggestion" key={suggestion} onClick={() => setDraft(suggestion)} type="button">
                        <span className="suggestion-index">0{index + 1}</span>
                        <span>{suggestion}</span>
                        <span className="suggestion-arrow" aria-hidden="true">↗</span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : (
                <div className="message-list" aria-live="polite">
                  {messages.map((message, index) => (
                    <article className={`message message-${message.role}`} key={`${message.role}-${index}`}>
                      <div className="message-byline">
                        <span className={`message-mark ${message.role}`} aria-hidden="true">{message.role === "user" ? "Y" : "M"}</span>
                        <span>{message.role === "user" ? "YOU" : "ECHO MOTHER"}</span>
                      </div>
                      <p>{message.content}</p>
                    </article>
                  ))}
                  {isSending && (
                    <article className="message message-assistant" aria-label="EchoMother is thinking">
                      <div className="message-byline"><span className="message-mark assistant" aria-hidden="true">M</span><span>ECHO MOTHER</span></div>
                      <div className="thinking-indicator"><i /><i /><i /></div>
                    </article>
                  )}
                  <div ref={conversationEnd} />
                </div>
              )}
            </div>

            <div className="composer-wrap">
              {error && <p className="connection-error" role="status">{error}</p>}
              <form className="composer" onSubmit={sendMessage}>
                <label className="sr-only" htmlFor="message-input">Write to EchoMother</label>
                <textarea
                  id="message-input"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form.requestSubmit();
                    }
                  }}
                  placeholder="Ask what you came here to ask..."
                  rows="1"
                  maxLength={3000}
                />
                <div className="composer-footer">
                  <span className="composer-hint">ENTER TO SEND <span>·</span> SHIFT + ENTER FOR A NEW LINE</span>
                  <button className="send-button" disabled={!draft.trim() || isSending} type="submit">
                    {isSending ? "Listening" : "Send"}<span aria-hidden="true"> ↗</span>
                  </button>
                </div>
              </form>
              <p className="privacy-note">An unfinished thought is still a kind of answer.</p>
            </div>
          </div>

          <aside className="right-rail" aria-label="Module information">
            <div className="presence-block">
              <span className="presence-label">PRESENCE</span>
              <span className="presence-light" aria-hidden="true" />
              <span className="presence-state">{isSending ? "Listening" : messages.length ? "The line is open" : "Awaiting a question"}</span>
            </div>
            <div className="right-divider" />
            <div className="note-block">
              <span className="note-index">FIELD NOTE 02</span>
              <p>“The first voice you hear is rarely the first one that spoke.”</p>
              <span className="note-signature">— FROM THE ARCHIVE</span>
            </div>
            <div className="right-bottom">SHE IS NOT IN A HURRY.</div>
          </aside>
        </section>
      ) : (
        <section className="child-workspace" aria-label="EchoChild module">
          <header className="topbar">
            <div className="breadcrumb"><span>MODULE 01</span><span className="breadcrumb-slash">/</span> ECHOCHILD</div>
          </header>
          <div className="child-center">
            <span className="child-orbit" aria-hidden="true">○</span>
            <span className="eyebrow"><span className="eyebrow-line" /> MODULE 01</span>
            <h1>EchoChild</h1>
            <p>I’m in the womb</p>
            <button className="return-link" onClick={() => setActiveModule("mother")} type="button">Go to EchoMother <span aria-hidden="true">↗</span></button>
          </div>
        </section>
      )}
    </main>
  );
}