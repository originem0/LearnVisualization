import { enabledLocales, type Locale } from '@/lib/i18n';
import GenerateForm from '@/components/GenerateForm';

export const dynamicParams = false;

export function generateStaticParams() {
  return enabledLocales.map((locale) => ({ locale }));
}

export default function GeneratePage({ params }: { params: { locale: Locale } }) {
  const isZh = params.locale === 'zh';

  return (
    <div className="mx-auto max-w-xl py-12">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
        {isZh ? '开发工具' : 'Dev tools'}
      </div>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-[color:var(--color-text)] sm:text-3xl">
        {isZh ? '生成新课程' : 'Generate a new course'}
      </h1>
      <p className="mt-3 text-sm leading-7 text-[color:var(--color-muted)]">
        {isZh
          ? '输入一个学习主题，自动生成课程结构和模块内容。'
          : 'Enter a topic to auto-generate course structure and module content.'}
      </p>

      <GenerateForm locale={params.locale} />
    </div>
  );
}
