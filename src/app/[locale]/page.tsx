import { listMirroredCourseSlugs } from '@/lib/course-package-adapter';
import type { Locale } from '@/lib/i18n';
import { getCoursePackage } from '@/lib/data';
import { getModuleSlug } from '@/lib/module-slug';
import { siteProject } from '@/lib/site-config';
import GenerateForm from '@/components/GenerateForm';
import CourseList from '@/components/CourseList';

export default function LocaleHome({ params }: { params: { locale: Locale } }) {
  const courses = listMirroredCourseSlugs().map((slug) => {
    const pkg = getCoursePackage(params.locale, slug);
    return {
      slug,
      title: pkg.title,
      topic: (pkg as any).topic || '',
      moduleCount: pkg.modules.length,
      firstModuleSlug: getModuleSlug(pkg.modules[0].id),
    };
  });
  const isZh = params.locale === 'zh';

  return (
    <div className="mx-auto max-w-4xl py-12 px-4 sm:px-6 lg:px-8">
      <div className="flex gap-12">
        {/* Left sidebar — usage guide */}
        <aside className="hidden lg:block w-56 shrink-0 pt-16">
          <div className="sticky top-24 space-y-6 text-xs text-[color:var(--color-muted)] leading-relaxed">
            <div>
              <div className="font-semibold text-[color:var(--color-text)] mb-2">{isZh ? '如何使用' : 'How to use'}</div>
              <ol className="space-y-2 list-decimal list-inside">
                <li>{isZh ? '输入你想学的知识主题' : 'Enter a topic you want to learn'}</li>
                <li>{isZh ? '回答几个问题帮我们了解你' : 'Answer a few questions about yourself'}</li>
                <li>{isZh ? '等待课程生成（约 10-20 分钟）' : 'Wait for generation (~10-20 min)'}</li>
                <li>{isZh ? '开始你的学习之旅' : 'Start your learning journey'}</li>
              </ol>
            </div>
            <div>
              <div className="font-semibold text-[color:var(--color-text)] mb-2">{isZh ? '适合输入' : 'Good topics'}</div>
              <ul className="space-y-1">
                <li>TCP/IP 协议</li>
                <li>Git 版本控制</li>
                <li>React Server Components</li>
                <li>{isZh ? '分布式一致性算法' : 'Distributed consensus'}</li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-[color:var(--color-text)] mb-2">{isZh ? '不适合输入' : 'Bad topics'}</div>
              <ul className="space-y-1 text-[color:var(--color-muted)]/70">
                <li>{isZh ? '单个字母或乱码' : 'Random chars'}</li>
                <li>{isZh ? '过于宽泛：如"编程"' : 'Too broad: "programming"'}</li>
                <li>{isZh ? '日常问题：如"今天吃什么"' : 'Casual questions'}</li>
              </ul>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-16">
          {/* Generate entry */}
          <section className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-[color:var(--color-text)] sm:text-4xl">
              {siteProject.title}
            </h1>
            <p className="mt-3 text-sm text-[color:var(--color-muted)] sm:text-base">
              {isZh ? '告诉我你想学什么' : 'Tell me what you want to learn'}
            </p>
            <GenerateForm locale={params.locale} />
            <p className="mt-3 text-xs text-[color:var(--color-muted)]/60 leading-relaxed">
              {isZh
                ? '课程生成约需 10-20 分钟，期间请不要关闭页面。你可以切到其他标签页做别的事情，生成完成后回来即可。'
                : 'Course generation takes ~10-20 minutes. Keep this tab open — you can switch to other tabs while waiting.'}
            </p>
          </section>

          {/* Existing courses */}
          <CourseList initialCourses={courses} locale={params.locale} />
        </div>
      </div>
    </div>
  );
}
