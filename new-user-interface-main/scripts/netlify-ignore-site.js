const { execFileSync } = require('child_process');

const siteId = process.env.REEF_SITE_ID;
const previous = process.env.CACHED_COMMIT_REF;
const current = process.env.COMMIT_REF || 'HEAD';

// Exit 1 means Netlify should build. Exit 0 means it may safely ignore the build.
if (!siteId || !previous) process.exit(1);

try {
    const changed = execFileSync('git', ['diff', '--name-only', previous, current], { encoding: 'utf8' })
        .split(/\r?\n/)
        .filter(Boolean);
    const shouldBuild = changed.some(
        file =>
            file.startsWith(`sites/${siteId}/`) ||
            file.startsWith('new-user-interface-main/') ||
            file.startsWith('packages/')
    );
    process.exit(shouldBuild ? 1 : 0);
} catch {
    // A build is safer than skipping when commit comparison is unavailable.
    process.exit(1);
}
