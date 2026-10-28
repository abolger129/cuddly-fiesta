/**
 * Record-style track numbers: the first half of a list is side A, the rest side B.
 * Three songs read A1, A2, B1; six read A1, A2, A3, B1, B2, B3.
 */
export function trackLabel(index: number, total: number): string {
  const sideA = Math.ceil(total / 2);
  return index < sideA ? `A${index + 1}` : `B${index - sideA + 1}`;
}
