export function iso(value: Date) {
  return value.toISOString();
}

export function decimal(value: { toString(): string } | string | number) {
  return value.toString();
}
