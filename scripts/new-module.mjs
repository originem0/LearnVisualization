#!/usr/bin/env node
/**
 * Scaffold a new module JSON file in the course-package path.
 * Example:
 *   node scripts/new-module.mjs --id 13 --category frontier --title "标题" --subtitle "副标题"
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const args = process.argv.slice(2);

function getArg(name, fallback = '') {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : fallback;
}

const id = Number(getArg('id'));
const category = getArg('category', 'foundations');
const title = getArg('title', `模块 ${id || 'XX'}`);
const subtitle = getArg('subtitle', '一句话说明这个模块的核心问题');
const course = getArg('course', 'llm-fundamentals');
const moduleKind = getArg('moduleKind', 'mechanism-walkthrough');
const cognitiveAction = getArg('cognitiveAction', 'trace');

if (!id || Number.isNaN(id)) {
  console.error('Usage: node scripts/new-module.mjs --id 13 --category frontier --title "标题" --subtitle "副标题" [--course llm-fundamentals] [--moduleKind mechanism-walkthrough] [--cognitiveAction trace]');
  process.exit(1);
}

const slug = `s${String(id).padStart(2, '0')}`;
const dir = resolve(root, 'courses', course, 'modules');
mkdirSync(dir, { recursive: true });
const file = resolve(dir, `${slug}.json`);

if (existsSync(file)) {
  console.error(`Refusing to overwrite existing file: ${file}`);
  process.exit(1);
}

const skeleton = {
  id: slug,
  number: id,
  title,
  subtitle,
  category,
  moduleKind,
  primaryCognitiveAction: cognitiveAction,
  focusQuestion: '这一章真正要回答的核心问题是什么？',
  misconception: '用户最容易带着什么旧直觉走进来？',
  quote: '',
  keyInsight: '这一章真正要记住的一句话。',
  opening: '用一个反直觉开场把读者拉进来。',
  priorKnowledge: ['用户默认已知的前知识'],
  targetChunk: '这一章试图帮用户形成哪个认知组块？',
  chunkDependencies: [],
  concepts: [
    { name: '核心概念 1', note: '一句短说明' },
    { name: '核心概念 2', note: '一句短说明' }
  ],
  logicChain: [
    '问题是什么',
    '为什么旧方案不够',
    '新方案解决了什么',
    '它如何导向下一章'
  ],
  examples: ['一个关键例子'],
  counterexamples: ['一个反例或边界情况'],
  pitfalls: [
    { point: '常见误区', rootCause: '为什么容易误解' }
  ],
  narrative: [
    { type: 'text', content: '先讲问题，不急着下定义。' },
    {
      type: 'comparison',
      label: '旧方案 vs 新方案',
      content: '旧方案：哪里不够
新方案：解决了什么'
    },
    {
      type: 'steps',
      label: '过程拆解',
      content: '',
      steps: [
        { title: 'Step 1', description: '发生了什么', visual: 'ASCII / 文本视觉', highlight: '' },
        { title: 'Step 2', description: '又发生了什么', visual: 'ASCII / 文本视觉', highlight: '' }
      ]
    },
    { type: 'callout', content: '一句真正该记住的话。' }
  ],
  visuals: [
    { id: `${slug}-concept-map`, type: 'conceptMap', required: true }
  ],
  interactionRequirements: [
    {
      capability: 'trace',
      purpose: '首屏核心理解交互',
      priority: 'core'
    }
  ],
  retrievalPrompts: [
    {
      type: 'fill-gap',
      prompt: '写一个能验证用户是否真正理解本章的主动回忆问题。'
    }
  ],
  bridgeTo: '这件事解决之后，下一个问题自然出现了。',
  nextModuleId: null
};

writeFileSync(file, JSON.stringify(skeleton, null, 2) + '
', 'utf-8');

console.log(`✅ Created ${file}`);
console.log('Next steps:');
console.log(`1. Fill real content in ${slug}.json`);
console.log(`2. Add / update concept-map schema in courses/${course}/visuals/`);
console.log(`3. Add / update interaction hints in courses/${course}/interactions/registry.json`);
console.log('4. Run: npm run check');
