#!/usr/bin/env node
/**
 * build-plugin.mjs — regenerate the marketplace plugin snapshot.
 *
 * Source of truth:  skills/bitgold-network/
 * Generated mirror: plugins/bitgold-devkit/skills/bitgold-network/
 *
 * The mirror is byte-identical to the source tree, so a reviewer can diff the
 * two directories and compare hashes in distribution.json before publishing.
 *
 * Usage:
 *   node scripts/build-plugin.mjs           # rewrite mirror + distribution.json
 *   node scripts/build-plugin.mjs --check   # verify only; exit 1 if drifted
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SKILL_NAME = 'bitgold-network';
const PLUGIN_NAME = 'bitgold-devkit';
const PLUGIN_DIR = path.join(ROOT, 'plugins', PLUGIN_NAME);

const SOURCE_DIR = path.join(ROOT, 'skills', SKILL_NAME);
const MIRROR_DIR = path.join(PLUGIN_DIR, 'skills', SKILL_NAME);
const DISTRIBUTION_FILE = path.join(PLUGIN_DIR, 'distribution.json');

const REPOSITORY = 'https://github.com/bitgold-network/bitgold-skills';
const MANIFESTS = {
  claude: '.claude-plugin/plugin.json',
  cursor: '.cursor-plugin/plugin.json',
  codex: '.codex-plugin/plugin.json',
};

const checkOnly = process.argv.includes('--check');

/** Recursively list relative POSIX paths of all files under `dir`, sorted. */
async function listFiles(dir) {
  const out = [];
  async function walk(current, prefix) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(current, entry.name), rel);
      } else if (entry.isFile()) {
        out.push(rel);
      } else {
        throw new Error(`Unsupported entry (symlink or socket?): ${rel}`);
      }
    }
  }
  await walk(dir, '');
  return out.sort();
}

async function sha256File(file) {
  return createHash('sha256').update(await fs.readFile(file)).digest('hex');
}

/** Digest over the ordered "relpath<TAB>sha256<LF>" records. */
function payloadDigest(files) {
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(`${file.path}\t${file.sha256}\n`);
  }
  return hash.digest('hex');
}

async function main() {
  await fs.access(SOURCE_DIR).catch(() => {
    throw new Error(`Source skill not found: ${SOURCE_DIR}`);
  });

  const sourceFiles = await listFiles(SOURCE_DIR);
  if (sourceFiles.length === 0) {
    throw new Error(`Source skill has no files: ${SOURCE_DIR}`);
  }

  const pluginManifest = JSON.parse(
    await fs.readFile(path.join(PLUGIN_DIR, '.claude-plugin', 'plugin.json'), 'utf8'),
  );
  const version = pluginManifest.version;
  if (!version) {
    throw new Error('plugins/.claude-plugin/plugin.json is missing "version"');
  }

  // Build the file table from the source tree.
  const files = [];
  const contents = new Map();
  for (const rel of sourceFiles) {
    const buffer = await fs.readFile(path.join(SOURCE_DIR, rel));
    contents.set(rel, buffer);
    files.push({ path: rel, sha256: createHash('sha256').update(buffer).digest('hex') });
  }

  const distribution = {
    schemaVersion: 1,
    plugin: { name: PLUGIN_NAME, version },
    source: {
      repository: REPOSITORY,
      path: `skills/${SKILL_NAME}`,
      mirror: `plugins/${PLUGIN_NAME}/skills/${SKILL_NAME}`,
    },
    payload: {
      root: `skills/${SKILL_NAME}`,
      sha256: payloadDigest(files),
      files,
    },
    manifests: MANIFESTS,
  };

  if (checkOnly) {
    const problems = [];

    const mirrorFiles = await listFiles(MIRROR_DIR).catch(() => null);
    if (!mirrorFiles) {
      problems.push(`missing mirror directory: ${MIRROR_DIR}`);
    } else {
      const missing = files.filter((f) => !mirrorFiles.includes(f.path));
      const extra = mirrorFiles.filter((f) => !sourceFiles.includes(f));
      for (const f of missing) problems.push(`missing in mirror: ${f.path}`);
      for (const f of extra) problems.push(`extra in mirror: ${f}`);
      for (const f of files) {
        if (!mirrorFiles.includes(f.path)) continue;
        const mirrorHash = await sha256File(path.join(MIRROR_DIR, f.path));
        if (mirrorHash !== f.sha256) problems.push(`content drift: ${f.path}`);
      }
    }

    let recorded = null;
    try {
      recorded = JSON.parse(await fs.readFile(DISTRIBUTION_FILE, 'utf8'));
    } catch {
      problems.push('missing or unparsable distribution.json');
    }
    if (recorded) {
      if (recorded.payload?.sha256 !== distribution.payload.sha256) {
        problems.push(
          `distribution.json payload digest is stale (recorded ${recorded.payload?.sha256}, actual ${distribution.payload.sha256})`,
        );
      }
      if (recorded.plugin?.version !== version) {
        problems.push(
          `distribution.json version is stale (recorded ${recorded.plugin?.version}, plugin.json ${version})`,
        );
      }
    }

    if (problems.length > 0) {
      console.error('Plugin snapshot check FAILED:');
      for (const p of problems) console.error(`  - ${p}`);
      console.error('\nRun: node scripts/build-plugin.mjs');
      process.exit(1);
    }

    console.log(
      `Plugin snapshot OK: ${PLUGIN_NAME}@${version}, ${files.length} files, payload sha256 ${distribution.payload.sha256}`,
    );
    return;
  }

  // Rewrite the mirror from scratch so deletions propagate.
  await fs.rm(MIRROR_DIR, { recursive: true, force: true });
  for (const [rel, buffer] of contents) {
    const target = path.join(MIRROR_DIR, ...rel.split('/'));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
  }

  await fs.writeFile(DISTRIBUTION_FILE, `${JSON.stringify(distribution, null, 2)}\n`, 'utf8');

  console.log(`Synced ${files.length} files to plugins/${PLUGIN_NAME}/skills/${SKILL_NAME}`);
  console.log(`Wrote plugins/${PLUGIN_NAME}/distribution.json`);
  console.log(`Payload sha256: ${distribution.payload.sha256}`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
