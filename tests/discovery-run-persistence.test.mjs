import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendDiscoveryRunSummary, SCAN_RUNS_HEADER } from '../scan.mjs';

test('WebSearch discovery runs persist status and query completion metadata', () => {
  const dir = mkdtempSync(join(tmpdir(), 'career-ops-discovery-run-'));
  const file = join(dir, 'scan-runs.tsv');
  appendDiscoveryRunSummary({
    timestamp: '2026-09-19T12:00:00.000Z', status: 'completed', queryCount: 7,
    queriesCompleted: 7, rawClues: 31, newAdded: 0, dupes: 31, filePath: file,
  });
  const lines = readFileSync(file, 'utf8').trim().split('\n');
  const header = lines[0].split('\t');
  const row = lines[1].split('\t');
  const value = (name) => row[header.indexOf(name)];
  assert.equal(lines[0] + '\n', SCAN_RUNS_HEADER.trim() + '\n');
  assert.equal(value('status'), 'completed');
  assert.equal(value('run_type'), 'websearch');
  assert.equal(value('query_count'), '7');
  assert.equal(value('queries_completed'), '7');
  assert.equal(value('raw_clues'), '31');
});

test('legacy scan-runs rows are padded during append without losing history', () => {
  const dir = mkdtempSync(join(tmpdir(), 'career-ops-discovery-migrate-'));
  const file = join(dir, 'scan-runs.tsv');
  const legacy = 'timestamp\tstatus\tcompanies\tboards\tfound\tfiltered_title\tfiltered_tier\tfiltered_location\tfiltered_posting_age\tfiltered_salary\tfiltered_content\tfiltered_cooldown\tdupes\tnew_added\terrors\tfiltered_blacklist\tfiltered_visa\tfiltered_posted_date\tfiltered_country_eligibility\n2026-09-18T00:00:00Z\tcompleted\t0\t0\t2\t0\t0\t0\t0\t0\t0\t0\t2\t0\t0\t0\t0\t0\t0\n';
  writeFileSync(file, legacy);
  appendDiscoveryRunSummary({ timestamp: '2026-09-19T12:00:00Z', queryCount: 7, queriesCompleted: 7, filePath: file });
  const lines = readFileSync(file, 'utf8').trim().split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[1].split('\t')[4], '2');
  assert.equal(lines[2].split('\t')[19], 'websearch');
});
