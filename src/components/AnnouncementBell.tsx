'use client';

import { useState } from 'react';

export default function AnnouncementBell({ locale }: { locale: string }) {
  const [open, setOpen] = useState(false);
  const isZh = locale === 'zh';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--color-muted)] transition-colors hover:bg-zinc-100 hover:text-[color:var(--color-text)] dark:hover:bg-zinc-800"
        aria-label={isZh ? '系统公告' : 'Announcements'}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 1.5a4 4 0 0 1 4 4c0 4 2 5 2 5H2s2-1 2-5a4 4 0 0 1 4-4" />
          <path d="M6.5 13.5a1.5 1.5 0 0 0 3 0" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-4 shadow-lg">
            <div className="mb-3 text-xs font-semibold text-[color:var(--color-text)]">
              {isZh ? '使用说明' : 'Guide'}
            </div>
            <ol className="mb-4 space-y-1.5 text-xs text-[color:var(--color-muted)] leading-relaxed list-decimal list-inside">
              <li>{isZh ? '输入一个具体的知识主题（如 Git 版本控制、TCP/IP 协议）' : 'Enter a specific topic (e.g. Git, TCP/IP)'}</li>
              <li>{isZh ? '回答几个问题，帮我们了解你的背景和目标' : 'Answer a few questions about your background'}</li>
              <li>{isZh ? '等待 10-20 分钟生成课程，期间可以做别的事' : 'Wait 10-20 min, you can switch tabs'}</li>
              <li>{isZh ? '生成完成后直接开始学习' : 'Start learning when ready'}</li>
            </ol>
            <div className="mb-2 text-xs font-semibold text-[color:var(--color-text)]">
              {isZh ? '注意事项' : 'Notes'}
            </div>
            <ul className="space-y-1 text-xs text-[color:var(--color-muted)] leading-relaxed">
              <li>{isZh ? '· 不接受乱码、单字母、聊天语句' : '· No gibberish, single chars, or chat'}</li>
              <li>{isZh ? '· 过于宽泛的主题（如"编程"）会建议细化方向' : '· Overly broad topics will get suggestions'}</li>
              <li>{isZh ? '· 每日最多生成 10 门课程' : '· Max 10 courses per day'}</li>
              <li>{isZh ? '· 生成期间请不要关闭页面' : '· Keep the page open during generation'}</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
