export function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateArray(value: readonly unknown[]): void {
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError('Canonical JSON rejects symbol properties.');
  }
  const keys = Object.keys(value);
  if (
    keys.length !== value.length ||
    keys.some((key) => !/^(0|[1-9]\d*)$/.test(key))
  ) {
    throw new TypeError('Canonical JSON rejects sparse or extended arrays.');
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Object.values(descriptors).some(
      (descriptor) =>
        descriptor.get !== undefined || descriptor.set !== undefined,
    )
  ) {
    throw new TypeError('Canonical JSON rejects accessor properties.');
  }
}

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
    validateArray(value);
    return `[${value.map((item) => encode(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    if (!isPlainObject(value)) {
      throw new TypeError('Canonical JSON accepts plain objects only.');
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new TypeError('Canonical JSON rejects symbol properties.');
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      Object.values(descriptors).some(
        (descriptor) =>
          descriptor.get !== undefined || descriptor.set !== undefined,
      )
    ) {
      throw new TypeError('Canonical JSON rejects accessor properties.');
    }
    const entries = Object.entries(value);
    entries.sort(([left], [right]) => compareCodeUnits(left, right));
    return `{${entries
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
