import { Cite } from "./Cite";
import type { Programme } from "./types";

const VERDICT = { programmed: "Programmed", reserve: "Reserve", skip: "Skip", not_found: "Not found" } as const;

/** Titles compare without authors ("Piranesi by Susanna Clarke"), notes in brackets, case or punctuation. */
const key = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s*[([].*?[)\]]\s*/g, " ").replace(/\s+by\s+.*$/, "")
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const titles = (p: Programme) => {
  const out = new Map<string, string>();
  for (const e of p.events) for (const f of e.featured) if (!out.has(key(f))) out.set(key(f), f);
  return out;
};

/**
 * The brief's test, "would this work the same without Qloo?", shown as facts rather than a score: the same model
 * planned the month with no Qloo, and this lists where the two plans differ and the evidence Marquee had for its
 * verdicts. Nothing here grades one plan with the data the other was built from.
 */
export function WithoutQloo({ ours, theirs, city }: { ours: Programme; theirs: Programme; city: string }) {
  const a = titles(ours);
  const b = titles(theirs);
  const onlyOurs = [...a].filter(([k]) => !b.has(k)).map(([, t]) => t);
  const onlyTheirs = [...b].filter(([k]) => !a.has(k)).map(([, t]) => t);
  const both = [...a].filter(([k]) => b.has(k)).map(([, t]) => t);
  const theirVerdicts = new Map((theirs.shortlist_notes ?? []).map((n) => [key(n.title), n]));
  const verdicts = (ours.shortlist_notes ?? []).map((n) => ({ ours: n, theirs: theirVerdicts.get(key(n.title)) }));
  const differ = verdicts.filter((v) => v.theirs && v.theirs.verdict !== v.ours.verdict);
  const programmedByThem = verdicts.filter((v) => v.theirs?.verdict === "programmed").length;
  return (
    <section className="panel without">
      <h3>With and without Qloo</h3>
      <p className="viz-sub">
        The same model planned this month again with no Qloo: no data on how titles land in {city}, who their audiences are,
        or which local places share the taste. Here is where the two plans part ways.
      </p>
      {verdicts.length > 0 && (
        <p className="without-lead">
          Without Qloo it programmed <strong>{programmedByThem} of {verdicts.length}</strong> bookable titles; with Qloo,
          <strong> {verdicts.filter((v) => v.ours.verdict === "programmed").length}</strong>, and {differ.length} verdict{differ.length === 1 ? "" : "s"} differ.
        </p>
      )}
      <div className="without-cols">
        <div><h4>Only with Qloo</h4><ul className="plain">{onlyOurs.map((t) => <li key={t}>{t}</li>)}</ul></div>
        <div><h4>Only without Qloo</h4><ul className="plain">{onlyTheirs.map((t) => <li key={t}>{t}</li>)}</ul>{onlyTheirs.length === 0 && <p className="muted">None</p>}</div>
        <div><h4>Both</h4><ul className="plain">{both.map((t) => <li key={t}>{t}</li>)}</ul>{both.length === 0 && <p className="muted">None</p>}</div>
      </div>
      {differ.length > 0 && (
        <table className="verdict-table">
          <thead><tr><th scope="col">Title</th><th scope="col">Without Qloo</th><th scope="col">With Qloo, and why</th></tr></thead>
          <tbody>
            {differ.map((v) => (
              <tr key={v.ours.title}>
                <td>{v.ours.title}</td>
                <td>{VERDICT[v.theirs!.verdict]}</td>
                <td><strong>{VERDICT[v.ours.verdict]}</strong>: <Cite text={v.ours.reason} />{v.ours.evidence.length ? <> (<Cite text={v.ours.evidence.join(", ")} />)</> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <details>
        <summary>The plan without Qloo</summary>
        <p><strong>{theirs.headline}</strong></p>
        <ul className="plain">
          {theirs.events.map((e, i) => <li key={i}>{e.date ?? e.when}: {e.title} ({e.featured.join(", ")})</li>)}
        </ul>
        <p className="muted">No citations: on taste alone a strong model knows well-known titles about as well as Qloo, but it cannot see how they land in {city}, who their audiences are, or which places share them.</p>
      </details>
    </section>
  );
}
