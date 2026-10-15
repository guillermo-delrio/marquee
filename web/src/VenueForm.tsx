import { useState, type FormEvent, type KeyboardEvent } from "react";

import type { VenueInput, VenueKind } from "./types";

const KINDS: { kind: VenueKind; label: string; hits: string; bookable: string }[] = [
  { kind: "cinema", label: "Cinema", hits: "e.g. Past Lives", bookable: "e.g. films your distributor offers" },
  { kind: "bookshop", label: "Bookshop", hits: "e.g. Piranesi", bookable: "e.g. titles with authors on tour" },
  { kind: "music_bar", label: "Music bar", hits: "e.g. Khruangbin", bookable: "e.g. acts your agent can offer" },
];

const nextMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Free-text titles as removable chips: Enter or a comma adds one, as does leaving the field. */
function ChipInput({ values, onChange, max, placeholder, label, onDraft }: {
  values: string[]; onChange: (v: string[]) => void; max: number; placeholder?: string; label: string;
  /** The text typed but not yet added, so a form can count it as entered. */
  onDraft?: (draft: string) => void;
}) {
  const [draft, setDraftState] = useState("");
  const setDraft = (d: string) => { setDraftState(d); onDraft?.(d); };
  const add = () => {
    const h = draft.trim();
    if (h && values.length < max && !values.includes(h)) onChange([...values, h]);
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    }
  };
  return (
    <div className="chips">
      {values.map((h) => (
        <span key={h} className="chip">
          {h}
          <button type="button" aria-label={`Remove ${h}`} onClick={() => onChange(values.filter((x) => x !== h))}>×</button>
        </span>
      ))}
      {values.length < max && (
        <input aria-label={label} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={add}
          placeholder={placeholder} maxLength={80} />
      )}
    </div>
  );
}

export function VenueForm({ initial, busy, onSubmit }: { initial?: VenueInput; busy: boolean; onSubmit: (v: VenueInput) => void }) {
  const [kind, setKind] = useState<VenueKind>(initial?.kind ?? "cinema");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [hits, setHits] = useState<string[]>(initial?.recentHits ?? []);
  const [hitDraft, setHitDraft] = useState("");
  const [shortlist, setShortlist] = useState<string[]>(initial?.shortlist ?? []);
  const [audience, setAudience] = useState(initial?.audience ?? "");
  const [month, setMonth] = useState(initial?.month ?? nextMonth());
  const [slots, setSlots] = useState(initial?.slots ?? 8);
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const recentHits = [...new Set([...hits, hitDraft.trim()].filter(Boolean))].slice(0, 5);
    onSubmit({ kind, location, recentHits, audience: audience || undefined, month, slots, notes: notes || undefined,
      shortlist: shortlist.length ? shortlist : undefined });
  };
  const ready = location.trim().length > 1 && (hits.length > 0 || hitDraft.trim().length > 0) && !busy;
  const k = KINDS.find((x) => x.kind === kind);

  return (
    <form className="panel form" onSubmit={submit}>
      <fieldset className="kinds">
        <legend>Venue</legend>
        {KINDS.map((k) => (
          <button type="button" key={k.kind} className={k.kind === kind ? "kind on" : "kind"} onClick={() => setKind(k.kind)}>
            {k.label}
          </button>
        ))}
      </fieldset>
      <label>
        City (or neighbourhood)
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Lavapiés, Madrid" maxLength={80} />
      </label>
      <label>
        Recent hits <small>up to 5 — what filled the room</small>
        <ChipInput values={hits} onChange={setHits} max={5} placeholder={k?.hits} label="Add a recent hit" onDraft={setHitDraft} />
      </label>
      <label>
        Titles you can book <small>optional, up to 10 — Marquee picks from these first</small>
        <ChipInput values={shortlist} onChange={setShortlist} max={10} placeholder={k?.bookable} label="Add a bookable title" />
      </label>
      <label>
        Audience <small>optional, broad: "students", "families", "people 25-34"</small>
        <input value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={60} />
      </label>
      <div className="row">
        <label>
          Month
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        <label>
          Events: {slots}
          <input type="range" min={4} max={12} value={slots} onChange={(e) => setSlots(Number(e.target.value))} />
        </label>
      </div>
      <label>
        Constraints <small>optional</small>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={240}
          placeholder="e.g. Thursday to Sunday evenings; one family matinee" />
      </label>
      <button className="primary" disabled={!ready}>{busy ? "Researching…" : "Plan the month"}</button>
    </form>
  );
}
