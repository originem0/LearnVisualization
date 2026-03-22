'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors in interactive components so the rest of the page
 * (narrative, concepts, retrieval) remains readable.
 */
export default class InteractionErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[InteractionErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          <p className="font-medium">交互组件加载失败</p>
          <p className="mt-1 text-xs opacity-70">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
