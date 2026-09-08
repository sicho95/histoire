import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '.webapp-build');
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

function gitSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try { return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
}

const commitSha = gitSha();
const buildId = process.env.BUILD_ID || `${Date.now().toString(36)}-${commitSha.slice(0, 8)}`;
const updatedAt = new Date().toISOString();
const copyEntries = [
  'index.html', 'manifest.json', 'service-worker.js',
  'css', 'src', 'assets/icons', 'assets/stories', 'assets/choices', 'audio', 'stories'
];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const entry of copyEntries) {
  await cp(join(root, entry), join(out, entry), { recursive: true });
}

const version = { version: packageJson.version, buildId, updatedAt, commitSha };
await writeFile(join(out, 'version.json'), `${JSON.stringify(version, null, 2)}\n`);

const htmlPath = join(out, 'index.html');
const html = (await readFile(htmlPath, 'utf8'))
  .replaceAll('__APP_VERSION__', packageJson.version)
  .replaceAll('__BUILD_ID__', buildId);
await writeFile(htmlPath, html);

const updatePath = join(out, 'src/pwa/update.js');
const updateSource = (await readFile(updatePath, 'utf8')).replaceAll('__BUILD_ID__', buildId);
await writeFile(updatePath, updateSource);

const catalog = JSON.parse(await readFile(join(root, 'stories/catalog.json'), 'utf8'));
const audioManifest = JSON.parse(await readFile(join(root, 'audio/manifest.json'), 'utf8'));
const storyAssets = (catalog.stories || []).map(entry => `./stories/${entry.file}`);
const coverAssets = (catalog.stories || []).map(entry => entry.coverImage).filter(Boolean);
const genericChoiceAssets = ['explorer', 'ecouter', 'aider', 'courage', 'inventer', 'observer', 'chanter', 'suivre', 'partager', 'attendre', 'demander', 'rentrer']
  .map(name => `./assets/choices/${name}.svg`);
const choiceAssets = [...new Set([
  ...genericChoiceAssets,
  ...(catalog.stories || []).flatMap(entry => entry.choiceAssets || [])
])];
const assets = [
  './', './index.html', './manifest.json', './version.json',
  './css/variables.css', './css/layout.css', './css/components.css',
  './src/app.js', './src/pwa/update.js',
  './src/api/router.js', './src/api/prompts.js',
  './src/audio/choice-prompt.js', './src/audio/french-speech.js', './src/audio/stt.js', './src/audio/tts.js', './src/audio/wav.js',
  './src/export/story-package.js', './src/export/zip.js',
  './src/core/choices.js', './src/core/debug.js', './src/core/engine.js',
  './src/core/network.js', './src/core/state.js', './src/core/story-model.js', './src/core/weaver.js',
  './src/storage/audio_cache.js', './src/storage/database.js', './src/storage/settings.js',
  './src/ui/carousel.js', './src/ui/end_screen.js', './src/ui/library.js',
  './src/ui/parental.js', './src/ui/reader.js', './src/ui/wizard.js', './src/ui/toast.js',
  './assets/icons/icon.svg', './assets/icons/maskable.svg',
  './stories/catalog.json', './audio/manifest.json',
  ...storyAssets, ...coverAssets, ...choiceAssets
];
const swPath = join(out, 'service-worker.js');
const sw = (await readFile(swPath, 'utf8'))
  .replaceAll('__BUILD_ID__', buildId)
  .replaceAll('__AUDIO_STYLE_VERSION__', audioManifest.styleVersion || 'default')
  .replace('__PRECACHE_MANIFEST__', JSON.stringify(assets));
await writeFile(swPath, sw);
await writeFile(join(out, '.nojekyll'), '');

console.log(`Built ${relative(root, out)} (${buildId})`);
