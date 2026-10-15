/**
 * The model copies 36-character entity ids badly (mixed, truncated: a wasted call each time), so it never sees them:
 * results show short handles (e1, e2, ...) and tool arguments map them back before the call reaches Qloo.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HANDLE = /^e\d+$/;

export function createHandles() {
  const toHandle = new Map<string, string>();
  const toId = new Map<string, string>();
  const map = (value: unknown, f: (s: string) => string): unknown => {
    if (typeof value === "string") return f(value);
    if (Array.isArray(value)) return value.map((v) => map(v, f));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, map(v, f)]));
    return value;
  };
  return {
    hide: <T>(value: T): T => map(value, (s) => {
      if (!UUID.test(s)) return s;
      const key = s.toUpperCase();
      if (!toHandle.has(key)) {
        const h = `e${toHandle.size + 1}`;
        toHandle.set(key, h);
        toId.set(h, s);
      }
      return toHandle.get(key)!;
    }) as T,
    reveal: <T>(value: T): T => map(value, (s) => (HANDLE.test(s) ? toId.get(s) ?? s : s)) as T,
  };
}
