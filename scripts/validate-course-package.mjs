#!/usr/bin/env node

import {
  loadCoursePackageBySlug,
  loadCoursePackageFromDir,
  validateCoursePackage,
} from '../engine/course-package-engine.mjs';

function printHelp() {
  console.log(`Usage:
  node scripts/validate-course-package.mjs --dir <packageDir> [--json] [--require-review-approval]
  node scripts/validate-course-package.mjs --slug <courseSlug> [--json] [--require-review-approval]

Options:
  --dir <path>                  Validate a package directory directly.
  --slug <slug>                 Validate a package under courses/<slug>.
  --json                        Print the full validation result as JSON.
  --require-review-approval     Treat missing/unapproved review artifacts as blocking.
  --help                        Show this help message.
`);
}

function parseArgs(argv) {
  const parsed = {
    dir: null,
    slug: null,
    json: false,
    requireReviewApproval: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dir') {
      parsed.dir = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === '--slug') {
      parsed.slug = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (arg === '--require-review-approval') {
      parsed.requireReviewApproval = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (parsed.dir && parsed.slug) {
    throw new Error('Use either --dir or --slug, not both.');
  }

  return parsed;
}

let args;

try {
  args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const source = args.slug
    ? loadCoursePackageBySlug(args.slug)
    : loadCoursePackageFromDir(args.dir ?? process.cwd());

  const result = validateCoursePackage(source, {
    requireReviewApproval: args.requireReviewApproval,
  });

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      JSON.stringify(
        {
          summary: result.summary,
          ok: result.ok,
          promoteReady: result.promoteReady,
          publishReady: result.publishReady,
          errorCount: result.errors.length,
          warningCount: result.warnings.length,
        },
        null,
        2,
      ),
    );
  }

  process.exit(result.ok ? 0 : 1);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (args?.json) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          promoteReady: false,
          publishReady: false,
          errors: [
            {
              category: 'structure',
              severity: 'error',
              message,
            },
          ],
          warnings: [],
          issuesByCategory: {
            structure: {
              errors: [
                {
                  category: 'structure',
                  severity: 'error',
                  message,
                },
              ],
              warnings: [],
            },
            content: { errors: [], warnings: [] },
            registry: { errors: [], warnings: [] },
            scaffold: { errors: [], warnings: [] },
            review: { errors: [], warnings: [] },
          },
          summary: null,
          reviewApproval: {
            exists: false,
            approved: false,
            reviewedBy: null,
            reviewedAt: null,
            notes: null,
          },
        },
        null,
        2,
      ),
    );
  } else {
    console.error(message);
  }
  process.exit(1);
}
