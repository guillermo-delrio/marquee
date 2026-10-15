import { scoreRows } from "./evidence";
import { entityNames, label } from "./trailLabels";
import type { AgentEvent } from "./types";

type Call = Extract<AgentEvent, { type: "tool_call" }>;
type Result = Extract<AgentEvent, { type: "tool_result" }>;

/**
 * Affinity per result as bars from zero, in Qloo's order: blue for a taste-only call, amber for one conditioned on a
 * place (the same encoding as the taste-vs-city chart). Close scores look close, and a score within 0.01 of the one
 * above is marked as tied.
 */
function ScoreBars({ raw, local }: { raw: unknown; local: boolean }) {
  const rows = scoreRows(raw);
  if (!rows.length) return null;
  return (
    <figure className="bars" aria-label={`Affinity scores, ${local ? "with a location" : "by taste only"}`}>
      {rows.map((row, i) => (
        <div key={i} className="bar-row" title={`${row.name}: affinity ${row.score.toFixed(3)}${row.tied ? ", tied with the one above" : ""}`}>
          <span className="bar-name">{row.name}</span>
          <span className="bar-track"><span className={`bar ${local ? "local" : "taste"}`} style={{ width: `${row.score * 100}%` }} /></span>
          <span className="bar-value">{row.tied && <abbr title="Within 0.01 of the score above: effectively tied">≈ </abbr>}{row.score.toFixed(3)}</span>
        </div>
      ))}
    </figure>
  );
}

export function Trail({ events, running }: { events: AgentEvent[]; running: boolean }) {
  const calls = events.filter((e): e is Call => e.type === "tool_call");
  const results = new Map(events.filter((e): e is Result => e.type === "tool_result").map((r) => [r.call_id, r]));
  if (!calls.length && !running) return null;
  const names = entityNames(events);
  return (
    <section className="panel trail" aria-live="polite">
      <h2>Research trail</h2>
      <ol>
        {calls.map((c) => {
          const r = results.get(c.call_id);
          // needs_input is Qloo asking which of several matches was meant: the agent picks one and calls again.
          const state = !r ? "pending" : r.status === "ok" ? "ok" : r.status === "error" ? "error" : r.status === "needs_input" ? "retry" : "partial";
          return (
            <li key={c.call_id} id={`step-${c.call_id}`} className={`step ${state}`}>
              <div className="step-head">
                <span className="call-id">{c.call_id}</span>
                <span className="step-label">{label(c, names)}</span>
                <span className="step-status">{r ? (r.status === "needs_input" ? "ambiguous: asked again" : `${r.status}${r.result_count !== undefined ? ` · ${r.result_count}` : ""}`) : "…"}</span>
              </div>
              {r && (
                <details>
                  <summary>{r.summary || "Result"}</summary>
                  {r.warnings?.length ? <p className="warn">{r.warnings.join(" ")}</p> : null}
                  <ScoreBars raw={r.raw} local={Boolean(c.args.signal_location)} />
                  <details className="raw">
                    <summary>Request and raw Qloo result</summary>
                    <p className="mono-label">Request</p>
                    <pre>{JSON.stringify({ tool: c.name, ...c.args }, null, 2)}</pre>
                    <p className="mono-label">Qloo result</p>
                    <pre>{JSON.stringify(r.raw, null, 2)}</pre>
                  </details>
                </details>
              )}
            </li>
          );
        })}
        {running && <li className="step pending thinking">Thinking about what to ask next…</li>}
      </ol>
    </section>
  );
}
