function encode(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new TypeError('Canonical JSON rejects non-finite numbers.');
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => encode(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    return `{${entries
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${encode(item)}`)
      .join(',')}}`;
  }
  throw new TypeError(
    'Canonical JSON rejects undefined, bigint, function, and symbol values.',
  );
}

export function canonicalJson(value: unknown): string {
  return encode(value);
}
