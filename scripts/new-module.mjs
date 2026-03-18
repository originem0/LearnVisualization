#!/usr/bin/env node
/**
 * Scaffold a new zh module JSON file.
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

if (!id || Number.isNaN(id)) {
  console.error('Usage: node scripts/new-module.mjs --id 13 --category frontier --title "标题" --subtitle "副标题"');
  process.exit(1);
}

const slug = `s${String(id).padStart(2, '0')}`;
const dir = resolve(root, 'src/content/zh/modules');
mkdirSync(dir, { recursive: true });
const file = resolve(dir, `${slug}.json`);

if (existsSync(file)) {
  console.error(`Refusing to overwrite existing file: ${file}`);
  process.exit(1);
}

const skeleton = {
  id,
  title,
  subtitle,
  category,
  concepts: {
    items: [
      { name: '核心概念 1', note: '一句短说明' },
      { name: '核心概念 2', note: '一句短说明' }
    ]
  },
  pitfalls: [
    { point: '常见误区', rootCause: '为什么容易误解' }
  ],
  quote: '',
  keyInsight: '这一章真正要记住的一句话。',
  logicChain: [
    '问题是什么',
    '为什么旧方案不够',
    '新方案解决了什么',
    '它如何导向下一章'
  ],
  examples: ['一个关键例子'],
  counterexamples: ['一个反例或边界情况'],
  opening: '用一个反直觉开场把读者拉进来。',
  narrative: [
    { type: 'heading', content: '核心问题' },
    { type: 'text', content: '先讲问题，不急着下定义。' },
    {
      type: 'comparison',
      label: '旧方案 vs 新方案',
      content: '旧方案：哪里不够\n新方案：解决了什么'
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
  bridgeTo: '这件事解决之后，下一个问题自然出现了。'
};

writeFileSync(file, JSON.stringify(skeleton, null, 2) + '\n', 'utf-8');

console.log(`✅ Created ${file}`);
console.log('Next steps:');
console.log(`1. Fill real content in ${slug}.json`);
console.log(`2. Add concept-map schema for ${slug} in src/data/concept-map-schemas.json`);
console.log(`3. Add registry mappings in src/lib/module-registry.ts`);
console.log('4. Run: npm run check');
