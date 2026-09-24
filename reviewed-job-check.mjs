#!/usr/bin/env node

/**
 * Read-only exact-job history check used before evaluation, CV preparation,
 * and application preparation.  It deliberately uses report identity before
 * company/title matching so two requisitions with similar titles stay distinct.
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { resolveTrackerPath, getCareerOpsRoot } from './path-resolver.mjs';
import { resolveColumns, parseTrackerRow } from './tracker-parse.mjs';
import { normalizeUrl } from './url-key.mjs';
import { isMainModule } from './lib/is-main-module.mjs';

const ROOT = getCareerOpsRoot();
const clean = (value) => String(value ?? '').replace(/\*\*/g, '').trim();
const norm = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const normId = (value) => clean(value).replace(/^0+/, '') || '';
const reportNumber = (cell) => {
  const m = String(cell ?? '').match(/\[(\d+)\]\(([^)]+)\)/);
  return m ? m[1].replace(/^0+(?=\d)/, '') : null;
};

function reportPathFromCell(cell) {
  const m = String(cell ?? '').match(/\[\d+\]\(([^)]+)\)/);
  if (!m) return null;
  return join(ROOT, m[1].replace(/^\.\.\//, ''));
}

function metadata(text) {
  const line = (label) => {
    const re = new RegExp(`^\\*\\*${label}:\\*\\*\\s*([^\\r\\n]+)`, 'im');
    return clean(text.match(re)?.[1] ?? '');
  };
  const ids = line('Job ID / requisition').match(/([A-Za-z0-9._-]+)\s*\/\s*([A-Za-z0-9._-]+)/);
  const score = text.match(/\*\*Score:\s*([^*]+)\*\*/i)?.[1]?.trim() || '';
  const decision = text.match(/final_decision:\s*["']?([^"'\n]+)["']?/i)?.[1]?.trim() || '';
  const date = line('Date');
  return {
    url: line('URL'),
    canonicalUrl: line('Canonical URL'),
    jobId: ids ? ids[1] : '',
    requisition: ids ? ids[2] : '',
    score,
    recommendation: decision,
    reviewDate: date,
  };
}

function parseArgs(argv) {
  const out = { json: false, company: '', role: '', jobId: '', requisition: '', url: '' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') out.json = true;
    else if (a.startsWith('--')) {
      const key = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (!(key in out) || i + 1 >= argv.length) throw new Error(`Unknown or incomplete option: ${a}`);
      out[key] = argv[++i];
    } else throw new Error(`Unexpected argument: ${a}`);
  }
  if (!out.company && !out.role && !out.jobId && !out.requisition && !out.url) {
    throw new Error('Provide --job-id, --requisition, --url, --company, or --role');
  }
  return out;
}

export function readRows() {
  const trackerPath = resolveTrackerPath(ROOT);
  if (!existsSync(trackerPath)) return [];
  const text = readFileSync(trackerPath, 'utf8');
  const colmap = resolveColumns(text.split('\n'));
  return text.split('\n').map(line => parseTrackerRow(line, colmap)).filter(Boolean).map(row => {
    const path = reportPathFromCell(row.report);
    const reportText = path && existsSync(path) ? readFileSync(path, 'utf8') : '';
    return { ...row, reportNum: reportNumber(row.report), reportPath: path, report: metadata(reportText), reportText };
  });
}

function applicationDate(row) {
  const text = `${row.date} ${row.notes}`;
  return text.match(/(?:original application confirmed|application submitted(?:\/confirmed)?|applied)\s+(\d{4}-\d{2}-\d{2})/i)?.[1] || row.date || '';
}

function outputArtifacts(row) {
  const slug = `${row.company}-${row.role}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const companyToken = norm(row.company).split(' ')[0];
  const roleSlug = norm(row.role).replace(/ /g, '-');
  if (!existsSync(join(ROOT, 'output'))) return [];
  return readdirSync(join(ROOT, 'output')).filter(name => {
    const lower = name.toLowerCase();
    return lower.includes(slug) || (lower.includes(companyToken) && lower.includes(roleSlug));
  }).map(name => `output/${name}`);
}

export function findPreviouslyReviewed(input, rows = readRows()) {
  const wantedUrl = normalizeUrl(input.url);
  const wantedJob = normId(input.jobId);
  const wantedReq = normId(input.requisition);
  const wantedCompany = norm(input.company);
  const wantedRole = norm(input.role);
  return rows.filter(row => {
    const r = row.report;
    const reportJob = normId(r.jobId);
    const reportReq = normId(r.requisition);
    const urls = [r.url, r.canonicalUrl].map(normalizeUrl).filter(Boolean);
    if (wantedJob || wantedReq) {
      if (wantedJob && (!reportJob || wantedJob !== reportJob)) return false;
      if (wantedReq && (!reportReq || wantedReq !== reportReq)) return false;
      return true;
    }
    if (wantedUrl) return urls.includes(wantedUrl);
    if (reportJob || reportReq || urls.length) return false;
    return wantedCompany && wantedRole && norm(row.company) === wantedCompany && norm(row.role) === wantedRole;
  }).map(row => ({
    trackerNumber: row.num,
    company: row.company,
    role: row.role,
    jobId: row.report.jobId || null,
    requisition: row.report.requisition || null,
    canonicalUrl: row.report.canonicalUrl || row.report.url || null,
    reviewDate: row.report.reviewDate || null,
    score: row.score || row.report.score || null,
    recommendation: row.report.recommendation || null,
    reportPath: row.reportPath ? relative(ROOT, row.reportPath).replaceAll('\\', '/') : null,
    jdPath: row.reportNum && existsSync(join(ROOT, 'jds')) ? readdirSync(join(ROOT, 'jds')).filter(n => n.startsWith(`${String(row.reportNum).padStart(3, '0')}-`))[0] ? `jds/${readdirSync(join(ROOT, 'jds')).find(n => n.startsWith(`${String(row.reportNum).padStart(3, '0')}-`))}` : null : null,
    resumePaths: outputArtifacts(row),
    status: clean(row.status),
    applicationDate: /applied/i.test(row.status) ? applicationDate(row) : null,
    outcome: /^(rejected|withdrawn|discarded|declined)/i.test(clean(row.status)) ? clean(row.status) : null,
    notes: clean(row.notes),
  }));
}

function main() {
  try {
    const input = parseArgs(process.argv);
    const matches = findPreviouslyReviewed(input);
    const result = { matched: matches.length > 0, matches, warnings: [] };
    for (const m of matches) {
      result.warnings.push(`PREVIOUSLY REVIEWED: ${m.company} — ${m.role}${m.reviewDate ? ` already has a Career Ops evaluation from ${m.reviewDate}` : ''}.`);
      if (/^applied$/i.test(m.status)) result.warnings.push(`ALREADY APPLIED: this exact role was recorded as Applied on ${m.applicationDate || 'an earlier date'}. Do not create a new application record without explicit confirmation of a new requisition or intentional reapplication.`);
    }
    if (input.json) console.log(JSON.stringify(result, null, 2));
    else if (!matches.length) console.log('No previously reviewed exact-job match found.');
    else result.warnings.forEach(w => console.log(w));
    process.exitCode = matches.length ? 0 : 1;
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
}

if (isMainModule(import.meta.url)) main();
