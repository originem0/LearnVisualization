/** Site-level branding, used by hub/catalog pages (not course-specific). */
export const siteProject = {
  title: 'LearnViz',
  goal: '输入你想学的主题，获得结构化的学习课程',
} as const;

export type SiteProject = typeof siteProject;
