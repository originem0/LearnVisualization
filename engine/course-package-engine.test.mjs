import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  compileCoursePackage,
  loadCoursePackageBySlug,
  validateCoursePackage,
} from './course-package-engine.mjs';

function writeJson(path, payload) {
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
}

function createFixturePackage({ approved, status, scaffold }) {
  const packageDir = mkdtempSync(join(tmpdir(), 'course-package-engine-'));

  mkdirSync(join(packageDir, 'modules'), { recursive: true });
  mkdirSync(join(packageDir, 'visuals'), { recursive: true });
  mkdirSync(join(packageDir, 'interactions'), { recursive: true });
  if (approved !== null) {
    mkdirSync(join(packageDir, 'review'), { recursive: true });
  }

  const course = {
    id: 'fixture-course',
    slug: 'fixture-course',
    title: 'Fixture Course',
    subtitle: 'Validation fixture',
    goal: 'Verify validation behaviour.',
    projectType: 'mixed',
    startDate: '2026-03-19',
    topic: 'fixture',
    language: 'zh',
    status,
    categories: [
      {
        id: 'core',
        name: 'Core',
        color: 'blue',
      },
    ],
    audience: {
      primaryAudience: 'Fixture audience',
    },
    learningGoals: ['Understand the promote gate'],
    moduleGraph: {
      order: ['s01'],
      edges: [],
    },
    modules: ['s01'],
  };
  if (scaffold) {
    course._scaffold = true;
  }

  const module = {
    id: 's01',
    number: 1,
    title: 'Fixture Module',
    subtitle: 'Module subtitle',
    category: 'core',
    moduleKind: 'concept-clarification',
    primaryCognitiveAction: 'distinguish',
    focusQuestion: 'What makes promotion safe?',
    keyInsight: 'Promotion must be gated by real validation and review.',
    concepts: [
      {
        name: 'promote gate',
        note: 'A real release boundary.',
      },
    ],
    logicChain: ['validate', 'review', 'promote'],
    examples: ['A reviewed package can be promoted.'],
    narrative: [
      {
        type: 'text',
        content: 'Promotion should not accept unchecked scaffold output.',
      },
      {
        type: 'heading',
        content: 'Why the gate exists',
      },
      {
        type: 'callout',
        content: 'If scaffold output enters courses/, the workflow is lying.',
      },
    ],
    interactionRequirements: [
      {
        capability: 'compare',
        purpose: 'Minimal fixture interaction',
        priority: 'core',
        componentHint: 'FixtureInteractive',
      },
    ],
    retrievalPrompts: [
      {
        type: 'fill-gap',
        prompt: 'State the promote requirement.',
      },
    ],
    bridgeTo: null,
    nextModuleId: null,
  };
  if (scaffold) {
    module._scaffold = true;
  }

  const conceptMaps = {
    '1': {
      title: 'Fixture map',
      nodes: [
        { id: 'a', label: ['A'], x: 0, y: 0, w: 80, h: 40 },
        { id: 'b', label: ['B'], x: 120, y: 0, w: 80, h: 40 },
      ],
      edges: [{ from: 'a', to: 'b', label: 'guards' }],
      svgW: 240,
      svgH: 120,
      ariaLabel: 'Fixture concept map',
    },
  };
  if (scaffold) {
    conceptMaps['1']._scaffold = true;
  }

  const interactions = {
    s01: {
      heroInteractive: {
        capability: 'compare',
        purpose: 'Minimal fixture interaction',
        priority: 'core',
        componentHint: 'FixtureInteractive',
      },
    },
  };
  if (scaffold) {
    interactions.s01._scaffold = true;
  }

  writeJson(join(packageDir, 'course.json'), course);
  writeJson(join(packageDir, 'modules', 's01.json'), module);
  writeJson(join(packageDir, 'visuals', 'concept-maps.json'), conceptMaps);
  writeJson(join(packageDir, 'interactions', 'registry.json'), interactions);

  if (approved !== null) {
    writeJson(join(packageDir, 'review', 'approval.json'), {
      approved,
      reviewedBy: approved ? 'reviewer' : '',
      reviewedAt: approved ? '2026-03-19T00:00:00Z' : '',
      notes: 'Fixture approval',
    });
  }

  return packageDir;
}

test('published mirrored course is valid and publish-ready', () => {
  const source = loadCoursePackageBySlug('llm-fundamentals');
  const result = validateCoursePackage(source);

  assert.equal(result.ok, true);
  assert.equal(result.reviewApproval.approved, true);
  assert.equal(result.publishReady, true);
});

test('compileCoursePackage normalizes numeric concept-map keys to module ids', () => {
  const source = loadCoursePackageBySlug('llm-fundamentals');
  const compiled = compileCoursePackage(source);

  assert.ok(compiled.conceptMapsByModuleId.s01);
  assert.equal(compiled.conceptMapsByModuleId.s01.ariaLabel, 'Token 与词表 概念关系图');
  assert.equal(compiled.moduleRuntimeById.s01.conceptMap.schema?.ariaLabel, 'Token 与词表 概念关系图');
  assert.equal(compiled.moduleRuntimeById.s01.interactions[0].componentHint, 'TokenizerPlayground');
});

test('draft course runtime carries renderable visual schemas and explicit component hints', () => {
  const source = loadCoursePackageBySlug('postgresql-internals');
  const compiled = compileCoursePackage(source);

  assert.ok(compiled.moduleRuntimeById.s01.conceptMap.schema);
  assert.equal(compiled.moduleRuntimeById.s01.conceptMap.schema?.title, 'Heap Page Layout');
  assert.equal(compiled.moduleRuntimeById.s01.conceptMap.visualType, 'processFlow');
  assert.equal(compiled.moduleRuntimeById.s01.conceptMap.warnings.length, 0);
  assert.equal(compiled.moduleRuntimeById.s01.interactions[0].componentHint, 'PostgresPageLayoutTrace');
  assert.equal(compiled.moduleRuntimeById.s01.interactions[0].warnings.length, 0);
});

test('scaffold fixture package is blocked from promotion', (t) => {
  const packageDir = createFixturePackage({
    approved: false,
    status: 'scaffold',
    scaffold: true,
  });
  t.after(() => rmSync(packageDir, { recursive: true, force: true }));

  const result = validateCoursePackage(resolve(packageDir), { requireReviewApproval: true });

  assert.equal(result.ok, false);
  assert.equal(result.promoteReady, false);
  assert.ok(result.issuesByCategory.scaffold.errors.length > 0);
  assert.ok(result.issuesByCategory.review.errors.length > 0);
});

test('missing non-critical content fields produce warnings not errors', (t) => {
  // Create a package with minimal module — missing subtitle, focusQuestion,
  // keyInsight, concepts, logicChain. Only title and narrative are present.
  const packageDir = mkdtempSync(join(tmpdir(), 'engine-lenient-'));
  t.after(() => rmSync(packageDir, { recursive: true, force: true }));

  mkdirSync(join(packageDir, 'modules'), { recursive: true });
  mkdirSync(join(packageDir, 'visuals'), { recursive: true });
  mkdirSync(join(packageDir, 'interactions'), { recursive: true });
  mkdirSync(join(packageDir, 'review'), { recursive: true });

  writeJson(join(packageDir, 'course.json'), {
    id: 'lenient-test', slug: 'lenient-test', title: 'Lenient Test',
    subtitle: 'Test', goal: 'Test', projectType: 'mixed',
    topic: 'test', language: 'zh', status: 'draft',
    categories: [{ id: 'core', name: 'Core', color: 'blue' }],
    audience: { primaryAudience: 'testers' },
    learningGoals: ['Verify leniency'],
    moduleGraph: { order: ['s01'], edges: [] },
    modules: ['s01'],
  });

  // Module with only title + narrative (missing subtitle, focusQuestion, etc.)
  writeJson(join(packageDir, 'modules', 's01.json'), {
    id: 's01', number: 1, title: 'Minimal Module',
    // subtitle: missing
    // focusQuestion: missing
    // keyInsight: missing
    // concepts: missing
    // logicChain: missing
    category: 'core', moduleKind: 'concept-clarification',
    primaryCognitiveAction: 'distinguish',
    narrative: [
      { type: 'text', content: 'A valid paragraph.' },
      { type: 'heading', content: 'Section' },
      { type: 'text', content: 'Another paragraph.' },
    ],
    bridgeTo: null, nextModuleId: null,
  });

  writeJson(join(packageDir, 'visuals', 'concept-maps.json'), {
    s01: { title: 'Map', nodes: [{ id: 'a', label: ['A'], x: 0, y: 0, w: 80, h: 40 }], edges: [], svgW: 100, svgH: 100, ariaLabel: 'Map' },
  });
  writeJson(join(packageDir, 'interactions', 'registry.json'), {});
  writeJson(join(packageDir, 'review', 'approval.json'), {
    approved: true, reviewedBy: 'test', reviewedAt: '2026-01-01T00:00:00Z', notes: '',
  });

  const result = validateCoursePackage(resolve(packageDir));

  // Should pass — missing non-critical fields are warnings, not errors
  assert.equal(result.ok, true, `Expected ok=true but got errors: ${JSON.stringify(result.errors)}`);
  // Should have warnings for the missing fields
  assert.ok(result.warnings.length > 0, 'Should have warnings for missing fields');
});
