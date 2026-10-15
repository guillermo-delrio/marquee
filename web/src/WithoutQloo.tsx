import { Cite } from "./Cite";
import type { Programme } from "./types";

const VERDICT = { programmed: "Programmed", featured: "Played, not booked", reserve: "Reserve", skip: "Skip", not_found: "Not found" } as const;

/** Titles compare without authors ("Piranesi by Susanna Clarke"), notes in brackets, case or punctuation. */
const key = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s*[([].*?[)\]]\s*/g, " ").replace(/\s+by\s+.*$/, "")
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const titles = (p: Programme) => {
  const out = new Map<string, string>();
  for (const e of p.events) for (const f of e.featured) if (!out.has(key(f))) out.set(key(f), f);
  return out;
};

/**
 * The brief's test, "would this work the same without Qloo?", shown as facts rather than a score. The same model,
 * with the same programme rules and no Qloo, planned the month twice: the two runs show how much plans differ by
 * chance, and a difference only counts when both runs without Qloo agree on it.
 */
export function WithoutQloo({ ours, theirs, second, city, informed, localSeen, profilesSeen }: {
  ours: Programme; theirs: Programme; second?: Programme; city: string; informed: string[]; localSeen: boolean; profilesSeen: boolean;
}) {
  const a = titles(ours);
  const b = titles(theirs);
  const c = second ? titles(second) : b;
  const inBoth = (k: string) => b.has(k) && c.has(k);
  const inEither = (k: string) => b.has(k) || c.has(k);
  const onlyOurs = [...a].filter(([k]) => !inEither(k)).map(([, t]) => t);
  const onlyTheirs = [...b].filter(([k]) => inBoth(k) && !a.has(k)).map(([, t]) => t);
  const shared = [...a].filter(([k]) => inBoth(k)).map(([, t]) => t);
  const runOverlap = second ? [...b.keys()].filter((k) => c.has(k)).length : null;
  const runUnion = second ? new Set([...b.keys(), ...c.keys()]).size : null;
  const v1 = new Map((theirs.shortlist_notes ?? []).map((n) => [key(n.title), n.verdict]));
  // A second run without verdicts cannot confirm or contradict the first, so the first stands alone.
  const v2 = new Map(((second?.shortlist_notes?.length ? second : theirs).shortlist_notes ?? []).map((n) => [key(n.title), n.verdict]));
  const verdicts = (ours.shortlist_notes ?? []).map((n) => ({ ours: n, theirs: v1.get(key(n.title)), again: v2.get(key(n.title)) }));
  // A verdict difference counts only when both runs without Qloo agree with each other and not with Marquee.
  const differ = verdicts.filter((v) => v.theirs && v.theirs === v.again && v.theirs !== v.ours.verdict);
  const unstable = verdicts.filter((v) => v.theirs && v.again && v.theirs !== v.again).length;
  const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const pushOf = (p?: Programme) => {
    const e = p?.push ? p.events.find((x) => x.date === p.push) : undefined;
    return e ? { what: e.title, when: day(p!.push!) } : null;
  };
  const ourPush = pushOf(ours);
  // The control runs' push nights, grouped by date: "Fri 6 Nov, The Substance (both runs)".
  const theirPush = new Map<string, { what: string; runs: number }>();
  for (const x of [pushOf(theirs), pushOf(second)]) if (x) theirPush.set(x.when, { what: x.what, runs: (theirPush.get(x.when)?.runs ?? 0) + 1 });
  const pushes = [ourPush ? `${ourPush.when}, ${ourPush.what}` : null,
    [...theirPush].map(([when, x]) => `${when}, ${x.what}${second ? (x.runs === 2 ? " (both runs)" : " (one run)") : ""}`).join("; ") || null];
  return (
    <section className="panel without">
      <h3>With and without Qloo</h3>
      {informed.length > 0 && (
        <ul className="informed">{informed.map((x) => <li key={x}>{x}</li>)}</ul>
      )}
      <p className="viz-sub">
        The same model, with the same rules and no Qloo, planned this month twice.
        {" "}It cannot see {[localSeen && `how titles land in ${city}`, profilesSeen && "who their audiences are", "which local places share the taste"].filter(Boolean).join(", ")}.
        {runOverlap !== null && <> Its two plans shared {runOverlap} of {runUnion} titles{unstable ? ` and disagreed with each other on ${unstable} verdict${unstable === 1 ? "" : "s"}` : ""}: that is how much plans differ by chance, so only differences both runs agree on are listed.</>}
      </p>
      {pushes[0] && pushes[1] && (
        <p className="without-lead">
          Night to push hardest: with Qloo, <strong>{pushes[0]}</strong>; without Qloo, {pushes[1]}.
        </p>
      )}
      <div className="without-cols">
        <div><h4>Only with Qloo</h4><ul className="plain">{onlyOurs.map((t) => <li key={t}>{t}</li>)}</ul>{onlyOurs.length === 0 && <p className="muted">None</p>}</div>
        <div><h4>Only without Qloo (both runs)</h4><ul className="plain">{onlyTheirs.map((t) => <li key={t}>{t}</li>)}</ul>{onlyTheirs.length === 0 && <p className="muted">None</p>}</div>
        <div><h4>All three plans</h4><ul className="plain">{shared.map((t) => <li key={t}>{t}</li>)}</ul>{shared.length === 0 && <p className="muted">None</p>}</div>
      </div>
      {differ.length > 0 && (
        <table className="verdict-table">
          <thead><tr><th scope="col">Title</th><th scope="col">Without Qloo (both runs)</th><th scope="col">With Qloo, and why</th></tr></thead>
          <tbody>
            {differ.map((v) => (
              <tr key={v.ours.title}>
                <td>{v.ours.title}</td>
                <td>{VERDICT[v.theirs!]}</td>
                <td><strong>{VERDICT[v.ours.verdict]}</strong>: <Cite text={v.ours.reason} />{v.ours.evidence.length ? <> <Cite text={v.ours.evidence.join(", ")} /></> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <details>
        <summary>The plans without Qloo</summary>
        {[theirs, second].filter((p): p is Programme => !!p).map((p, i) => (
          <div key={i}>
            <p><strong>Run {i + 1}: {p.headline}</strong></p>
            <ul className="plain">{p.events.map((e, j) => <li key={j}>{e.date ?? e.when}: {e.title} ({e.featured.join(", ")})</li>)}</ul>
          </div>
        ))}
        <p className="muted">No citations: on taste alone a strong model knows well-known titles about as well as Qloo; what it cannot see is the city, the audiences and the places.</p>
      </details>
    </section>
  );
}
