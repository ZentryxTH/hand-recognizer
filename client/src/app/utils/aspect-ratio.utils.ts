export const ASPECT_RATIOS: Record<string, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '4:3': 4 / 3,
  '3:4': 3 / 4,
  '5:4': 5 / 4,
  '4:5': 4 / 5,
  '1:1': 1,
};

export function parseAspectRatio(ratioStr: string, defaultRatio = 16 / 9): number {
  return ASPECT_RATIOS[ratioStr] || defaultRatio;
}

export function getAspectRatioClass(ratioStr: string): string {
  if (ratioStr in ASPECT_RATIOS) {
    return `ratio-${ratioStr.replace(':', '-')}`;
  }
  return 'ratio-16-9';
}
