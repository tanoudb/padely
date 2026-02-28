export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function round(value, decimals = 2) {
  const p = 10 ** decimals;
  return Math.round(value * p) / p;
}
