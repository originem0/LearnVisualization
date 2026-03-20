import { existsSync, readFileSync, readdirSync } from 'fs';
import { basename, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(__dirname, '..');
export const coursesRoot = resolve(repoRoot, 'courses');

const ISSUE_CATEGORIES = ['structure', 'content', 'registry', 'scaffold', 'review'];

function createIssue(category, severity, message, extra = {}) {
  return { category, severity, message, ...extra };
}

function createRuntimeWarning(code, message, extra = {}) {
  return { code, message, ...extra };
}

function createIssueBucket() {
  return Object.fromEntries(
    ISSUE_CATEGORIES.map((category) => [category, { errors: [], warnings: [] }]),
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function safeReadJson(path, parseErrors) {
  try {
    return readJson(path);
  } catch (error) {
    parseErrors.push({
      path,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function normalizePackageDir(packageDir) {
  return resolve(String(packageDir));
}

function inspectCoursePackageDir(packageDir) {
  const normalizedDir = normalizePackageDir(packageDir);
  const reviewApprovalPath = resolve(normalizedDir, 'review', 'approval.json');
  const inspection = {
    packageDir: normalizedDir,
    slug: basename(normalizedDir),
    paths: {
      coursePath: resolve(normalizedDir, 'course.json'),
      modulesDir: resolve(normalizedDir, 'modules'),
      conceptMapsPath: resolve(normalizedDir, 'visuals', 'concept-maps.json'),
      interactionsPath: resolve(normalizedDir, 'interactions', 'registry.json'),
      reviewApprovalPath,
    },
    missing: [],
    parseErrors: [],
    course: null,
    modules: [],
    moduleFiles: [],
    conceptMaps: null,
    interactions: null,
    reviewApproval: null,
    reviewApprovalExists: existsSync(reviewApprovalPath),
  };

  if (!existsSync(inspection.paths.coursePath)) {
    inspection.missing.push(inspection.paths.coursePath);
  } else {
    inspection.course = safeReadJson(inspection.paths.coursePath, inspection.parseErrors);
  }

  if (!existsSync(inspection.paths.conceptMapsPath)) {
    inspection.missing.push(inspection.paths.conceptMapsPath);
  } else {
    inspection.conceptMaps = safeReadJson(inspection.paths.conceptMapsPath, inspection.parseErrors);
  }

  if (!existsSync(inspection.paths.interactionsPath)) {
    inspection.missing.push(inspection.paths.interactionsPath);
  } else {
    inspection.interactions = safeReadJson(inspection.paths.interactionsPath, inspection.parseErrors);
  }

  if (inspection.reviewApprovalExists) {
    inspection.reviewApproval = safeReadJson(reviewApprovalPath, inspection.parseErrors);
  }

  if (!existsSync(inspection.paths.modulesDir)) {
    inspection.missing.push(`${inspection.paths.modulesDir}/s*.json`);
    return inspection;
  }

  inspection.moduleFiles = readdirSync(inspection.paths.modulesDir)
    .filter((name) => /^s\d\d\.json$/.test(name))
    .sort();

  if (inspection.moduleFiles.length === 0) {
    inspection.missing.push(`${inspection.paths.modulesDir}/s*.json`);
    return inspection;
  }

  for (const name of inspection.moduleFiles) {
    const filePath = resolve(inspection.paths.modulesDir, name);
    const data = safeReadJson(filePath, inspection.parseErrors);
    if (data) {
      inspection.modules.push({ name, path: filePath, data });
    }
  }

  return inspection;
}

function inspectionToSource(inspection) {
  if (!inspection.course || !inspection.conceptMaps || !inspection.interactions) {
    return null;
  }

  return {
    slug:
      inspection.course.slug ||
      inspection.course.id ||
      inspection.slug,
    packageDir: inspection.packageDir,
    course: inspection.course,
    modulesDir: inspection.paths.modulesDir,
    moduleFiles: inspection.moduleFiles,
    modules: inspection.modules,
    conceptMaps: inspection.conceptMaps,
    interactions: inspection.interactions,
    reviewApproval: inspection.reviewApproval,
    reviewApprovalPath: inspection.reviewApprovalExists ? inspection.paths.reviewApprovalPath : null,
  };
}

function isLoadedCoursePackageSource(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof value.packageDir === 'string' &&
    value.course &&
    Array.isArray(value.modules) &&
    (value.modules.length === 0 || value.modules.every((entry) => entry && typeof entry === 'object' && 'data' in entry)) &&
    'conceptMaps' in value &&
    'interactions' in value,
  );
}

function normalizeLoadedSource(input) {
  if (typeof input === 'string') {
    return loadCoursePackageFromDir(input);
  }
  if (isLoadedCoursePackageSource(input)) {
    return input;
  }
  throw new Error('Expected a package directory or loaded course package source.');
}

function normalizeConceptMapForModule(conceptMaps, moduleId, moduleNumber) {
  return conceptMaps?.[moduleId] ?? conceptMaps?.[String(moduleNumber)] ?? null;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function getDeclaredPrimaryVisual(module) {
  if (!Array.isArray(module?.visuals) || module.visuals.length === 0) {
    return null;
  }
  return module.visuals.find((visual) => visual?.required) ?? module.visuals[0] ?? null;
}

function isRenderableConceptMapSchema(value) {
  return Boolean(
    isRecord(value) &&
      Array.isArray(value.nodes) &&
      value.nodes.length > 0 &&
      Array.isArray(value.edges) &&
      value.edges.length > 0 &&
      typeof value.svgW === 'number' &&
      typeof value.svgH === 'number' &&
      isNonEmptyString(value.ariaLabel),
  );
}

function getInteractionRegistryEntries(registryEntry) {
  if (!isRecord(registryEntry)) return [];

  return Object.entries(registryEntry)
    .filter(([key, value]) => key !== '_scaffold' && isRecord(value))
    .map(([key, value]) => ({ key, entry: value }));
}

function compileConceptMapRuntime(module, rawConceptMap) {
  const declaredVisual = getDeclaredPrimaryVisual(module);
  const title = isNonEmptyString(rawConceptMap?.title) ? rawConceptMap.title : null;
  const visualType = isNonEmptyString(rawConceptMap?.type)
    ? rawConceptMap.type
    : isNonEmptyString(declaredVisual?.type)
      ? declaredVisual.type
      : null;
  const warnings = [];

  if (!rawConceptMap) {
    if (declaredVisual) {
      warnings.push(
        createRuntimeWarning(
          'visual-schema-missing',
          'Visual data is missing from the course package. Rendering a placeholder card instead.',
          { moduleId: module.id },
        ),
      );
    }

    return {
      schema: null,
      title,
      visualType,
      warnings,
    };
  }

  if (isRenderableConceptMapSchema(rawConceptMap)) {
    return {
      schema: rawConceptMap,
      title,
      visualType,
      warnings,
    };
  }

  warnings.push(
    createRuntimeWarning(
      'visual-schema-incomplete',
      'Visual data is incomplete. Rendering a placeholder card instead.',
      { moduleId: module.id },
    ),
  );

  return {
    schema: null,
    title,
    visualType,
    warnings,
  };
}

function compileInteractionRuntime(module, rawInteractionRegistry) {
  const registryEntries = getInteractionRegistryEntries(rawInteractionRegistry);
  const requirements = Array.isArray(module?.interactionRequirements) ? module.interactionRequirements : [];

  return requirements.map((requirement) => {
    const warnings = [];
    const registryMatch = requirement.componentHint
      ? registryEntries.find(({ entry }) => entry.componentHint === requirement.componentHint) ?? null
      : registryEntries.find(({ entry }) => entry.priority === requirement.priority && isNonEmptyString(entry.componentHint))
        ?? (registryEntries.length === 1 && isNonEmptyString(registryEntries[0].entry.componentHint) ? registryEntries[0] : null);
    const componentHint = requirement.componentHint ?? registryMatch?.entry.componentHint ?? null;

    if (!isNonEmptyString(componentHint)) {
      warnings.push(
        createRuntimeWarning(
          'interaction-component-hint-missing',
          'This interaction is declared without a frontend component hint. Rendering a placeholder card instead.',
          { moduleId: module.id, priority: requirement.priority },
        ),
      );
    }

    return {
      capability: requirement.capability,
      purpose: requirement.purpose,
      priority: requirement.priority,
      componentHint: isNonEmptyString(componentHint) ? componentHint : null,
      registryKey: registryMatch?.key ?? null,
      warnings,
    };
  });
}

function compileModuleRuntime(module, rawConceptMap, rawInteractionRegistry) {
  const conceptMap = compileConceptMapRuntime(module, rawConceptMap);
  const interactions = compileInteractionRuntime(module, rawInteractionRegistry);
  const runtimeWarnings = conceptMap.warnings.concat(interactions.flatMap((interaction) => interaction.warnings));

  return {
    moduleId: module.id,
    conceptMap,
    interactions,
    runtimeWarnings,
  };
}

function groupIssues(issues) {
  const issuesByCategory = createIssueBucket();
  for (const issue of issues) {
    const bucket = issuesByCategory[issue.category];
    if (!bucket) continue;
    if (issue.severity === 'warning') {
      bucket.warnings.push(issue);
    } else {
      bucket.errors.push(issue);
    }
  }
  return issuesByCategory;
}

function summarizeReviewApproval(reviewApproval, reviewApprovalPath = null) {
  return {
    exists: Boolean(reviewApprovalPath || reviewApproval),
    approved: Boolean(reviewApproval && reviewApproval.approved === true),
    reviewedBy: typeof reviewApproval?.reviewedBy === 'string' ? reviewApproval.reviewedBy : null,
    reviewedAt: typeof reviewApproval?.reviewedAt === 'string' ? reviewApproval.reviewedAt : null,
    notes: typeof reviewApproval?.notes === 'string' ? reviewApproval.notes : null,
  };
}

export function listCourseSlugs(options = {}) {
  const root = resolve(options.coursesDir ?? coursesRoot);
  if (!existsSync(root)) return [];

  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(root, entry.name, 'course.json')))
    .map((entry) => entry.name)
    .sort();
}

export function loadCoursePackageFromDir(packageDir) {
  const inspection = inspectCoursePackageDir(packageDir);
  const source = inspectionToSource(inspection);

  if (!source) {
    const details = [
      inspection.missing.length > 0 ? `missing: ${inspection.missing.join(', ')}` : '',
      inspection.parseErrors.length > 0
        ? `parse errors: ${inspection.parseErrors.map((entry) => `${entry.path}: ${entry.message}`).join('; ')}`
        : '',
    ].filter(Boolean);
    throw new Error(`Invalid course package at ${inspection.packageDir}${details.length > 0 ? ` (${details.join(' | ')})` : ''}`);
  }

  return source;
}

export function loadCoursePackageBySlug(slug, options = {}) {
  return loadCoursePackageFromDir(resolve(options.coursesDir ?? coursesRoot, slug));
}

export function compileCoursePackage(input) {
  const source = normalizeLoadedSource(input);
  const moduleData = source.modules.map((entry) => entry.data);
  const moduleMap = Object.fromEntries(moduleData.map((module) => [module.id, module]));
  const declaredOrder = Array.isArray(source.course?.moduleGraph?.order) ? source.course.moduleGraph.order : [];
  const orderedModules = [];
  const unresolvedModuleIds = [];

  for (const moduleId of declaredOrder) {
    const module = moduleMap[moduleId];
    if (module) {
      orderedModules.push(module);
    } else {
      unresolvedModuleIds.push(moduleId);
    }
  }

  const orderedModuleIds = new Set(orderedModules.map((module) => module.id));
  const extraModules = moduleData.filter((module) => !orderedModuleIds.has(module.id));
  const modules = declaredOrder.length > 0 ? orderedModules.concat(extraModules) : moduleData;

  const conceptMapsByModuleId = {};
  const interactionsByModuleId = {};
  const moduleRuntimeById = {};
  const moduleRuntimes = [];
  for (const module of modules) {
    const rawConceptMap = normalizeConceptMapForModule(source.conceptMaps, module.id, module.number);
    const rawInteractionRegistry = source.interactions?.[module.id] ?? null;
    const moduleRuntime = compileModuleRuntime(module, rawConceptMap, rawInteractionRegistry);

    conceptMapsByModuleId[module.id] = rawConceptMap;
    interactionsByModuleId[module.id] = rawInteractionRegistry;
    moduleRuntimeById[module.id] = moduleRuntime;
    moduleRuntimes.push(moduleRuntime);
  }

  const coursePackage = {
    ...source.course,
    modules,
  };

  return {
    ...source,
    modules,
    moduleMap,
    moduleIds: modules.map((module) => module.id),
    unresolvedModuleIds,
    extraModules,
    conceptMapsByModuleId,
    interactionsByModuleId,
    moduleRuntimeById,
    moduleRuntimes,
    coursePackage,
    summary: {
      slug: coursePackage.slug || coursePackage.id || source.slug,
      title: coursePackage.title,
      subtitle: coursePackage.subtitle,
      status: coursePackage.status,
      moduleCount: modules.length,
      moduleIds: modules.map((module) => module.id),
    },
  };
}

export function getCourseSummary(input) {
  const compiled = 'summary' in Object(input ?? {}) ? input : compileCoursePackage(input);
  return compiled.summary;
}

export function validateCoursePackage(input, options = {}) {
  const requireReviewApproval = options.requireReviewApproval === true;
  let inspection = null;
  let source = null;

  if (typeof input === 'string') {
    inspection = inspectCoursePackageDir(input);
    source = inspectionToSource(inspection);
  } else {
    source = normalizeLoadedSource(input);
  }

  const issues = [];

  if (inspection) {
    for (const missingPath of inspection.missing) {
      issues.push(createIssue('structure', 'error', `missing required file: ${missingPath}`, { path: missingPath }));
    }

    for (const entry of inspection.parseErrors) {
      issues.push(createIssue('structure', 'error', `invalid JSON in ${entry.path}: ${entry.message}`, { path: entry.path }));
    }
  }

  if (!source) {
    const issuesByCategory = groupIssues(issues);
    return {
      ok: false,
      promoteReady: false,
      publishReady: false,
      errors: issues.filter((issue) => issue.severity === 'error'),
      warnings: issues.filter((issue) => issue.severity === 'warning'),
      issuesByCategory,
      summary: null,
      reviewApproval: summarizeReviewApproval(null),
    };
  }

  const compiled = compileCoursePackage(source);
  const course = source.course ?? {};
  const status = course.status;
  const isPublished = status === 'published';
  const registrySeverity = isPublished ? 'error' : 'warning';
  const categoryIds = new Set((course.categories ?? []).map((category) => category.id));
  const fileOrderedModules = source.modules.map((entry) => entry.data);
  const fileOrderedNumbers = fileOrderedModules.map((module) => module.number);
  const uniqueNumbers = new Set(fileOrderedNumbers);
  const moduleIdsFromFiles = fileOrderedModules.map((module) => module.id);
  const declaredOrder = Array.isArray(course.moduleGraph?.order) ? course.moduleGraph.order : [];
  const totalModules = compiled.modules.length;

  if (!course.id) {
    issues.push(createIssue('content', 'error', 'course.json: missing id', { path: source.packageDir }));
  }
  if (!course.title) {
    issues.push(createIssue('content', 'error', 'course.json: missing title', { path: source.packageDir }));
  }
  if (!Array.isArray(declaredOrder) || declaredOrder.length === 0) {
    issues.push(createIssue('structure', 'error', 'course.json: missing moduleGraph.order', { path: resolve(source.packageDir, 'course.json') }));
  }

  if (uniqueNumbers.size !== fileOrderedNumbers.length) {
    issues.push(createIssue('structure', 'error', 'duplicate module numbers', { path: source.modulesDir }));
  }

  for (let index = 0; index < fileOrderedNumbers.length; index += 1) {
    const expected = index + 1;
    if (fileOrderedNumbers[index] !== expected) {
      issues.push(
        createIssue(
          'structure',
          'error',
          `module sequence broken at index ${index}: expected number=${expected}, got number=${fileOrderedNumbers[index]}`,
          { path: source.modulesDir },
        ),
      );
    }
  }

  if (JSON.stringify(declaredOrder) !== JSON.stringify(moduleIdsFromFiles)) {
    issues.push(
      createIssue(
        'structure',
        'error',
        'course.moduleGraph.order does not match module file order',
        { path: resolve(source.packageDir, 'course.json') },
      ),
    );
  }

  if (compiled.unresolvedModuleIds.length > 0) {
    issues.push(
      createIssue(
        'structure',
        'error',
        `course.moduleGraph.order references missing modules: ${compiled.unresolvedModuleIds.join(', ')}`,
        { path: resolve(source.packageDir, 'course.json') },
      ),
    );
  }

  if (compiled.extraModules.length > 0) {
    issues.push(
      createIssue(
        'structure',
        'error',
        `module files missing from course.moduleGraph.order: ${compiled.extraModules.map((module) => module.id).join(', ')}`,
        { path: source.modulesDir },
      ),
    );
  }

  for (const { name, data: module } of source.modules) {
    const expectedName = `${module.id}.json`;
    if (name !== expectedName) {
      issues.push(
        createIssue(
          'structure',
          'error',
          `${name}: filename does not match module id ${module.id}`,
          { moduleId: module.id, path: resolve(source.modulesDir, name) },
        ),
      );
    }
    if (!categoryIds.has(module.category)) {
      issues.push(
        createIssue(
          'structure',
          'error',
          `${name}: unknown category '${module.category}'`,
          { moduleId: module.id, path: resolve(source.modulesDir, name) },
        ),
      );
    }
  }

  for (const module of compiled.modules) {
    if (!module.title) {
      issues.push(createIssue('content', 'error', 'missing title', { moduleId: module.id, path: resolve(source.modulesDir, `${module.id}.json`) }));
    }
    if (!module.subtitle) {
      issues.push(createIssue('content', 'error', 'missing subtitle', { moduleId: module.id, path: resolve(source.modulesDir, `${module.id}.json`) }));
    }
    if (!module.focusQuestion) {
      issues.push(createIssue('content', 'error', 'missing focusQuestion', { moduleId: module.id, path: resolve(source.modulesDir, `${module.id}.json`) }));
    }
    if (!module.keyInsight) {
      issues.push(createIssue('content', 'error', 'missing keyInsight', { moduleId: module.id, path: resolve(source.modulesDir, `${module.id}.json`) }));
    }
    if (!module.moduleKind) {
      issues.push(createIssue('content', 'error', 'missing moduleKind', { moduleId: module.id, path: resolve(source.modulesDir, `${module.id}.json`) }));
    }
    if (!module.primaryCognitiveAction) {
      issues.push(createIssue('content', 'error', 'missing primaryCognitiveAction', { moduleId: module.id, path: resolve(source.modulesDir, `${module.id}.json`) }));
    }
    if (!module.misconception) {
      issues.push(createIssue('content', 'warning', 'missing misconception', { moduleId: module.id, path: resolve(source.modulesDir, `${module.id}.json`) }));
    }
    if (!Array.isArray(module.retrievalPrompts) || module.retrievalPrompts.length === 0) {
      issues.push(createIssue('content', 'warning', 'missing retrievalPrompts', { moduleId: module.id, path: resolve(source.modulesDir, `${module.id}.json`) }));
    }
    if (!Array.isArray(module.narrative) || module.narrative.length === 0) {
      issues.push(createIssue('content', 'error', 'missing narrative (empty or absent)', { moduleId: module.id, path: resolve(source.modulesDir, `${module.id}.json`) }));
    } else if (module.narrative.length < 3) {
      issues.push(
        createIssue('content', 'error', `narrative too short (${module.narrative.length} blocks, need >=3)`, {
          moduleId: module.id,
          path: resolve(source.modulesDir, `${module.id}.json`),
        }),
      );
    }
    if (module.number < totalModules && !module.bridgeTo) {
      issues.push(createIssue('content', 'error', 'missing bridgeTo (not last module)', { moduleId: module.id, path: resolve(source.modulesDir, `${module.id}.json`) }));
    }
    if (!Array.isArray(module.concepts) || module.concepts.length === 0) {
      issues.push(createIssue('content', 'error', 'missing concepts', { moduleId: module.id, path: resolve(source.modulesDir, `${module.id}.json`) }));
    }
    if (!Array.isArray(module.logicChain) || module.logicChain.length === 0) {
      issues.push(createIssue('content', 'error', 'missing logicChain', { moduleId: module.id, path: resolve(source.modulesDir, `${module.id}.json`) }));
    }
  }

  for (const module of compiled.modules) {
    const bindingKey = `${compiled.summary.slug}/${module.id}`;
    const schema = compiled.conceptMapsByModuleId[module.id];
    const registryEntry = compiled.interactionsByModuleId[module.id] ?? {};
    const requirements = Array.isArray(module.interactionRequirements) ? module.interactionRequirements : [];
    const registeredEntries = Object.values(registryEntry).filter(Boolean);

    if (!schema) {
      issues.push(createIssue('registry', registrySeverity, `[${bindingKey}]: missing concept-map schema`, { moduleId: module.id }));
    } else {
      if (!Array.isArray(schema.nodes) || schema.nodes.length === 0) {
        issues.push(createIssue('registry', registrySeverity, `[${bindingKey}]: schema.nodes empty`, { moduleId: module.id }));
      }
      if (!Array.isArray(schema.edges) || schema.edges.length === 0) {
        issues.push(createIssue('registry', registrySeverity, `[${bindingKey}]: schema.edges empty`, { moduleId: module.id }));
      }
      if (!schema.svgW || !schema.svgH) {
        issues.push(createIssue('registry', registrySeverity, `[${bindingKey}]: missing svg dimensions`, { moduleId: module.id }));
      }
      if (!schema.ariaLabel) {
        issues.push(createIssue('registry', registrySeverity, `[${bindingKey}]: missing ariaLabel`, { moduleId: module.id }));
      }

      if (Array.isArray(schema.nodes)) {
        const nodeIds = new Set();
        for (const node of schema.nodes) {
          if (nodeIds.has(node.id)) {
            issues.push(createIssue('registry', 'error', `[${bindingKey}]: duplicate node id '${node.id}'`, { moduleId: module.id }));
          }
          nodeIds.add(node.id);
        }
        if (Array.isArray(schema.edges)) {
          for (const edge of schema.edges) {
            if (!nodeIds.has(edge.from)) {
              issues.push(createIssue('registry', 'error', `[${bindingKey}]: edge.from '${edge.from}' not found in nodes`, { moduleId: module.id }));
            }
            if (!nodeIds.has(edge.to)) {
              issues.push(createIssue('registry', 'error', `[${bindingKey}]: edge.to '${edge.to}' not found in nodes`, { moduleId: module.id }));
            }
          }
        }
      }
    }

    if (requirements.length > 0 && registeredEntries.length === 0) {
      issues.push(createIssue('registry', registrySeverity, `[${bindingKey}]: missing interaction registry entry`, { moduleId: module.id }));
    }

    for (const requirement of requirements) {
      if (!requirement.componentHint) {
        issues.push(
          createIssue(
            'registry',
            registrySeverity,
            `[${bindingKey}]: ${requirement.priority} interaction requirement missing componentHint`,
            { moduleId: module.id },
          ),
        );
        continue;
      }

      const matched = registeredEntries.find((entry) => entry.componentHint === requirement.componentHint);
      if (!matched) {
        issues.push(
          createIssue(
            'registry',
            registrySeverity,
            `[${bindingKey}]: missing binding for componentHint '${requirement.componentHint}'`,
            { moduleId: module.id },
          ),
        );
        continue;
      }

      if (matched.priority && matched.priority !== requirement.priority) {
        issues.push(
          createIssue(
            'registry',
            registrySeverity,
            `[${bindingKey}]: componentHint '${requirement.componentHint}' priority mismatch (${matched.priority} vs ${requirement.priority})`,
            { moduleId: module.id },
          ),
        );
      }
    }

    for (const entry of registeredEntries) {
      if (!entry.componentHint) {
        issues.push(createIssue('registry', registrySeverity, `[${bindingKey}]: registered interaction missing componentHint`, { moduleId: module.id }));
        continue;
      }

      const matchedRequirement = requirements.find((requirement) => requirement.componentHint === entry.componentHint);
      if (!matchedRequirement) {
        issues.push(
          createIssue(
            'registry',
            registrySeverity,
            `[${bindingKey}]: registry has extra componentHint '${entry.componentHint}'`,
            { moduleId: module.id },
          ),
        );
      }
    }
  }

  if (course._scaffold) {
    issues.push(createIssue('scaffold', 'error', 'course.json is scaffold', { path: resolve(source.packageDir, 'course.json') }));
  }
  if (course.status === 'scaffold') {
    issues.push(createIssue('scaffold', 'error', "course status is 'scaffold', not production-ready", { path: resolve(source.packageDir, 'course.json') }));
  }

  for (const [key, schema] of Object.entries(source.conceptMaps ?? {})) {
    if (schema?._scaffold) {
      issues.push(createIssue('scaffold', 'error', `concept-map '${key}' is placeholder scaffold`, { path: resolve(source.packageDir, 'visuals', 'concept-maps.json') }));
    }
  }

  for (const [key, entry] of Object.entries(source.interactions ?? {})) {
    if (entry?._scaffold) {
      issues.push(createIssue('scaffold', 'error', `interaction registry '${key}' is placeholder scaffold`, { path: resolve(source.packageDir, 'interactions', 'registry.json') }));
    }
  }

  for (const module of compiled.modules) {
    if (module._scaffold) {
      issues.push(
        createIssue(
          'scaffold',
          'error',
          `module '${module.id}' is scaffold`,
          { moduleId: module.id, path: resolve(source.modulesDir, `${module.id}.json`) },
        ),
      );
    }
  }

  const reviewApproval = summarizeReviewApproval(source.reviewApproval, source.reviewApprovalPath);
  const reviewPath = source.reviewApprovalPath ?? resolve(source.packageDir, 'review', 'approval.json');
  const reviewRequiredByStatus = isPublished;
  const reviewMustPass = requireReviewApproval || reviewRequiredByStatus;

  if (!reviewApproval.exists) {
    if (reviewMustPass) {
      issues.push(createIssue('review', 'error', 'missing review/approval.json', { path: reviewPath }));
    }
  } else if (!source.reviewApproval || typeof source.reviewApproval !== 'object' || Array.isArray(source.reviewApproval)) {
    issues.push(createIssue('review', 'error', 'review/approval.json must be a JSON object', { path: reviewPath }));
  } else {
    if (typeof source.reviewApproval.approved !== 'boolean') {
      issues.push(createIssue('review', 'error', "review/approval.json: 'approved' must be a boolean", { path: reviewPath }));
    } else if (source.reviewApproval.approved !== true && reviewMustPass) {
      issues.push(createIssue('review', 'error', 'review approval is required before promotion', { path: reviewPath }));
    }

    if (source.reviewApproval.approved === true) {
      if (typeof source.reviewApproval.reviewedBy !== 'string' || source.reviewApproval.reviewedBy.trim() === '') {
        issues.push(createIssue('review', 'error', "review/approval.json: 'reviewedBy' is required when approved=true", { path: reviewPath }));
      }
      if (typeof source.reviewApproval.reviewedAt !== 'string' || source.reviewApproval.reviewedAt.trim() === '') {
        issues.push(createIssue('review', 'error', "review/approval.json: 'reviewedAt' is required when approved=true", { path: reviewPath }));
      }
    }
  }

  const issuesByCategory = groupIssues(issues);
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const ok = errors.length === 0;
  const promoteReady =
    ok &&
    reviewApproval.approved === true &&
    issuesByCategory.scaffold.errors.length === 0 &&
    issuesByCategory.review.errors.length === 0;
  const publishReady = promoteReady && status === 'published';

  return {
    ok,
    promoteReady,
    publishReady,
    errors,
    warnings,
    issuesByCategory,
    summary: compiled.summary,
    reviewApproval,
  };
}
