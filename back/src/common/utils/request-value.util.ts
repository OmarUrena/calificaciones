export function readRequestValue(source: string, request: unknown): unknown {
  return source.split('.').reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, request);
}
