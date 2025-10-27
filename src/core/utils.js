export function seededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function applyEasing(t, easing) {
  switch ((easing || '').toLowerCase()) {
    case 'easein':
      return t * t;
    case 'easeout':
      return 1 - Math.pow(1 - t, 2);
    case 'easeinout':
    case 'smooth':
      return t * t * (3 - 2 * t);
    case 'fastin':
      return Math.pow(t, 1.5);
    case 'fastout':
      return 1 - Math.pow(1 - t, 1.5);
    case 'linear':
    default:
      return t;
  }
}
