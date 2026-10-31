// Publishes the site. The built files (scripts, styles, fonts, pictures) go to
// lu1 (8.137.206.169, which has plenty of bandwidth), into qiqi-assets' public
// /assets/ next to qiqi.help's data versions. The page itself, the gate and
// the icon go to dist/ here. The homepage is served by daum.pw, and Caddy reads
// dist/ from this directory directly (2026-10-27 域名对调后更新).
//
// lu1 first, then the page, so a published page never points at files that
// are not there yet. Nothing is deleted: pages already open may still ask for
// older files, and every file name carries its content hash.
//
// usage: npm run deploy
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, readdirSync, readFileSync, renameSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { constants, gzipSync } from 'node:zlib';

const BASE = 'https://8.137.206.169/assets/daum12569/';
const LU1 = '/home/user1/apps/qiqi-assets/releases/daum12569';
const OUT = '.out';

function run(cmd, args, env) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) {
    console.error(`failed: ${cmd} ${args.join(' ')}`);
    process.exit(1);
  }
}

run('npm', ['run', 'check']);
run('npx', ['vite', 'build', '--outDir', OUT, '--emptyOutDir'], { DAUM_ASSET_BASE: BASE });

// lu1's nginx serves foo.js.gz for foo.js when it is there (gzip_static); by itself it only compresses JSON.
const assets = readdirSync(`${OUT}/assets`);
for (const name of assets.filter((n) => /\.(js|css|svg)$/.test(n))) {
  const file = `${OUT}/assets/${name}`;
  writeFileSync(`${file}.gz`, gzipSync(readFileSync(file), { level: constants.Z_BEST_COMPRESSION }));
  const { atime, mtime } = statSync(file);
  utimesSync(`${file}.gz`, atime, mtime);
}

// nginx reads as another user: directories 755, files 644.
run('ssh', ['lu1', `mkdir -p ${LU1}/assets && chmod 755 ${LU1} ${LU1}/assets`]);
run('rsync', ['-az', '--chmod=D755,F644', `${OUT}/assets/`, `lu1:${LU1}/assets/`]);

for (const name of assets) {
  const res = await fetch(`${BASE}assets/${name}`, { method: 'HEAD' });
  if (!res.ok) {
    console.error(`not reachable on lu1: ${name} (${res.status}); the page was not published`);
    process.exit(1);
  }
}

// A copy of the files here too, for the loading screen to fall back on when lu1 cannot be reached.
cpSync(`${OUT}/assets`, 'dist/assets', { recursive: true });
cpSync(`${OUT}/gate`, 'dist/gate', { recursive: true });
copyFileSync(`${OUT}/favicon.svg`, 'dist/favicon.svg');
// Swapped in whole, last.
copyFileSync(`${OUT}/index.html`, 'dist/index.html.next');
renameSync('dist/index.html.next', 'dist/index.html');

console.log(`published: ${assets.length} files on lu1 (${BASE}), the page in dist/`);
