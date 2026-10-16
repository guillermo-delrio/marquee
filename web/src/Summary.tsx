import { imageFor } from "./images";
import type { PlanDiff } from "./WithoutQloo";
import type { ProgrammeEvent, ShortlistNote } from "./types";

const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric" });
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The month at a glance: one tile per event, in date order, with Qloo's image of what it features. */
export function MonthStrip({ dated, push, images, onOpen }: {
  dated: { e: ProgrammeEvent; date: Date }[]; push?: string; images: Map<string, string>; onOpen: (i: number) => void;
}) {
  return (
    <ol className="month-strip" aria-label="The month at a glance">
      {dated.map(({ e, date }, i) => {
        const img = e.featured.map((f) => imageFor(images, f)).find(Boolean);
        const pushed = push === isoDay(date);
        return (
          <li key={i} className={pushed ? "tile push" : "tile"}>
            <button onClick={() => onOpen(i)} aria-label={`${day.format(date)}: ${e.title}${pushed ? ", the night to push" : ""}`}>
              <span className="tile-img">{img ? <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="tile-blank" aria-hidden="true">{e.title.slice(0, 1)}</span>}</span>
              <span className="tile-date">{day.format(date)} · {hhmm(date)}</span>
              <span className="tile-title">{e.title}</span>
              {pushed && <span className="tile-push">Push night</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

const RESTS = { "Qloo data": "rests on Qloo's data", "Slot choice": "which titles fill the slots", Judgement: "Marquee's judgement", "No Qloo data": "no Qloo data on it" } as const;

/** The few facts a reader needs to see what Qloo changed, before any detail: from the run's own control plans. */
export function QlooChanged({ diff, labels, informed, onMore }: {
  diff: PlanDiff; labels: Record<ShortlistNote["verdict"], string>; informed: string[]; onMore: () => void;
}) {
  // Differences Qloo's data decides first, then the rest, each labelled with what it rests on.
  const order = ["Qloo data", "Slot choice", "Judgement", "No Qloo data"];
  const verdicts = [...diff.differ].sort((a, b) => order.indexOf(diff.restsOn(a.ours)) - order.indexOf(diff.restsOn(b.ours))).slice(0, 3);
  const added = diff.onlyOurs.slice(0, 4);
  // The push night differs only when neither plan without Qloo pushed the same date (event names vary by wording).
  const pushDiffers = !!diff.ourPush && !!diff.pushes[1] && !diff.pushes[1].split("; ").some((x) => x.startsWith(`${diff.ourPush!.when},`));
  if (!verdicts.length && !added.length && !pushDiffers) return null;
  return (
    <section className="changed" aria-labelledby="changed-h">
      <h3 id="changed-h">With Qloo and without</h3>
      <p className="viz-sub">The same model planned this month twice without Qloo. Only differences both of those plans agree on are listed.</p>
      <ul>
        {informed[0] && <li><span className="changed-k">What Qloo knew</span> {informed[0]}</li>}
        {pushDiffers && <li><span className="changed-k">Push night</span> with Qloo <strong>{diff.pushes[0]}</strong>; without, {diff.pushes[1]}</li>}
        {verdicts.map((v) => (
          <li key={v.ours.title}><span className="changed-k">{v.ours.title}</span> without Qloo {labels[v.theirs!].toLowerCase()}; with Qloo <strong>{labels[v.ours.verdict].toLowerCase()}</strong> <span className="muted">({RESTS[diff.restsOn(v.ours) as keyof typeof RESTS]})</span></li>
        ))}
        {added.length > 0 && <li><span className="changed-k">Only with Qloo</span> {added.join(" · ")}</li>}
      </ul>
      <button className="link" onClick={onMore}>The full comparison</button>
    </section>
  );
}
