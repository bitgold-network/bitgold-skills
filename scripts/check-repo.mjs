#!/usr/bin/env node
/**
 * check-repo.mjs — offline sanity checks for this repository.
 *
 * Verifies:
 *   1. required files exist and every JSON file parses;
 *   2. SKILL.md frontmatter has name/description and `name` matches its directory;
 *   3. relative markdown links resolve to real files;
 *   4. no leftover upstream branding (BNB / BSC / opBNB / Greenfield / ...), with a
 *      single documented exception for the chain's technical lineage line;
 *   5. plugins/bitgold-devkit matches skills/bitgold-network and distribution.json.
 *
 * Usage: node scripts/check-repo.mjs
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_NAME = 'bitgold-network';
const PLUGIN_NAME = 'bitgold-devkit';
const SOURCE_DIR = path.join(ROOT, 'skills', SKILL_NAME);
const MIRROR_DIR = path.join(ROOT, 'plugins', PLUGIN_NAME, 'skills', SKILL_NAME);

const REQUIRED = [
  'README.md',
  'LICENSE',
  '.gitignore',
  '.claude-plugin/marketplace.json',
  '.cursor-plugin/marketplace.json',
  '.agents/plugins/marketplace.json',
  `skills/${SKILL_NAME}/SKILL.md`,
  `plugins/${PLUGIN_NAME}/.claude-plugin/plugin.json`,
  `plugins/${PLUGIN_NAME}/.cursor-plugin/plugin.json`,
  `plugins/${PLUGIN_NAME}/.codex-plugin/plugin.json`,
  `plugins/${PLUGIN_NAME}/README.md`,
  `plugins/${PLUGIN_NAME}/LICENSE`,
  `plugins/${PLUGIN_NAME}/distribution.json`,
  'scripts/build-plugin.mjs',
  '.github/workflows/checks.yml',
];

// Upstream branding that must not survive the rewrite.
const FORBIDDEN = [
  { label: 'BNB Chain', pattern: /\bbnb[\s-]*chain\b/i },
  { label: 'bnbchain', pattern: /bnbchain/i },
  { label: 'bnbagent', pattern: /bnbagent|bag CLI/i },
  { label: 'opBNB', pattern: /opbnb/i },
  { label: 'BNB (bare)', pattern: /\bbnb\b/i },
  { label: 'BSC (outside lineage line)', pattern: /\bbsc\b/i },
  { label: 'Binance', pattern: /binance/i },
  { label: 'Greenfield', pattern: /greenfield/i },
  { label: 'ERC-8183', pattern: /erc-?8183/i },
  { label: 'BEP-* proposal or token name', pattern: /\bbep[- ]?\d+/i },
  { label: 'B402', pattern: /\bb402\b/i },
  { label: 'Pieverse', pattern: /pieverse/i },
  { label: 'x402/MPP commerce stack', pattern: /\bx402\b|\bmpp\b/i },
];
// The only permitted lineage statement, mirroring the official docs wording.
const LINEAGE_EXCEPTION = /BSC v1\.8\.1/gi;

const TEXT_EXT = new Set(['.md', '.json', '.mjs', '.js', '.txt', '.toml', '.yml', '.yaml']);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'tmp', 'dist', 'out']);

const problems = [];
const fail = (msg) => problems.push(msg);

async function listFiles(dir, prefix = '') {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...(await listFiles(path.join(dir, entry.name), prefix ? `${prefix}/${entry.name}` : entry.name)));
    } else if (entry.isFile()) {
      out.push(prefix ? `${prefix}/${entry.name}` : entry.name);
    }
  }
  return out;
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function checkRequired() {
  for (const rel of REQUIRED) {
    await fs.access(path.join(ROOT, ...rel.split('/'))).catch(() => fail(`missing required file: ${rel}`));
  }
}

async function checkJson(allFiles) {
  const seen = new Set();
  for (const rel of allFiles.filter((f) => f.endsWith('.json'))) {
    const abs = path.join(ROOT, ...rel.split('/'));
    const raw = await fs.readFile(abs, 'utf8');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      fail(`invalid JSON: ${rel} — ${error.message}`);
      continue;
    }
    if (!raw.endsWith('\n')) fail(`JSON file has no trailing newline: ${rel}`);
    seen.add(rel);
    if (rel.endsWith('marketplace.json')) {
      if (parsed.name !== 'bitgold-skills') fail(`${rel}: marketplace name should be "bitgold-skills", got ${parsed.name}`);
      const plugins = parsed.plugins ?? [];
      if (plugins.length === 0) fail(`${rel}: marketplace lists no plugins`);
      for (const plugin of plugins) {
        if (plugin.name !== 'bitgold-devkit') fail(`${rel}: unexpected plugin ${plugin.name}`);
      }
    }
    if (rel.endsWith('plugin.json')) {
      if (parsed.name !== 'bitgold-devkit') fail(`${rel}: plugin name should be "bitgold-devkit"`);
      if (!parsed.version) fail(`${rel}: missing version`);
      if (parsed.skills !== './skills/') fail(`${rel}: skills should point at "./skills/"`);
    }
  }
  if (seen.size === 0) fail('no JSON files found');
}

async function checkSkillFrontmatter() {
  const skillPath = path.join(SOURCE_DIR, 'SKILL.md');
  const raw = await fs.readFile(skillPath, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(raw);
  if (!match) {
    fail('SKILL.md: missing YAML frontmatter block');
    return;
  }
  const front = match[1];
  const name = /^name:\s*(.+)$/m.exec(front)?.[1]?.trim();
  const description = /^description:\s*(.+)$/m.exec(front)?.[1]?.trim();
  if (name !== SKILL_NAME) fail(`SKILL.md: frontmatter name "${name}" must equal directory "${SKILL_NAME}"`);
  if (!description) fail('SKILL.md: frontmatter needs a description');
  else if (description.length < 80) fail('SKILL.md: description is too short to route reliably');
  if (raw.includes('\t')) fail('SKILL.md: contains a literal tab character');
}

async function checkLinks(allFiles) {
  for (const rel of allFiles.filter((f) => f.endsWith('.md'))) {
    const abs = path.join(ROOT, ...rel.split('/'));
    const raw = await fs.readFile(abs, 'utf8');
    const linkPattern = /\[[^\]]*\]\(([^)\s]+)\)/g;
    for (const match of raw.matchAll(linkPattern)) {
      const target = match[1];
      if (/^(https?:|mailto:|#)/i.test(target)) continue;
      const clean = target.split('#')[0].split('?')[0];
      if (!clean) continue;
      const resolved = path.resolve(path.dirname(abs), clean);
      await fs.access(resolved).catch(() => fail(`${rel}: broken relative link -> ${target}`));
    }
  }
}

async function checkBranding(allFiles) {
  // This script necessarily contains the patterns it searches for.
  const selfPath = 'scripts/check-repo.mjs';
  for (const rel of allFiles) {
    if (rel === selfPath) continue;
    if (!TEXT_EXT.has(path.extname(rel))) continue;
    const abs = path.join(ROOT, ...rel.split('/'));
    const raw = await fs.readFile(abs, 'utf8');
    const cleaned = raw.replace(LINEAGE_EXCEPTION, 'BSC_LINEAGE_ALLOWED');
    const lines = cleaned.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const { label, pattern } of FORBIDDEN) {
        if (pattern.test(line)) {
          fail(`${rel}:${index + 1}: upstream branding "${label}" survived — ${line.trim().slice(0, 120)}`);
        }
      }
    });
    if (/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(raw)) {
      fail(`${rel}: contains CJK characters (repository content must be English)`);
    }
  }
}

async function checkMirror() {
  const drift = [];
  const sourceFiles = (await listFiles(SOURCE_DIR)).sort();
  const mirrorFiles = await listFiles(MIRROR_DIR).catch(() => null);
  if (!mirrorFiles) {
    fail(`missing plugin mirror: plugins/${PLUGIN_NAME}/skills/${SKILL_NAME}`);
    return;
  }
  for (const rel of sourceFiles) {
    const sourceHash = sha256(await fs.readFile(path.join(SOURCE_DIR, ...rel.split('/'))));
    const mirrorAbs = path.join(MIRROR_DIR, ...rel.split('/'));
    const buffer = await fs.readFile(mirrorAbs).catch(() => null);
    if (!buffer) {
      drift.push(`missing in mirror: ${rel}`);
      continue;
    }
    if (sha256(buffer) !== sourceHash) drift.push(`content drift: ${rel}`);
  }
  for (const rel of mirrorFiles) {
    if (!sourceFiles.includes(rel)) drift.push(`extra in mirror: ${rel}`);
  }

  const distribution = JSON.parse(
    await fs.readFile(path.join(ROOT, 'plugins', PLUGIN_NAME, 'distribution.json'), 'utf8'),
  );
  const files = [];
  for (const rel of sourceFiles) {
    const buffer = await fs.readFile(path.join(SOURCE_DIR, ...rel.split('/')));
    files.push({ path: rel, sha256: sha256(buffer) });
  }
  const hash = createHash('sha256');
  for (const file of files) hash.update(`${file.path}\t${file.sha256}\n`);
  const digest = hash.digest('hex');

  if (distribution.payload?.sha256 !== digest) {
    drift.push(`distribution.json payload digest is stale (recorded ${distribution.payload?.sha256}, actual ${digest})`);
  }
  if (distribution.payload?.files?.length !== files.length) {
    drift.push('distribution.json file count does not match the skill tree');
  }
  for (const d of drift) fail(d);
  if (drift.length === 0) {
    console.log(`Mirror OK: ${files.length} files, payload sha256 ${digest}`);
  }
}

async function main() {
  const allFiles = await listFiles(ROOT);
  console.log(`Scanning ${allFiles.length} files under ${ROOT}\n`);

  await checkRequired();
  await checkJson(allFiles);
  await checkSkillFrontmatter().catch((error) => fail(`SKILL.md: ${error.message}`));
  await checkLinks(allFiles);
  await checkBranding(allFiles);
  await checkMirror();

  const referenceCount = allFiles.filter(
    (f) => f.startsWith(`skills/${SKILL_NAME}/references/`) && f.endsWith('.md'),
  ).length;
  console.log(`References: ${referenceCount}`);

  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s) found:\n`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log('\nAll checks passed.');
}

main().catch((error) => {
  console.error(error.stack ?? error.message ?? error);
  process.exit(1);
});
