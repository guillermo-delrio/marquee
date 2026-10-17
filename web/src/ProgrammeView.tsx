import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { dateFor, toIcs, toMarkdown } from "./calendar";
import { Cite } from "./Cite";
import { comparisons, profiles as ageProfiles, scoreRows, standings } from "./evidence";
import { entityNames } from "./trailLabels";
import { TasteVsPlace } from "./TasteVsPlace";
import { featuredVerb, heldLabel, soundtrackTitle, verdictLabels } from "./labels";
import { imageFor, imageIndex, nameIndex } from "./images";
import { MonthStrip, QlooChanged } from "./Summary";
import { diffPlans, WithoutQloo } from "./WithoutQloo";
import type { Profile, Standing } from "./evidence";
import type { AgentEvent, Programme, ProgrammeEvent, ShortlistNote, VenueInput } from "./types";

const SOURCE: Record<NonNullable<ProgrammeEvent["source"]>, string> = {
  shortlist: "From your list",
  taste: "Taste pick · check availability",
  local: "Local crowd-pleaser",
  reprise: "Reprise",
};


function download(name: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

const fmt = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const CONFIDENCE = { high: "strong evidence", medium: "some evidence", low: "judgement call" } as const;

/** A title's standing in each ranking, written by code from Qloo's results, ties included. */
function Facts({ s }: { s: ReturnType<typeof standings> }) {
  const one = (x: Standing) => <>{x.tie ? "≈" : ""}#{x.pos} of {x.of} <Cite text={x.call} /></>;
  if (!s.taste && !s.local) return <span className="facts">Qloo scored it in no ranking.</span>;
  return (
    <span className="facts">
      By taste {s.taste ? one(s.taste) : "not scored"}
      {" · "}{s.local ? <>in {s.local.place} {one(s.local)}</> : s.localTried ? `not ranked in ${s.localTried}` : "no city ranking"}
    </span>
  );
}

const BANDS: [string, string, number, number][] = [["24_and_younger", "≤24", 0, 24], ["25_to_29", "25–29", 25, 29], ["30_to_34", "30–34", 30, 34],
  ["35_to_44", "35–44", 35, 44], ["45_to_54", "45–54", 45, 54], ["55_and_older", "55+", 55, 120]];

/** Qloo's age skews for each profiled pick, the venue's own bands marked: the data behind the audience advice. */
function AgeTable({ rows, venueAudience }: { rows: Profile[]; venueAudience?: string }) {
  if (!rows.length) return null;
  const m = (venueAudience ?? "").match(/(\d{2})\s*(?:-|–|to)\s*(\d{2})/);
  const mine = (lo: number, hi: number) => !!m && lo <= Number(m[2]) && hi >= Number(m[1]);
  return (
    <div className="age-wrap">
      <table className="age-table">
        <caption>Age skew against the general population (above 0: over-represented){m ? "; the venue's bands in bold" : ""}</caption>
        <thead><tr><th scope="col">Pick</th>{BANDS.map(([k, label, lo, hi]) => <th key={k} scope="col" className={mine(lo, hi) ? "mine" : ""}>{label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.call}>
              <th scope="row">{r.name} <Cite text={r.call} /></th>
              {BANDS.map(([k, , lo, hi]) => {
                const v = r.age[k];
                return <td key={k} className={`${mine(lo, hi) ? "mine " : ""}${v > 0 ? "pos" : v < 0 ? "neg" : ""}`}>{v === undefined ? "–" : `${v > 0 ? "+" : ""}${v.toFixed(2)}`}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TABS = [["month", "The month"], ["shortlist", "Your shortlist"], ["compare", "With and without Qloo"], ["audience", "Audience and city"],
  ["limits", "Limits and checks"], ["trail", "Research trail"]] as const;
type Tab = (typeof TABS)[number][0];

export function ProgrammeView({ programme, venue, events, trail }: { programme: Programme; venue: VenueInput; events: AgentEvent[]; trail: ReactNode }) {
  const [tab, setTab] = useState<Tab>("month");
  const tabsRef = useRef<HTMLDivElement | null>(null);
  // A citation anywhere on the page opens the research trail at that call.
  useEffect(() => {
    const show = (ev: Event) => {
      const id = (ev as CustomEvent<string>).detail;
      setTab("trail");
      requestAnimationFrame(() => {
        const el = document.getElementById(`step-${id}`);
        el?.querySelector("details")?.setAttribute("open", "");
        el?.scrollIntoView({ block: "center" });
      });
    };
    window.addEventListener("marquee:cite", show);
    return () => window.removeEventListener("marquee:cite", show);
  }, []);
  const open = (t: Tab, target?: string) => {
    setTab(t);
    requestAnimationFrame(() => (target ? document.getElementById(target) : tabsRef.current)?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };
  const images = imageIndex(events);
  const names = nameIndex(events);
  const shown = (f: string) => (f === f.toLowerCase() ? names.get(f.normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim()) ?? f : f);
  // An event title that repeats a pick in lower case ("Dehd with good looks") gets the pick in Qloo's spelling.
  const canonical = (f: string) => names.get(f.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()) ?? f;
  // A bookable title as the venue typed it ("Squirrel Flower"), not as Qloo stores it ("squirrel flower").
  const typed = new Map((venue.shortlist ?? []).map((t) => [t.toLowerCase(), t]));
  const asTyped = (n: string) => typed.get(n.toLowerCase()) ?? n;
  const titleOf = (e: ProgrammeEvent) => e.featured.reduce((t, f) => {
    const lower = f.toLowerCase();
    return t.includes(lower) && !t.includes(canonical(f)) ? t.split(lower).join(canonical(f)) : t;
  }, e.title);
  const dated = programme.events
    .map((e, i) => ({ e: { ...e, title: titleOf(e) }, date: dateFor(e.when, venue.month, i, programme.events.length, e.date, e.start_time) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const evidence = comparisons(events, { featured: programme.events.flatMap((e) => e.featured) });
  const baselineEvent = events.find((e): e is Extract<AgentEvent, { type: "baseline" }> => e.type === "baseline");
  const baseline = baselineEvent?.programme;
  const scored = events.flatMap((x) => (x.type === "tool_result" && x.name === "qloo_rank" ? scoreRows(x.raw).map((r) => r.name) : []));
  const diff = baseline ? diffPlans(programme, baseline, baselineEvent?.second, scored) : null;
  // What Qloo told Marquee that a plan without it could not know, counted from the run itself.
  const shortlistLocal = evidence.find((c) => c.kind === "shortlist");
  // With no city ranking that scored any bookable title, the place Qloo was asked about, so the page can say "none".
  const noLocal = venue.shortlist?.map((t) => standings(events, t)).find((x) => x.localTried && !x.local)?.localTried ?? null;
  const profiles = events.filter((e) => e.type === "tool_result" && e.name === "qloo_audience_demographics" && (e.result_count ?? 0) > 0).length;
  // Only cinemas and bookshops get a soundtrack; a music venue's or bar's programme is already artists.
  const soundtrack = venue.kind === "cinema" || venue.kind === "bookshop" ? programme.soundtrack : undefined;
  const informed = [
    ...(shortlistLocal ? [`Qloo ranked ${shortlistLocal.rows.filter((r) => r.local !== null).length} of your ${venue.shortlist?.length ?? shortlistLocal.rows.length} bookable titles in ${shortlistLocal.location}${(venue.shortlist?.length ?? 0) > shortlistLocal.rows.length ? ` (${(venue.shortlist?.length ?? 0) - shortlistLocal.rows.length} it could not match or score at all)` : ""}.`]
      : venue.shortlist?.length && noLocal ? [`Qloo ranked none of your ${venue.shortlist.length} bookable titles in ${noLocal}: its local data does not cover them.`] : []),
    ...(profiles ? [`It profiled the audiences of ${profiles} lead pick${profiles === 1 ? "" : "s"}.`] : []),
    ...(programme.partners?.length ? [`It found ${programme.partners.length} nearby places whose audiences share the taste.`] : []),
    ...(soundtrack?.length ? [`It found ${soundtrack.length} musicians with high affinity for this taste.`] : []),
  ];
  const [copied, setCopied] = useState(false);
  const VERDICT = verdictLabels(venue.kind);
  // The take / reserve / skip line comes from the verdicts themselves, so the summary can never contradict them.
  const byVerdict = (v: ShortlistNote["verdict"]) => (programme.shortlist_notes ?? []).filter((n) => n.verdict === v).map((n) => n.title);
  const verdictLine = programme.shortlist_notes?.length ? [
    byVerdict("programmed").length ? `Book ${byVerdict("programmed").join(", ")}.` : "",
    byVerdict("featured").length ? `${featuredVerb(venue.kind)} ${byVerdict("featured").join(", ")}.` : "",
    byVerdict("reserve").length ? `Hold ${byVerdict("reserve").join(", ")} in reserve.` : "",
    byVerdict("skip").length ? `Pass on ${byVerdict("skip").join(", ")}.` : "",
    byVerdict("not_found").length ? `Check the title${byVerdict("not_found").length === 1 ? "" : "s"} ${byVerdict("not_found").join(", ")}.` : "",
  ].filter(Boolean).join(" ") : "";
  const md = () => toMarkdown(programme, venue.month, venue.location);
  // Cards in calendar order, whatever order the agent wrote them in.

  return (
    <section className="programme">
      <header className="panel hero">
        <p className="eyebrow">{venue.location} · {venue.month}</p>
        <h2>{programme.headline}</h2>
        {programme.summary?.length ? (
          <ul className="summary">
            {programme.summary.map((s, i) => <li key={i}>{s}</li>)}
            {verdictLine && <li>{verdictLine}</li>}
          </ul>
        ) : <p className="read"><Cite text={programme.audience_read} /></p>}
        <MonthStrip dated={dated} push={programme.push} images={images} onOpen={(i) => open("month", `event-${i}`)} />
        {diff && <QlooChanged diff={diff} labels={VERDICT} informed={informed} onMore={() => open("compare")} />}
        <div className="actions">
          <button onClick={() => download(`marquee-${venue.month}.ics`, "text/calendar", toIcs(programme, venue.month, venue.location))}>
            Add to calendar (.ics)
          </button>
          <button onClick={async () => { await navigator.clipboard.writeText(md()); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? "Copied" : "Copy as text"}
          </button>
        </div>
      </header>
      <div className="tabs" role="tablist" aria-label="Plan details" ref={tabsRef}>
        {TABS.filter(([t]) => (t !== "shortlist" || programme.shortlist_notes?.length) && (t !== "compare" || baseline)).map(([t, label]) => (
          <button key={t} role="tab" id={`tab-${t}`} aria-selected={tab === t} aria-controls={`panel-${t}`} className={tab === t ? "tab on" : "tab"} onClick={() => setTab(t)}>{label}</button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tabpanel">
      {tab === "month" && <>
      {programme.summary?.length ? <details className="why panel"><summary>Why these picks</summary><p className="read"><Cite text={programme.audience_read} /></p></details> : null}
      <ol className="events">
        {dated.map(({ e, date }, i) => {
          const img = e.featured.map((f) => imageFor(images, f)).find(Boolean);
          return (
          <li key={i} id={`event-${i}`} className="panel event">
            {img && <img className="event-img" src={img} alt="" loading="lazy" referrerPolicy="no-referrer" />}
            <div className="event-head">
              <span className="when">{e.when.replace(/^week\s*\d+\s*[,:–-]?\s*/i, "")}</span>
              <span className={`confidence ${e.confidence}`}>{CONFIDENCE[e.confidence]}</span>
            </div>
            <p className="date">
              {fmt.format(date)}, {hhmm(date)}{e.runtime_minutes ? `–${hhmm(new Date(date.getTime() + e.runtime_minutes * 60000))}` : ""}
              {e.version && <span className="source"> · {e.version}</span>}
              {e.source && <span className="source"> · {e.on_record && e.source === "taste" ? "Taste pick · played on record" : SOURCE[e.source]}</span>}
            </p>
            <h3>{e.title}</h3>
            <p className="format">{e.format}</p>
            <ul className="featured">{e.featured.map((f) => <li key={f}>{shown(f)}</li>)}</ul>
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
          );
        })}
      </ol>
      </>}
      {tab === "shortlist" && programme.shortlist_notes?.length ? (
        <section className="panel verdicts">
          <h3>Your shortlist</h3>
          <p className="viz-sub">Under each verdict, where the title stands in Qloo's rankings; ≈ marks a score within 0.01 of a neighbour, a tie.</p>
          <ul>
            {programme.shortlist_notes.map((n) => (
              <li key={n.title}>
                <span className={`verdict ${n.verdict}`}>{VERDICT[n.verdict]}{n.held_for && n.verdict !== "programmed" && <span className="held">{heldLabel(n.held_for, venue.location.split(",").pop()!.trim())}</span>}</span>
                <span><strong>{n.title}</strong> — <Cite text={n.reason} />{n.evidence.length ? <> <Cite text={n.evidence.join(", ")} /></> : null}
                  <Facts s={standings(events, n.title)} /></span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {tab === "compare" && baseline && <WithoutQloo labels={VERDICT} ours={programme} theirs={baseline} second={baselineEvent?.second} city={evidence[0]?.location ?? venue.location}
        informed={informed} localSeen={evidence.some((c) => c.rows.some((r) => r.local !== null))} profilesSeen={profiles > 0} scored={scored} />}
      {tab === "audience" && <>
      {evidence.map((c) => <TasteVsPlace key={c.localCall} c={{ ...c, rows: c.rows.map((r) => ({ ...r, name: asTyped(r.name) })) }} />)}
      {(programme.partners?.length || programme.audience_check || soundtrack?.length) ? (
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
          {soundtrack?.length ? (
            <section className="panel">
              <h3>{soundtrackTitle(venue.kind)}</h3>
              <p className="viz-sub">Musicians with high affinity for this taste, from Qloo: a playlist for the lobby, or a themed night.</p>
              <p>{soundtrack.map((a) => a.name).join(" · ")} {soundtrack[0]?.evidence.length ? <><Cite text={soundtrack[0].evidence.join(", ")} /></> : null}</p>
            </section>
          ) : null}
          {programme.audience_check ? (
            <section className="panel">
              <h3>Audience check</h3>
              <p className="viz-sub">Who the lead picks' audiences lean towards, from Qloo's audience profiles.</p>
              <AgeTable rows={ageProfiles(events, entityNames(events))} venueAudience={venue.audience} />
              <p><Cite text={programme.audience_check} /></p>
            </section>
          ) : null}
        </div>
      ) : null}
      </>}
      {tab === "limits" && (
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
      )}
      {tab === "trail" && trail}
      </div>
    </section>
  );
}
