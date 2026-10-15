import { Cite } from "./Cite";
import type { Comparison } from "./evidence";

const ord = (n: number) => `#${n}`;
const at = (pos: number, n: number) => (n < 2 ? 50 : ((pos - 1) / (n - 1)) * 100);

/**
 * A dumbbell per title: its position by taste (ring) and in the venue's city (dot), on the same 1..n axis. Positions
 * are counted within one ranking each, so nothing here compares scores across calls. A title Qloo has no local data
 * for keeps only its ring and says so; that is missing data, not a low rank.
 */
export function TasteVsPlace({ c }: { c: Comparison }) {
  const n = c.rows.length;
  const city = c.location;
  const withLocal = c.rows.filter((r) => r.local !== null).length;
  return (
    <figure className="panel viz">
      <figcaption>
        <h3>{c.kind === "shortlist" ? "Your shortlist: taste vs. " : "Taste picks vs. "}{city}</h3>
        <p className="viz-sub">
          Position among these {n} titles by your regulars' taste (<Cite text={c.tasteCall} />) and by affinity in {city} (<Cite text={c.localCall} />).
          {withLocal < n && ` Qloo has ${city} data for ${withLocal} of ${n}.`}
        </p>
        <ul className="viz-legend" aria-label="Legend">
          <li><span className="mark ring" aria-hidden /> By taste</li>
          <li><span className="mark dot" aria-hidden /> In {city}</li>
          <li><span className="tag">in programme</span></li>
        </ul>
      </figcaption>
      <div className="dumbbells" role="list">
        <div className="db-axis" aria-hidden><span className="db-ends"><span>#1 (best)</span><span>{ord(n)}</span></span></div>
        {c.rows.map((r) => {
          const label = `${r.name}: ${ord(r.taste)} by taste, ${r.local ? `${ord(r.local)} in ${city}` : `no ${city} data`}`;
          const a = at(r.taste, n);
          const b = r.local ? at(r.local, n) : null;
          return (
            <div key={r.id} className={`db-row${r.programmed ? " on" : ""}`} role="listitem" title={label} aria-label={label}>
              <span className="db-name">
                {r.name} {r.programmed && <span className="tag">in programme</span>}
              </span>
              <span className="db-strip" aria-hidden>
                {b !== null && <span className="db-link" style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(a - b)}%` }} />}
                <span className="mark ring" style={{ left: `${a}%` }} />
                {b !== null && <span className="mark dot" style={{ left: `${b}%` }} />}
              </span>
              <span className="db-value">{ord(r.taste)} → {r.local ? ord(r.local) : <em>no data</em>}</span>
            </div>
          );
        })}
      </div>
      <details className="viz-table">
        <summary>Table</summary>
        <table>
          <thead><tr><th scope="col">Title</th><th scope="col">By taste</th><th scope="col">In {city}</th><th scope="col">In programme</th></tr></thead>
          <tbody>
            {c.rows.map((r) => (
              <tr key={r.id}><td>{r.name}</td><td>{ord(r.taste)}</td><td>{r.local ? ord(r.local) : "no data"}</td><td>{r.programmed ? "yes" : ""}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
