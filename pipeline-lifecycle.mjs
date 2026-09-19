/**
 * Lifecycle evidence for discovery entries already sitting in pipeline.md.
 * Reports and the tracker are historical sources; this module never writes them.
 */

import { extractTrackerReportNumbers, resolveColumns, parseTrackerRow } from './tracker-parse.mjs';

const TERMINAL_TRACKER_STATES = new Set(['Applied', 'Responded', 'Interview', 'Offer', 'Hired', 'Rejected', 'Discarded', 'SKIP']);

function canonicalStatus(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'skip' || raw === 'skipped') return 'SKIP';
  return raw ? raw[0].toUpperCase() + raw.slice(1) : '';
}

function reportNumFromFile(file) {
  const m = String(file ?? '').match(/^(\d+)-/);
  return m ? Number(m[1]) : null;
}

/** Parse report URL + final decision evidence without interpreting JD content. */
export function parseReportLifecycle(reports = []) {
  const byUrl = new Map();
  for (const report of reports) {
    const text = String(report.text ?? '');
    const url = text.match(/^\*\*URL:\*\*\s*(\S+)/m)?.[1]?.trim();
    if (!url) continue;
    const score = text.match(/^\*\*Score:\*\*\s*([^\n]+)/m)?.[1]?.trim() || 'N/A';
    const decision = text.match(/"final_decision"\s*:\s*"([^"]+)"/i)?.[1]
      || ( /\bSkip\b/i.test(score) ? 'Skip' : '');
    byUrl.set(url, {
      reportNum: reportNumFromFile(report.file),
      reportFile: report.file,
      score,
      decision,
    });
  }
  return byUrl;
}

/** Parse terminal tracker states keyed by report number. */
export function parseTrackerLifecycle(text) {
  const lines = String(text ?? '').replace(/\r/g, '').split('\n');
  const columns = resolveColumns(lines);
  const byReport = new Map();
  for (const line of lines) {
    const row = parseTrackerRow(line, columns);
    if (!row) continue;
    const status = canonicalStatus(row.status);
    if (!TERMINAL_TRACKER_STATES.has(status)) continue;
    for (const reportNum of extractTrackerReportNumbers(row.report, row.notes)) {
      byReport.set(reportNum, { status, trackerNum: row.num, company: row.company, role: row.role });
    }
  }
  return byReport;
}

/** Resolve the strongest terminal evidence for a pending URL. */
export function resolvePipelineLifecycle(url, { reportsByUrl, trackerByReport }) {
  const report = reportsByUrl.get(url);
  if (!report) return null;
  const tracker = report.reportNum != null ? trackerByReport.get(report.reportNum) : null;
  if (tracker) return { ...report, ...tracker, terminal: tracker.status };
  if (/^skip$/i.test(report.decision)) return { ...report, terminal: 'SKIP' };
  return null;
}

