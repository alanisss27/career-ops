#!/usr/bin/env node

/** Record a bounded WebSearch discovery run in data/scan-runs.tsv. */
import { appendDiscoveryRunSummary } from './scan.mjs';

const args = process.argv.slice(2);
const values = new Map();
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help' || arg === '-h') {
    console.log('Usage: node record-discovery-run.mjs --status completed|failed [--query-count N] [--queries-completed N] [--raw-clues N] [--new-added N] [--dupes N] [--errors N] [--started-at ISO] [--completed-at ISO] [--interruption-reason TEXT]');
    process.exit(0);
  }
  if (!arg.startsWith('--') || args[i + 1] == null || args[i + 1].startsWith('--')) {
    console.error(`Invalid argument: ${arg}`);
    process.exit(1);
  }
  values.set(arg.slice(2), args[++i]);
}

const status = values.get('status') || 'completed';
if (!['completed', 'failed'].includes(status)) {
  console.error(`--status must be completed or failed, got ${status}`);
  process.exit(1);
}
const number = (name) => {
  const raw = values.get(name) ?? '0';
  if (!/^\d+$/.test(raw)) {
    console.error(`--${name} must be a non-negative integer, got ${raw}`);
    process.exit(1);
  }
  return Number(raw);
};

const timestamp = values.get('timestamp') || new Date().toISOString();
appendDiscoveryRunSummary({
  timestamp,
  status,
  queryCount: number('query-count'),
  queriesCompleted: number('queries-completed'),
  rawClues: number('raw-clues'),
  newAdded: number('new-added'),
  dupes: number('dupes'),
  errors: number('errors'),
  startedAt: values.get('started-at') || '',
  completedAt: values.get('completed-at') || (status === 'completed' ? timestamp : ''),
  interruptionReason: values.get('interruption-reason') || '',
});
console.log(JSON.stringify({ status, query_count: number('query-count'), queries_completed: number('queries-completed') }));

