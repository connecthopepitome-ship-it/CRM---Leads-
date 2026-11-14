/** FR-003 AC3: brand colour contrast (WCAG 2.2 SC 1.4.3, white text on the brand colour). */
const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Invalid colour ${hex}`);
  const n = parseInt(m[1]!, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
}
/** Darkens the colour in 5 % steps until white text reaches 4.5:1 (same hue). */
export function accessibleOnWhiteText(hex: string, min = 4.5): string {
  const n = parseInt(hex.replace('#', ''), 16);
  let [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const toHex = () => `#${[r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  for (let i = 0; i < 40 && contrastRatio(toHex(), '#FFFFFF') < min; i++) [r, g, b] = [r * 0.95, g * 0.95, b * 0.95];
  return toHex();
}
