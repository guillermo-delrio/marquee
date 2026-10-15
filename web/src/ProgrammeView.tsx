import { useState } from "react";

import { dateFor, toIcs, toMarkdown } from "./calendar";
import { Cite } from "./Cite";
import { comparisons } from "./evidence";
import { TasteVsPlace } from "./TasteVsPlace";
import { WithoutQloo } from "./WithoutQloo";
import type { AgentEvent, Programme, ProgrammeEvent, ShortlistNote, VenueInput } from "./types";

const SOURCE: Record<NonNullable<ProgrammeEvent["source"]>, string> = {
  shortlist: "From your list",
  taste: "Taste pick · check availability",
  local: "Local crowd-pleaser",
  reprise: "Reprise",
};
const VERDICT: Record<ShortlistNote["verdict"], string> = { programmed: "Programmed", featured: "Played, not booked", reserve: "Reserve", skip: "Skip", not_found: "Not found" };

function download(name: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

const fmt = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const CONFIDENCE = { high: "strong evidence", medium: "some evidence", low: "judgement call" } as const;

export function ProgrammeView({ programme, venue, events }: { programme: Programme; venue: VenueInput; events: AgentEvent[] }) {
  const evidence = comparisons(events, { featured: programme.events.flatMap((e) => e.featured) });
  const baselineEvent = events.find((e): e is Extract<AgentEvent, { type: "baseline" }> => e.type === "baseline");
  const baseline = baselineEvent?.programme;
  // What Qloo told Marquee that a plan without it could not know, counted from the run itself.
  const shortlistLocal = evidence.find((c) => c.kind === "shortlist");
  const profiles = events.filter((e) => e.type === "tool_result" && e.name === "qloo_audience_demographics" && (e.result_count ?? 0) > 0).length;
  const informed = [
    ...(shortlistLocal ? [`Qloo ranked ${shortlistLocal.rows.filter((r) => r.local !== null).length} of your ${venue.shortlist?.length ?? shortlistLocal.rows.length} bookable titles in ${shortlistLocal.location}${(venue.shortlist?.length ?? 0) > shortlistLocal.rows.length ? ` (${(venue.shortlist?.length ?? 0) - shortlistLocal.rows.length} it could not match or score at all)` : ""}.`] : []),
    ...(profiles ? [`It profiled the audiences of ${profiles} lead pick${profiles === 1 ? "" : "s"}.`] : []),
    ...(programme.partners?.length ? [`It found ${programme.partners.length} nearby places whose audiences share the taste.`] : []),
    ...(programme.soundtrack?.length ? [`It found ${programme.soundtrack.length} musicians this audience over-indexes on.`] : []),
  ];
  const [copied, setCopied] = useState(false);
  // The take / reserve / skip line comes from the verdicts themselves, so the summary can never contradict them.
  const byVerdict = (v: ShortlistNote["verdict"]) => (programme.shortlist_notes ?? []).filter((n) => n.verdict === v).map((n) => n.title);
  const verdictLine = programme.shortlist_notes?.length ? [
    byVerdict("programmed").length ? `Book ${byVerdict("programmed").join(", ")}.` : "",
    byVerdict("featured").length ? `Play ${byVerdict("featured").join(", ")} on record.` : "",
    byVerdict("reserve").length ? `Hold ${byVerdict("reserve").join(", ")} in reserve.` : "",
    byVerdict("skip").length ? `Pass on ${byVerdict("skip").join(", ")}.` : "",
    byVerdict("not_found").length ? `Check the titles of ${byVerdict("not_found").join(", ")}.` : "",
  ].filter(Boolean).join(" ") : "";
  const md = () => toMarkdown(programme, venue.month, venue.location);
  // Cards in calendar order, whatever order the agent wrote them in.
  const dated = programme.events
    .map((e, i) => ({ e, date: dateFor(e.when, venue.month, i, programme.events.length, e.date, e.start_time) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  return (
    <section className="programme">
      <header className="panel">
        <p className="eyebrow">{venue.location} · {venue.month}</p>
        <h2>{programme.headline}</h2>
        {programme.summary?.length ? (
          <ul className="summary">
            {programme.summary.map((s, i) => <li key={i}>{s}</li>)}
            {verdictLine && <li>{verdictLine}</li>}
          </ul>
        ) : null}
        {programme.summary?.length ? (
          <details className="why"><summary>Why these picks</summary><p className="read"><Cite text={programme.audience_read} /></p></details>
        ) : <p className="read"><Cite text={programme.audience_read} /></p>}
        <div className="actions">
          <button onClick={() => download(`marquee-${venue.month}.ics`, "text/calendar", toIcs(programme, venue.month, venue.location))}>
            Add to calendar (.ics)
          </button>
          <button onClick={async () => { await navigator.clipboard.writeText(md()); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? "Copied" : "Copy as text"}
          </button>
        </div>
      </header>
      {programme.shortlist_notes?.length ? (
        <section className="panel verdicts">
          <h3>Your shortlist</h3>
          <ul>
            {programme.shortlist_notes.map((n) => (
              <li key={n.title}>
                <span className={`verdict ${n.verdict}`}>{VERDICT[n.verdict]}</span>
                <span><strong>{n.title}</strong> — <Cite text={n.reason} />{n.evidence.length ? <> <Cite text={n.evidence.join(", ")} /></> : null}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ol className="events">
        {dated.map(({ e, date }, i) => (
          <li key={i} className="panel event">
            <div className="event-head">
              <span className="when">{e.when.replace(/^week\s*\d+\s*[,:–-]?\s*/i, "")}</span>
              <span className={`confidence ${e.confidence}`}>{CONFIDENCE[e.confidence]}</span>
            </div>
            <p className="date">
              {fmt.format(date)}, {hhmm(date)}{e.runtime_minutes ? `–${hhmm(new Date(date.getTime() + e.runtime_minutes * 60000))}` : ""}
              {e.version && <span className="source"> · {e.version}</span>}
              {e.source && <span className="source"> · {SOURCE[e.source]}</span>}
            </p>
            <h3>{e.title}</h3>
            <p className="format">{e.format}</p>
            <ul className="featured">{e.featured.map((f) => <li key={f}>{f}</li>)}</ul>
            <p><Cite text={e.why} /></p>
            <details>
              <summary>Evidence ({e.evidence.length})</summary>
              <ul className="evidence">
                {e.evidence.map((ev, j) => (
                  <li key={j}><Cite text={ev.call_id} />: {ev.claim}</li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ol>
      {baseline && <WithoutQloo ours={programme} theirs={baseline} second={baselineEvent?.second} city={evidence[0]?.location ?? venue.location}
        informed={informed} localSeen={evidence.some((c) => c.rows.some((r) => r.local !== null))} profilesSeen={profiles > 0} />}
      {(programme.partners?.length || programme.audience_check) ? (
        <div className="two">
          {programme.partners?.length ? (
            <section className="panel">
              <h3>Co-promote with</h3>
              <p className="viz-sub">Local places whose audiences share your regulars' taste, from Qloo's place data.</p>
              <ul className="partners">
                {programme.partners.map((p) => (
                  <li key={p.name}><strong>{p.name}</strong> <span className="muted">{p.kind}{p.address ? ` · ${p.address}` : ""}</span><br /><Cite text={p.idea} />{p.evidence.length ? <> <Cite text={p.evidence.join(", ")} /></> : null}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {programme.soundtrack?.length ? (
            <section className="panel">
              <h3>Pre-show soundtrack</h3>
              <p className="viz-sub">Musicians this audience over-indexes on, from Qloo: a playlist for the lobby, or a themed night.</p>
              <p>{programme.soundtrack.map((a) => a.name).join(" · ")} {programme.soundtrack[0]?.evidence.length ? <><Cite text={programme.soundtrack[0].evidence.join(", ")} /></> : null}</p>
            </section>
          ) : null}
          {programme.audience_check ? (
            <section className="panel">
              <h3>Audience check</h3>
              <p className="viz-sub">Who the lead picks' audiences lean towards, from Qloo's audience profiles.</p>
              <p><Cite text={programme.audience_check} /></p>
            </section>
          ) : null}
        </div>
      ) : null}
      {evidence.map((c) => <TasteVsPlace key={c.localCall} c={c} />)}
      <div className="two">
        <section className="panel">
          <h3>What this does not establish</h3>
          <ul>{programme.limits.map((l, i) => <li key={i}><Cite text={l} /></li>)}</ul>
        </section>
        <section className="panel">
          <h3>Before you commit</h3>
          <ul>{programme.next_checks.map((n, i) => <li key={i}><Cite text={n} /></li>)}</ul>
        </section>
      </div>
    </section>
  );
}
