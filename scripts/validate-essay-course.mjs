#!/usr/bin/env node
import {
  loadEssayCoursePackageBySlug,
  loadEssayCoursePackageFromDir,
  validateEssayCoursePackage,
} from '../engine/essay-course-engine.mjs';

function parseArgs(argv) {
  const parsed = { dir: null, slug: null, json: false, requireReviewApproval: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dir') { parsed.dir = argv[i + 1] ?? null; i += 1; continue; }
    if (arg === '--slug') { parsed.slug = argv[i + 1] ?? null; i += 1; continue; }
    if (arg === '--json') { parsed.json = true; continue; }
    if (arg === '--require-review-approval') { parsed.requireReviewApproval = true; continue; }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (parsed.dir && parsed.slug) throw new Error('Use either --dir or --slug, not both.');
  return parsed;
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
  const source = args.slug
    ? loadEssayCoursePackageBySlug(args.slug)
    : loadEssayCoursePackageFromDir(args.dir ?? process.cwd());
  const result = validateEssayCoursePackage(source, { requireReviewApproval: args.requireReviewApproval });
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(JSON.stringify({ ok: result.ok, promoteReady: result.promoteReady, publishReady: result.publishReady, errorCount: result.errors.length, warningCount: result.warnings.length }, null, 2));
  }
  process.exit(result.ok ? 0 : 1);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
