// Single byte ranges are sufficient for native media seeking. Unsupported units
// and multipart requests fall back to a full response, as allowed by HTTP.
export function byteRange(header, size) {
  if (!header || !header.startsWith('bytes=') || header.includes(',')) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || size <= 0) return 'unsatisfiable';
  const first = match[1] ? Number(match[1]) : null;
  const last = match[2] ? Number(match[2]) : null;
  if ((first !== null && !Number.isSafeInteger(first)) || (last !== null && !Number.isSafeInteger(last))) return 'unsatisfiable';
  if (first === null) {
    if (!last) return 'unsatisfiable';
    return { start: Math.max(0, size - last), end: size - 1 };
  }
  if (first >= size || (last !== null && last < first)) return 'unsatisfiable';
  return { start: first, end: Math.min(last ?? size - 1, size - 1) };
}
