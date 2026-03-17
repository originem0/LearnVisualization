import type { Locale } from './i18n';
import type { Phase } from './types';

export const phaseLabels: Record<Phase, Record<Locale, string>> = {
  'not-started': { zh: 'P0 定位', en: 'P0 positioning' },
  startup: { zh: 'P1 启动', en: 'P1 priming' },
  encoding: { zh: 'P2 编码', en: 'P2 encoding' },
  reference: { zh: 'P3 参考', en: 'P3 reference' },
  retrieval: { zh: 'P4 检索', en: 'P4 retrieval' },
  completed: { zh: '✓ 已完成', en: '✓ completed' },
};

export const labels = {
  zh: {
    nav: { timeline: '学习路径', compare: '版本对比', layers: '架构层' },
    buttons: { learnMore: '了解更多', expand: '展开细节', collapse: '收起细节' },
    badges: { passed: '通过', failed: '未通过' },
    sections: {
      progress: '模块进度分布',
      progressHint: '基于概念掌握比例',
      timelineTitle: '学习路径',
      timelineSubtitle: 's01 到 s12：渐进式 Agent 设计',
      layersTitle: '层次图例',
      weaknesses: '薄弱点',
      conceptList: '概念清单',
      conceptMap: '概念地图',
      logicChain: '逻辑链条',
      examples: '关键例子',
      counterexamples: '反例提醒',
      feynman: '费曼测试',
      backTimeline: '返回时间线',
      keyInsight: '关键洞察',
    },
    module: {
      learnMore: '了解更多',
      concepts: '概念掌握',
      keyInsight: '关键洞察',
      conceptMap: '概念地图',
      conceptMapDesc: '按学习顺序展示概念之间的关系链路。',
    },
    compare: { weaknesses: '薄弱点' },
    empty: {
      concepts: '暂无概念条目',
      weaknesses: '暂无薄弱点',
      logic: '暂无逻辑链条',
      conceptMap: '暂无概念关系，建议补充概念链路。',
      examples: '暂无例子',
      counterexamples: '暂无反例',
      feynman: '暂无费曼记录',
    },
    status: {
      mastered: '掌握',
      learning: '学习中',
      weak: '薄弱',
      'not-started': '未开始',
      active: '进行中',
      resolved: '已解决',
    },
    misc: { rootCause: '根因' },
    theme: { dark: '深色模式', light: '浅色模式' },
  },
  en: {
    nav: { timeline: 'Timeline', compare: 'Compare', layers: 'Layers' },
    buttons: { learnMore: 'Learn more', expand: 'Expand', collapse: 'Collapse' },
    badges: { passed: 'Pass', failed: 'Fail' },
    sections: {
      progress: 'Module progress',
      progressHint: 'Based on concept mastery ratio',
      timelineTitle: 'Timeline',
      timelineSubtitle: 's01–s12: progressive learning path',
      layersTitle: 'Layers legend',
      weaknesses: 'Weak points',
      conceptList: 'Concept list',
      conceptMap: 'Concept map',
      logicChain: 'Logic chain',
      examples: 'Key examples',
      counterexamples: 'Counterexamples',
      feynman: 'Feynman test',
      backTimeline: 'Back to timeline',
      keyInsight: 'Key insight',
    },
    module: {
      learnMore: 'Learn more',
      concepts: 'Concepts',
      keyInsight: 'Key insight',
      conceptMap: 'Concept map',
      conceptMapDesc: 'Show the relationship chain between concepts.',
    },
    compare: { weaknesses: 'Weak points' },
    empty: {
      concepts: 'No concepts yet',
      weaknesses: 'No weak points',
      logic: 'No logic chain yet',
      conceptMap: 'No concept relations yet. Add a concept chain.',
      examples: 'No examples yet',
      counterexamples: 'No counterexamples yet',
      feynman: 'No Feynman notes yet',
    },
    status: {
      mastered: 'Mastered',
      learning: 'Learning',
      weak: 'Weak',
      'not-started': 'Not started',
      active: 'Active',
      resolved: 'Resolved',
    },
    misc: { rootCause: 'Root cause' },
    theme: { dark: 'Dark mode', light: 'Light mode' },
  },
} as const;

export function getLabels(locale: Locale) {
  return labels[locale] ?? labels.zh;
}
