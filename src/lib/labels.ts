import type { Locale } from './i18n';

export const labels = {
  zh: {
    nav: { timeline: '学习路径', compare: '版本对比', layers: '架构层' },
    buttons: { learnMore: '了解更多', expand: '展开细节', collapse: '收起细节' },
    tabs: { learn: '学习', interactive: '交互', deepDive: '深入' },
    sections: {
      timelineTitle: '学习路径',
      timelineSubtitle: 's01 到 s12：渐进式学习路径',
      layersTitle: '层次图例',
      weaknesses: '薄弱点',
      conceptList: '概念清单',
      conceptMap: '概念地图',
      logicChain: '逻辑链条',
      examples: '关键例子',
      counterexamples: '反例提醒',
      backTimeline: '返回时间线',
      keyInsight: '关键洞察',
    },
    module: {
      learnMore: '了解更多',
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
    },
    status: {
      active: '进行中',
      resolved: '已解决',
    },
    misc: { rootCause: '根因' },
    theme: { dark: '深色模式', light: '浅色模式' },
  },
  en: {
    nav: { timeline: 'Timeline', compare: 'Compare', layers: 'Layers' },
    buttons: { learnMore: 'Learn more', expand: 'Expand', collapse: 'Collapse' },
    tabs: { learn: 'Learn', interactive: 'Interactive', deepDive: 'Deep Dive' },
    sections: {
      timelineTitle: 'Timeline',
      timelineSubtitle: 's01–s12: progressive learning path',
      layersTitle: 'Layers legend',
      weaknesses: 'Weak points',
      conceptList: 'Concept list',
      conceptMap: 'Concept map',
      logicChain: 'Logic chain',
      examples: 'Key examples',
      counterexamples: 'Counterexamples',
      backTimeline: 'Back to timeline',
      keyInsight: 'Key insight',
    },
    module: {
      learnMore: 'Learn more',
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
    },
    status: {
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
