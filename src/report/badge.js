const COLORS = { A: 'brightgreen', B: 'green', C: 'yellow', D: 'orange', F: 'red' };

export function badgeUrl(r) {
  const msg = encodeURIComponent(`${r.scores.grade} · ${r.scores.security}/100`).replace(/-/g, '--');
  return `https://img.shields.io/badge/KagiCyber-${msg}-${COLORS[r.scores.grade] || 'lightgrey'}`;
}

export function badgeMarkdown(r) {
  return `[![KagiCyber security grade](${badgeUrl(r)})](https://kagicyber.com)`;
}
