/** Render text, turning call ids (q1, q12) into links that open that step of the research trail. */
export function Cite({ text }: { text: string }) {
  const parts = text.split(/(\bq\d{1,2}\b)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^q\d{1,2}$/.test(part) ? (
          <a key={i} className="cite" href={`#step-${part}`} title={`Qloo call ${part}`}
            onClick={(ev) => { ev.preventDefault(); window.dispatchEvent(new CustomEvent("marquee:cite", { detail: part })); }}>
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
