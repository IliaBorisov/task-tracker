const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const releasePath = path.join(projectRoot, 'release');
const releaseNumberPath = path.join(projectRoot, 'build', 'release-number.txt');
const isWindows = process.platform === 'win32';

function readCurrentReleaseNumber() {
  if (!fs.existsSync(releaseNumberPath)) {
    return 0;
  }

  const releaseNumber = Number.parseInt(fs.readFileSync(releaseNumberPath, 'utf8').trim(), 10);

  if (!Number.isSafeInteger(releaseNumber) || releaseNumber < 0) {
    throw new Error(`Invalid release number in ${releaseNumberPath}`);
  }

  return releaseNumber;
}

function run(command, args, releaseNumber) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      RELEASE_NUMBER: String(releaseNumber),
    },
    shell: isWindows,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function cleanReleaseDirectory() {
  fs.rmSync(releasePath, { force: true, recursive: true });
  fs.mkdirSync(releasePath, { recursive: true });
}

const nextReleaseNumber = readCurrentReleaseNumber() + 1;

console.log(`Building Windows release ${nextReleaseNumber}`);

run('npm', ['run', 'build'], nextReleaseNumber);
cleanReleaseDirectory();
run('electron-builder', ['--win', '--x64'], nextReleaseNumber);

fs.mkdirSync(path.dirname(releaseNumberPath), { recursive: true });
fs.writeFileSync(releaseNumberPath, `${nextReleaseNumber}\n`, 'utf8');

console.log(`Windows release ${nextReleaseNumber} complete`);
