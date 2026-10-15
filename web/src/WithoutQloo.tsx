import { Cite } from "./Cite";
import type { Programme } from "./types";

export interface ComparisonRow {
  name: string;
  source: "marquee" | "baseline" | "both";
  position: number | null;
  found: boolean;
}

const SOURCE = { marquee: "Marquee", baseline: "Claude alone", both: "Both" } as const;
const VERDICT = { programmed: "Programmed", reserve: "Reserve", skip: "Skip", not_found: "Not found" } as const;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * The brief's own test: would this work the same without Qloo? The same model planned the month with no Qloo; one Qloo
 * ranking by the regulars' taste then placed both plans' picks, so the two are measured in a single call.
 */
export function WithoutQloo({ ours, theirs, rows, rankCall, noun }: {
  ours: Programme; theirs: Programme; rows: ComparisonRow[]; rankCall: string; noun: string;
}) {
  const placed = rows.filter((r) => r.position !== null);
  const avg = (s: "marquee" | "baseline") => mean(placed.filter((r) => r.source === s || r.source === "both").map((r) => r.position!));
  const a = avg("marquee");
  const b = avg("baseline");
  const theirVerdicts = new Map((theirs.shortlist_notes ?? []).map((n) => [n.title.toLowerCase(), n.verdict]));
  const verdictRows = (ours.shortlist_notes ?? []).map((n) => ({ title: n.title, ours: n.verdict, theirs: theirVerdicts.get(n.title.toLowerCase()) }));
  return (
    <section className="panel without">
      <h3>With and without Qloo</h3>
      <p className="viz-sub">
        The same model planned this month again from its own knowledge, with no Qloo. One Qloo ranking by your regulars' taste
        (<Cite text={rankCall} />) then placed both plans' picks{a !== null && b !== null ? <>: on average, Marquee's sit at
        <strong> #{a.toFixed(1)}</strong>, Claude alone's at <strong>#{b.toFixed(1)}</strong> (lower is closer to your regulars' taste).</>
          : a !== null ? <>. None of Claude alone's own picks is one of the {noun} Qloo could find, so only Marquee's could be ranked.</> : "."}
      </p>
      <ol className="compare">
        {rows.map((r) => (
          <li key={r.name} className={r.source}>
            <span className="pos">{r.position !== null ? `#${r.position}` : "–"}</span>
            <span className="name">{r.name}</span>
            <span className={`tag ${r.source}`}>{SOURCE[r.source]}</span>
            {!r.found && <span className="muted">not found among Qloo's {noun}</span>}
            {r.found && r.position === null && <span className="muted">not scored</span>}
          </li>
        ))}
      </ol>
      {verdictRows.length > 0 && (
        <details>
          <summary>Shortlist verdicts, side by side</summary>
          <table className="verdict-table">
            <thead><tr><th scope="col">Title</th><th scope="col">Marquee</th><th scope="col">Claude alone</th></tr></thead>
            <tbody>
              {verdictRows.map((v) => (
                <tr key={v.title} className={v.theirs && v.theirs !== v.ours ? "differs" : ""}>
                  <td>{v.title}</td><td>{VERDICT[v.ours]}</td><td>{v.theirs ? VERDICT[v.theirs] : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      <details>
        <summary>Claude alone's plan</summary>
        <p><strong>{theirs.headline}</strong></p>
        <ul className="plain">
          {theirs.events.map((e, i) => <li key={i}>{e.date ?? e.when}: {e.title} — {e.featured.join(", ")}</li>)}
        </ul>
        <p className="muted">No citations: nothing in this plan is grounded in data about your audience or your city.</p>
      </details>
    </section>
  );
}
