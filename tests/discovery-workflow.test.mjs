import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as yaml from 'js-yaml';
import { buildContext, assertFresh, prepare, filter, finalize, jobIdentity } from '../discovery-workflow.mjs';
import { buildTitleFilter, formatScanHistoryRow } from '../scan.mjs';

const CODE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const write = (p, s) => { fs.mkdirSync(dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
const read = p => fs.readFileSync(p, 'utf8');
const digest = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const tracker = '# Applications\n\n| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n|---|------|---------|------|-------|--------|-----|--------|-------|\n';
function fixture(t) {
  const root = fs.mkdtempSync(join(tmpdir(), 'career-discovery-test-'));
  t.after(() => { assert.ok(resolve(root).startsWith(resolve(tmpdir()) + '/') || resolve(root).startsWith(resolve(tmpdir()) + '\\')); fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  write(join(root, 'portals.yml'), yaml.dump({ title_filter: { positive: ['Clinical Project Associate', 'Clinical Project Manager', 'Project Specialist'], negative: ['Director'] }, location_filter: { allow: ['United States', 'Remote', 'Florida'] }, search_queries: Array.from({ length: 7 }, (_, i) => ({ name: `Query ${i + 1}`, query: `"exact saved query ${i + 1}"`, enabled: true })) }));
  write(join(root, 'config/profile.yml'), yaml.dump({ candidate: { email: 'private@example.test' }, language: { output: 'en' }, compensation: { currency: 'USD', remote_minimum: '$75,000', hybrid_minimum: '$80,000' }, location: { city: 'Cocoa, FL' }, target_roles: ['Clinical Project Associate'] }));
  write(join(root, 'modes/_profile.md'), '# Profile\n\n## Your Target Roles\nClinical project coordination.\n\n## Unknown Important Policy\nNever silently omit this rule.\n');
  write(join(root, 'modes/_custom.md'), '# Custom\n\n## Geography\nUncertain commutes require review; no fixed radius.\n');
  write(join(root, 'data/applications.md'), tracker);
  write(join(root, 'data/pipeline.md'), '# Pipeline\n\n## Pending\n\n## Processed\n');
  write(join(root, 'data/scan-history.tsv'), 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\tfingerprint\tposted_at\ttrust_score\ttrust_flags\tnormalized_company\n');
  return root;
}
function capture(root, entries = [], indexes = [1, 2, 3, 4, 5, 6, 7]) {
  return { queries: buildContext(root).queries.filter(q => indexes.includes(q.index)).map(q => ({ ...q, status: 'completed', results: q.index === indexes[0] ? entries : [] })) };
}
const clue = (url = 'https://jobs.example.test/new', extra = {}) => ({ url, title: 'Clinical Project Associate', kind: 'job', company: 'Example', snippet: 'Remote clinical coordination, pay and location need clarification.', ...extra });
const resolution = (c, status = 'unresolved') => ({ ...c, status, reason: 'Offline fixture decision' });
function history(root, c, status) { fs.appendFileSync(join(root, 'data/scan-history.tsv'), formatScanHistoryRow({ ...c, source: 'test' }, '2026-09-18', status) + '\n'); }
const wd = suffix => `https://acme.wd1.myworkdayjobs.com/Careers/job/${suffix}/Clinical-Project-Manager_R123-1`;

test('compact context: exact seven queries, source hashes, unknown rules, privacy and stale detection', async t => {
  const root = fixture(t), context = buildContext(root);
  assert.equal(context.queries.length, 7);
  assert.deepEqual(context.queries.map(q => q.query), yaml.load(read(join(root, 'portals.yml'))).search_queries.map(q => q.query));
  assert.match(context.targetingRules, /Never silently omit/);
  assert.match(context.customRules, /Uncertain commutes/);
  assert.equal(JSON.stringify(context).includes('private@example.test'), false);
  const match = buildTitleFilter(context.titleFilter);
  assert.equal(match('Clinical Project Associate'), true);
  assert.equal(match('Project Associate'), false);
  assert.equal(match('Associate'), false);
  await prepare(root, 'one');
  const state = join(root, 'data/discovery/one/checkpoint.json'), before = digest(state);
  await prepare(root, 'one'); assert.equal(digest(state), before);
  fs.appendFileSync(join(root, 'modes/_custom.md'), '\nNew uncertain constraint.\n');
  assert.throws(() => assertFresh(context, root), /Stale/);
  await assert.rejects(prepare(root, 'one'), /Stale/);
});

test('canonical duplicates preserve query provenance and alternative evidence; incomplete resumes and outcome reuse', async t => {
  const root = fixture(t); await prepare(root, 'resume');
  const a = clue('https://jobs.example.test/new?utm_source=search');
  const partial = capture(root, [a], [1]);
  const first = await filter(root, 'resume', partial);
  assert.equal(first.pendingQueries.length, 6);
  const stateFile = join(root, 'data/discovery/resume/checkpoint.json'), before = digest(stateFile);
  await filter(root, 'resume', partial); assert.equal(digest(stateFile), before);
  const rest = capture(root, [clue('https://jobs.example.test/new', { location: 'Remote OR NYC hybrid', pay: '$70,0000-85,000' })], [2, 3, 4, 5, 6, 7]);
  const second = await filter(root, 'resume', rest);
  assert.equal(second.rawRecords, 2); assert.equal(second.distinctExactUrls, 2); assert.equal(second.distinctCanonicalUrls, 1);
  assert.deepEqual(second.cards[0].queryIndexes, [1, 2]);
  assert.equal(second.cards[0].otherEvidence[0].location, 'Remote OR NYC hybrid');
  assert.equal(second.cards[0].otherEvidence[0].pay, '$70,0000-85,000');
  const reused = await filter(root, 'resume', undefined, [resolution(a)]);
  assert.equal(reused.cards.length, 0); assert.equal(reused.sameRunReused, 1);
  await assert.rejects(filter(root, 'resume', capture(root, [clue('https://different.test/job')], [1])), /already completed/);
  await assert.rejects(filter(root, 'resume', undefined, [resolution(a, 'expired')]), /Completed outcome differs/);
});

test('history/terminal precedence, supported ATS aliases, ambiguous identity and directory leads', async t => {
  const root = fixture(t);
  const old = clue('https://jobs.example.test/old'); history(root, old, 'skipped_error');
  const closed = clue(wd('Remote')); history(root, closed, 'skipped_expired');
  const directory = clue('https://www.linkedin.com/jobs/search/?keywords=clinical', { kind: 'directory', title: 'Search results', embeddedLeads: [{ title: 'Clinical Project Associate', company: 'Unknown' }] });
  history(root, directory, 'skipped_error');
  write(join(root, 'reports/001-acme.md'), `**URL:** ${wd('Remote')}\n**Score:** 3/5\n`);
  fs.appendFileSync(join(root, 'data/applications.md'), '| 1 | 2026-09-18 | Acme | Clinical Project Manager | 3 | Applied | - | [1](../reports/001-acme.md) | - |\n');
  await prepare(root, 'aliases');
  const alias = clue(wd('United-States-Remote'), { company: 'Acme', title: 'Clinical Project Manager' });
  const ambiguous = clue('https://another.test/job/R999', { company: 'Acme', title: 'Clinical Project Manager' });
  const r = await filter(root, 'aliases', capture(root, [old, alias, directory, ambiguous, clue('https://test.test/generic', { title: 'Project Associate' })]));
  assert.equal(r.eliminatedBeforeReasoning, 3);
  assert.equal(r.cards.length, 2);
  assert.ok(r.cards.some(c => c.embeddedLeads?.length));
  assert.match(r.cards.find(c => c.url === ambiguous.url).review, /identity unconfirmed/);
  const local = JSON.parse(read(join(root, 'data/discovery/aliases/clues.json')));
  const unresolved = local.excluded.find(c => c.previousStatus === 'skipped_error');
  assert.equal(unresolved.terminal, false);
  assert.ok(local.excluded.some(c => c.previousStatus === 'Applied' && c.terminal));
  assert.equal(jobIdentity(wd('Remote')), jobIdentity(wd('Anywhere')));
  assert.notEqual(jobIdentity(wd('Remote')), jobIdentity(wd('Remote').replace('acme.', 'other.')));
  assert.equal(jobIdentity('https://example.test/123'), null);
  assert.equal(jobIdentity('https://boards.greenhouse.io/acme/jobs/123'), jobIdentity('https://job-boards.greenhouse.io/acme/jobs/123?utm_source=x'));
});

test('finalization persists history once, adopts no duplicate run, and reconciles lifecycle', async t => {
  const root = fixture(t), old = clue(wd('Remote'), { company: 'Acme', title: 'Clinical Project Manager' });
  write(join(root, 'reports/001-acme.md'), `**URL:** ${old.url}\n**Score:** 2/5 - Skip\n`);
  write(join(root, 'data/pipeline.md'), `# Pipeline\n\n## Pending\n\n- [ ] ${old.url} | Acme | Clinical Project Manager\n\n## Processed\n`);
  const c = clue(); await prepare(root, 'finish'); await filter(root, 'finish', capture(root, [c, old]), [resolution(c)]);
  const before = digest(join(root, 'data/scan-history.tsv'));
  const dry = await finalize(root, 'finish', { dryRun: true }); assert.equal(dry.rawClues, 2);
  assert.equal(digest(join(root, 'data/scan-history.tsv')), before);
  const done = await finalize(root, 'finish'); assert.equal(done.newAdded, 0);
  assert.match(read(join(root, 'data/pipeline.md')), /lifecycle: SKIP/);
  const files = ['data/scan-history.tsv', 'data/scan-runs.tsv', 'data/pipeline.md'];
  const hashes = files.map(f => digest(join(root, f)));
  assert.deepEqual(await finalize(root, 'finish'), done);
  assert.deepEqual(files.map(f => digest(join(root, f))), hashes);
  // Simulate crash after all ledgers were written but before the receipt.
  const cp = join(root, 'data/discovery/finish/checkpoint.json');
  const interrupted = JSON.parse(read(cp)); delete interrupted.receipt; write(cp, JSON.stringify(interrupted));
  await Promise.all([finalize(root, 'finish'), finalize(root, 'finish')]);
  assert.deepEqual(files.map(f => digest(join(root, f))), hashes);
  assert.equal(read(join(root, 'data/scan-runs.tsv')).trim().split('\n').length, 2);
  assert.match(read(join(root, 'data/scan-history.tsv')), /skipped_error/);
  assert.match(read(join(root, 'data/scan-history.tsv')), /skipped_dup/);
});

test('journal recovery after a mid-finalization failure never duplicates history or run rows', async t => {
  const root = fixture(t), c = clue(); await prepare(root, 'crash'); await filter(root, 'crash', capture(root, [c]), [resolution(c)]);
  // Reconciliation rejects directory state targets, AFTER history persistence.
  fs.mkdirSync(join(root, 'batch/batch-state.tsv'), { recursive: true });
  await assert.rejects(finalize(root, 'crash'));
  const historyHash = digest(join(root, 'data/scan-history.tsv'));
  fs.rmdirSync(join(root, 'batch/batch-state.tsv'));
  const receipt = await finalize(root, 'crash');
  assert.equal(receipt.status, 'completed'); assert.equal(digest(join(root, 'data/scan-history.tsv')), historyHash);
  assert.equal(read(join(root, 'data/scan-runs.tsv')).trim().split('\n').length, 2);
});

test('verified additions only, safe pipeline insertion, no application/evaluation actions', async t => {
  const root = fixture(t), c = clue(); await prepare(root, 'add'); await filter(root, 'add', capture(root, [c]));
  await assert.rejects(finalize(root, 'add', { outcomes: [resolution(c, 'added')] }), /structured official verification/);
  const o = { ...resolution(c, 'added'), location: 'Remote United States', discoveryRulesPassed: true, verification: { official: true, active: true, jd: true, application: true, checkedAt: new Date().toISOString(), evidenceUrl: c.url } };
  const receipt = await finalize(root, 'add', { outcomes: [o] }); assert.equal(receipt.newAdded, 1);
  assert.equal(read(join(root, 'data/pipeline.md')).match(/^- \[ \]/gm).length, 1);
  await finalize(root, 'add'); assert.equal(read(join(root, 'data/pipeline.md')).match(/^- \[ \]/gm).length, 1);
  assert.equal(read(join(root, 'data/applications.md')), tracker);
  for (const f of ['cv.md', 'output', 'reports']) assert.equal(fs.existsSync(join(root, f)), false);
});

test('CLI alternate data root and strict argument/query validation', async t => {
  const root = fixture(t), cli = join(CODE, 'discovery-workflow.mjs');
  const env = { ...process.env, CAREER_OPS_DATA_DIR: root }; delete env.CAREER_OPS_ROOT;
  const r = JSON.parse(execFileSync(process.execPath, [cli, 'prepare', '--run', 'cli'], { env, encoding: 'utf8' }));
  assert.equal(r.pendingQueries.length, 7); assert.ok(fs.existsSync(join(root, 'data/discovery/cli/context.json')));
  const summary = JSON.parse(execFileSync(process.execPath, [cli, 'filter', '--run', 'cli', '--summary'], { env, encoding: 'utf8' }));
  assert.equal(summary.recordsRemaining, 0); assert.equal('cards' in summary, false); assert.deepEqual(summary.pendingQueries, [1, 2, 3, 4, 5, 6, 7]);
  assert.throws(() => execFileSync(process.execPath, [cli, 'prepare', '--run', '../bad', '--root', root], { encoding: 'utf8', stdio: 'pipe' }));
  assert.throws(() => execFileSync(process.execPath, [cli, 'prepare', '--run', 'bad', '--root', root, '--websearch'], { encoding: 'utf8', stdio: 'pipe' }));
  const bad = capture(root); bad.queries[0].query = 'changed query';
  await assert.rejects(filter(root, 'cli', bad), /differs from saved/);
});

test('failed query resumes, completed ATS aliases reuse evidence, and final status is derived safely', async t => {
  const root = fixture(t); await prepare(root, 'failed-query');
  const q = capture(root, [], [1]); q.queries[0].status = 'failed'; q.queries[0].error = 'interrupted';
  assert.equal((await filter(root, 'failed-query', q)).pendingQueries.length, 7);
  const a = clue(wd('Remote')), b = clue(wd('Anywhere'));
  const full = await filter(root, 'failed-query', capture(root, [a, b]));
  assert.equal(full.cards.length, 1); assert.deepEqual(full.cards[0].aliases, [b.url]);
  const reused = await filter(root, 'failed-query', undefined, [resolution(a)]);
  assert.equal(reused.cards.length, 0); assert.equal(reused.sameRunReused, 2);
  const done = await finalize(root, 'failed-query');
  assert.equal(done.errors, 0); assert.equal(done.historyOutcomes, 2);
  assert.match(read(join(root, 'data/scan-history.tsv')), /skipped_dup/);
  await prepare(root, 'abandoned');
  await assert.rejects(finalize(root, 'abandoned'), /Run incomplete/);
  const failed = await finalize(root, 'abandoned', { status: 'failed' });
  assert.equal(failed.status, 'failed'); assert.equal(failed.queriesCompleted, 0);
  await finalize(root, 'abandoned', { status: 'failed' });
  assert.equal(read(join(root, 'data/scan-runs.tsv')).trim().split('\n').length, 3);
});

test('finalization rejects mismatched legacy receipts and unsafe additions without writes', async t => {
  const root = fixture(t), c = clue(); await prepare(root, 'invalid'); await filter(root, 'invalid', capture(root, [c]));
  const legacy = { outcomes: [resolution(c)], persistence: { timestamp: '2026-09-19T00:00:00.000Z' } };
  const before = digest(join(root, 'data/scan-history.tsv'));
  await assert.rejects(finalize(root, 'invalid', { outcomes: legacy }), /does not match/);
  assert.equal(digest(join(root, 'data/scan-history.tsv')), before);
  const base = { ...resolution(c, 'added'), location: 'Remote United States', discoveryRulesPassed: true, verification: { official: true, active: true, jd: true, application: true, checkedAt: new Date().toISOString(), evidenceUrl: c.url } };
  const low = { ...base, workArrangement: 'remote', salary: { currency: 'USD', period: 'year', min: 65000, max: 72000 } };
  await assert.rejects(finalize(root, 'invalid', { outcomes: [low] }), /compensation floor/);
  const aggregator = { ...base, url: 'https://www.linkedin.com/jobs/view/123', verification: { ...base.verification, evidenceUrl: 'https://www.linkedin.com/jobs/view/123' } };
  await assert.rejects(finalize(root, 'invalid', { outcomes: [resolution(c), aggregator] }), /Aggregator/);
  assert.equal(digest(join(root, 'data/scan-history.tsv')), before);
});

test('terminal status changed after interruption prevents a pending addition on retry', async t => {
  const root = fixture(t), c = clue(); await prepare(root, 'late-terminal'); await filter(root, 'late-terminal', capture(root, [c]));
  const o = { ...resolution(c, 'added'), location: 'Remote United States', discoveryRulesPassed: true, verification: { official: true, active: true, jd: true, application: true, checkedAt: new Date().toISOString(), evidenceUrl: c.url } };
  fs.mkdirSync(join(root, 'batch/batch-state.tsv'), { recursive: true });
  await assert.rejects(finalize(root, 'late-terminal', { outcomes: [o] }));
  write(join(root, 'reports/001-test.md'), `**URL:** ${c.url}\n**Score:** 2/5 - Skip\n`);
  fs.rmdirSync(join(root, 'batch/batch-state.tsv'));
  const r = await finalize(root, 'late-terminal'); assert.equal(r.newAdded, 0);
  assert.equal((read(join(root, 'data/pipeline.md')).match(/^- \[ \]/gm) || []).length, 0);
});

test('a company/title collision requires explicit distinct-requisition evidence, not blanket employer suppression', async t => {
  const root = fixture(t);
  fs.appendFileSync(join(root, 'data/applications.md'), '| 1 | 2026-09-18 | Example | Clinical Project Associate | 3 | Applied | - | - | Previous requisition OLD1 |\n');
  const c = clue('https://jobs.example.test/NEW2'); await prepare(root, 'different-req');
  const f = await filter(root, 'different-req', capture(root, [c])); assert.equal(f.cards.length, 1);
  const o = { ...resolution(c, 'added'), location: 'Remote United States', discoveryRulesPassed: true, verification: { official: true, active: true, jd: true, application: true, checkedAt: new Date().toISOString(), evidenceUrl: c.url } };
  await assert.rejects(finalize(root, 'different-req', { outcomes: [o] }), /distinct-requisition evidence/);
  o.identityResolution = { distinctRequisition: true, reason: 'Official posting NEW2 is distinct from prior OLD1' };
  assert.equal((await finalize(root, 'different-req', { outcomes: [o] })).newAdded, 1);
});

test('offline September 19 replay preserves outcomes in an isolated root', { skip: !fs.existsSync(join(CODE, 'data/discovery/2026-09-19-websearch-results.json')) }, async t => {
  const root = fixture(t);
  const protectedFiles = ['portals.yml', 'config/profile.yml', 'modes/_profile.md', 'modes/_custom.md', 'data/scan-history.tsv', 'data/scan-runs.tsv', 'data/pipeline.md', 'data/applications.md', 'data/discovery/2026-09-19-websearch-raw.json', 'data/discovery/2026-09-19-websearch-results.json'];
  const before = protectedFiles.map(p => digest(join(CODE, p)));
  for (const p of protectedFiles.slice(0, 8)) write(join(root, p), read(join(CODE, p)));
  for (const f of fs.readdirSync(join(CODE, 'reports')).filter(f => f.endsWith('.md'))) write(join(root, 'reports', f), read(join(CODE, 'reports', f)));
  const rawText = read(join(CODE, protectedFiles[8])), raw = JSON.parse(rawText), outcomes = JSON.parse(read(join(CODE, protectedFiles[9])));
  await prepare(root, 'replay');
  const filtered = await filter(root, 'replay', raw);
  assert.equal(filtered.rawRecords, 53); assert.equal(filtered.distinctExactUrls, 52); assert.equal(filtered.completedQueries, 7);
  const all = JSON.parse(read(join(root, 'data/discovery/replay/clues.json')));
  const statusCounts = all.excluded.reduce((a, c) => ({ ...a, [c.status]: (a[c.status] || 0) + 1 }), {});
  const manualOnlyDuplicates = outcomes.distinctClues.filter(c => c.status === 'history_duplicate' && filtered.cards.some(card => card.url === c.url)).map(c => c.url);
  assert.equal(statusCounts.history_duplicate, 17); assert.equal(statusCounts.terminal_duplicate, 2);
  assert.deepEqual(manualOnlyDuplicates, ['https://careers.pipercompanies.com/details/475/clinical_project_manager']);
  const completed = await filter(root, 'replay', undefined, outcomes);
  assert.equal(completed.cards.length, 0);
  const runsBefore = read(join(root, 'data/scan-runs.tsv'));
  const done = await finalize(root, 'replay'); assert.equal(done.newAdded, 0); assert.equal(done.adoptedExistingRun, true);
  assert.equal(read(join(root, 'data/scan-runs.tsv')), runsBefore);
  const first = digest(join(root, 'data/scan-history.tsv')); await finalize(root, 'replay'); assert.equal(digest(join(root, 'data/scan-history.tsv')), first);
  assert.deepEqual(protectedFiles.map(p => digest(join(CODE, p))), before);
  const priorContext = ['.agents/skills/career-ops/SKILL.md', 'modes/scan.md', 'modes/_shared.md', 'config/profile.yml', 'modes/_profile.md', 'modes/_custom.md'].reduce((n, p) => n + fs.statSync(join(CODE, p)).size, 0);
  console.log('OFFLINE_REPLAY ' + JSON.stringify({ rawRecords: filtered.rawRecords, distinctExactUrls: filtered.distinctExactUrls, distinctCanonicalUrls: filtered.distinctCanonicalUrls, deterministicExclusions: filtered.eliminatedBeforeReasoning, exclusions: statusCounts, manualOnlyDuplicates, remainingCards: filtered.cards.length, historicalContextBytes: 84068, currentFullContextBytes: priorContext, compactContextBytes: fs.statSync(join(root, 'data/discovery/replay/context.json')).size, rawArtifactBytes: Buffer.byteLength(rawText), clueCardBytes: Buffer.byteLength(JSON.stringify(filtered.cards)), actionable: done.newAdded, historyRowsPersisted: done.historyOutcomes }));
});
