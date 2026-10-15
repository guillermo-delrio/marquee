import { useEffect, useRef, useState } from "react";

import { fetchHealth, fetchSamples, streamPlan } from "./api";
import { ProgrammeView } from "./ProgrammeView";
import { Trail } from "./Trail";
import type { AgentEvent, Programme, Sample, VenueInput } from "./types";
import { VenueForm } from "./VenueForm";

const KIND_LABEL = { cinema: "Cinema", bookshop: "Bookshop", music_bar: "Music bar" } as const;

export default function App() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [venue, setVenue] = useState<VenueInput | undefined>();
  const [running, setRunning] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [live, setLive] = useState<boolean | null>(null);
  const [formKey, setFormKey] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLElement | null>(null);
  // In the one-column layout the results sit below the form and the samples; bring them into view.
  const showResults = () => {
    if (window.matchMedia("(max-width: 860px)").matches) requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ block: "start" }));
  };

  const programme = events.find((e): e is Extract<AgentEvent, { type: "programme" }> => e.type === "programme")?.programme as Programme | undefined;
  const error = events.find((e): e is Extract<AgentEvent, { type: "error" }> => e.type === "error")?.message;
  const done = events.find((e): e is Extract<AgentEvent, { type: "done" }> => e.type === "done");

  const plan = async (v: VenueInput) => {
    showResults();
    abort.current?.abort();
    abort.current = new AbortController();
    setVenue(v);
    setEvents([]);
    setRunning(true);
    try {
      await streamPlan(v, (e) => setEvents((prev) => [...prev, e]), abort.current.signal);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setEvents((prev) => [...prev, { type: "error", message: (err as Error).message }]);
    } finally {
      setRunning(false);
    }
  };

  const replay = (s: Sample) => {
    if (!s.events) {
      setFormKey((k) => k + 1);
      void plan(s.venue);
      return;
    }
    abort.current?.abort();
    setVenue(s.venue);
    setFormKey((k) => k + 1);
    setEvents(s.events);
    setRunning(false);
    showResults();
  };

  useEffect(() => {
    fetchSamples()
      .then((list) => {
        setSamples(list);
        // ?sample=N opens a saved run directly, so a sample programme can be shared as a link.
        const n = Number(new URLSearchParams(window.location.search).get("sample"));
        // Only a cached run: a shared link must never start a paid live run on page load.
        if (list[n]?.events && new URLSearchParams(window.location.search).has("sample")) replay(list[n]);
      })
      .catch(() => setSamples([]));
    fetchHealth().then((h) => setLive(h.live)).catch(() => setLive(null));
  }, []);

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Marquee</h1>
          <p className="tagline">Programme next month from what your regulars already love, checked against your city.</p>
        </div>
        {live !== null && <span className={live ? "badge live" : "badge mock"}>{live ? "Live Qloo data" : "Mock Qloo data"}</span>}
      </header>
      <main className="layout">
        <aside>
          <VenueForm key={formKey} initial={venue} busy={running} onSubmit={plan} />
          {samples.length > 0 && (
            <section className="panel samples">
              <h2>Sample venues</h2>
              <p className="hint">Opens a saved run instantly when there is one; otherwise runs it live.</p>
              {samples.map((s, i) => (
                <button key={i} className="sample" onClick={() => replay(s)}>
                  <strong>{KIND_LABEL[s.venue.kind]}, {s.venue.location}</strong>
                  <span>{s.venue.recentHits.join(" · ")}</span>
                </button>
              ))}
            </section>
          )}
        </aside>
        <section className="results" ref={resultsRef}>
          {!venue && (
            <div className="panel intro">
              <h2>How it works</h2>
              <ol>
                <li>Tell Marquee what kind of venue you run, where, and what recently filled the room.</li>
                <li>An agent asks Qloo what people with that taste, in that place, tend to like, and checks each idea against the location.</li>
                <li>You get a month of events with the evidence behind each one, what the data cannot tell you, and checks to run before committing.</li>
              </ol>
            </div>
          )}
          {error && <div className="panel error" role="alert">{error}</div>}
          {programme && venue && <ProgrammeView programme={programme} venue={venue} events={events} />}
          <Trail events={events} running={running} />
          {done && (
            <p className="footnote">
              {done.tool_calls} Qloo calls · {(done.input_tokens + done.output_tokens).toLocaleString()} model tokens
              {done.cached_tokens ? ` (${Math.round((100 * done.cached_tokens) / done.input_tokens)}% of input from cache)` : ""} · about ${done.cost_usd.toFixed(2)}
              {done.mock ? " · mock Qloo data" : ""}
            </p>
          )}
        </section>
      </main>
      <footer>
        Qloo results describe what groups of people tend to like in aggregate. They are not predictions about any person and do not guarantee
        attendance. Marquee sends Qloo only places, titles, artists, tags and broad audience descriptions — never personal data.
      </footer>
    </div>
  );
}
