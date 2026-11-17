import { Component, useEffect, useState } from 'react';

interface ErrorInfo {
  componentStack: string;
  error: Error;
}

export class ErrorBoundary extends Component<{ children: React.ReactNode; fallback?: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // در اینجا می‌توانید خطا را به سرویس مانیتورینگ (Sentry، LogRocket و غیره) ارسال کنید
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="error-boundary" style={{ padding: 24, textAlign: 'center', direction: 'rtl' }}>
          <h2 style={{ color: 'var(--red-600)' }}>خطای غیرمنتظره رخ داد</h2>
          <p style={{ marginTop: 8, color: 'var(--text-muted)' }}>متأسفانه برنامه با خطا مواجه شد. لطفاً صفحه را بازآوری کنید.</p>
          <details style={{ marginTop: 16, textAlign: 'left', direction: 'ltr' }}>
            <summary>جزئیات فنی</summary>
            <pre style={{ marginTop: 8, padding: 12, background: 'var(--surface-2)', borderRadius: 4, overflow: 'auto', fontSize: 12 }}>
              {this.state.error?.toString()}\n{this.state.error?.stack}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              background: 'var(--primary)',
              color: 'var(--on-primary)',
              border: 'none',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
            }}
          >
            بازآوری صفحه
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;