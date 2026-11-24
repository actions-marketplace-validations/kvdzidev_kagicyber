// Growth metrics from public APIs only: npm downloads and GitHub repository and release activity.
// Nothing here touches users or their audits. Not shipped in the npm package.
// Usage: node scripts/metrics.mjs [--json]   (set GITHUB_TOKEN to raise the GitHub rate limit)
const PKG = 'kagicyber';
const REPO = 'kvdzidev/kagicyber';
const headers = { 'user-agent': 'kagicyber-metrics', accept: 'application/vnd.github+json' };
if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function get(url, h = {}) {
  const res = await fetch(url, { headers: h, signal: AbortSignal.timeout(15000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

const npm = async (period) => (await get(`https://api.npmjs.org/downloads/point/${period}/${PKG}`))?.downloads ?? 0;

const [week, month, year, daily, repo, releases] = await Promise.all([
  npm('last-week'),
  npm('last-month'),
  npm('last-year'),
  get(`https://api.npmjs.org/downloads/range/last-month/${PKG}`),
  get(`https://api.github.com/repos/${REPO}`, headers),
  get(`https://api.github.com/repos/${REPO}/releases?per_page=20`, headers),
]);

const out = {
  collectedAt: new Date().toISOString(),
  npm: { lastWeek: week, lastMonth: month, lastYear: year, daily: (daily?.downloads || []).map((d) => [d.day, d.downloads]) },
  github: repo && {
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    watchers: repo.subscribers_count,
    openIssuesAndPrs: repo.open_issues_count,
    pushedAt: repo.pushed_at,
  },
  releases: (releases || []).map((r) => ({
    tag: r.tag_name,
    publishedAt: r.published_at,
    prerelease: r.prerelease,
    assetDownloads: r.assets.reduce((n, a) => n + a.download_count, 0),
  })),
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log(`npm ${PKG}: ${week} downloads last week, ${month} last month, ${year} last year`);
  if (out.github) console.log(`GitHub ${REPO}: ${out.github.stars} stars, ${out.github.forks} forks, ${out.github.watchers} watchers, ${out.github.openIssuesAndPrs} open issues and PRs`);
  for (const r of out.releases) console.log(`  ${r.tag.padEnd(10)} ${r.publishedAt?.slice(0, 10) ?? 'draft'}${r.prerelease ? ' (pre-release)' : ''}`);
}
