import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReportLifecycle, parseTrackerLifecycle, resolvePipelineLifecycle } from '../pipeline-lifecycle.mjs';

test('report Skip and tracker Applied resolve terminal pipeline lifecycle', () => {
  const reportsByUrl = parseReportLifecycle([
    { file: '005-protrials-2026-09-18.md', text: '**URL:** https://jobs.example/protrials\n**Score:** 3.0/5 - Research first' },
    { file: '006-clario-2026-09-18.md', text: '**URL:** https://jobs.example/clario\n**Score:** 2.5/5 - Low current fit / Skip\n"final_decision": "Skip"' },
  ]);
  const trackerByReport = parseTrackerLifecycle([
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
    '|---|---|---|---|---|---|---|---|---|',
    '| 5 | 2026-09-18 | ProTrials | Clinical Project Specialist | 3.0/5 | Applied | - | [005](reports/005-protrials.md) | |',
  ].join('\n'));
  assert.equal(resolvePipelineLifecycle('https://jobs.example/protrials', { reportsByUrl, trackerByReport }).terminal, 'Applied');
  assert.equal(resolvePipelineLifecycle('https://jobs.example/clario', { reportsByUrl, trackerByReport }).terminal, 'SKIP');
});

test('non-terminal report does not remove a pending entry', () => {
  const reportsByUrl = parseReportLifecycle([{ file: '001-acme.md', text: '**URL:** https://jobs.example/acme\n**Score:** 3.0/5 - Maybe' }]);
  assert.equal(resolvePipelineLifecycle('https://jobs.example/acme', { reportsByUrl, trackerByReport: new Map() }), null);
});

