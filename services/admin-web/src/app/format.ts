export function formatTimestamp(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '-';
  }

  return new Date(value).toISOString();
}

export function stringifyValue(value: string | number | boolean | undefined): string {
  if (value === undefined) {
    return '';
  }

  return String(value);
}
