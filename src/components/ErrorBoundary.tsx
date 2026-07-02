import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  override state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  override componentDidCatch(err: Error) {
    console.error('[ErrorBoundary]', err);
  }
  override render() {
    return this.state.hasError ? (
      <div className="p-8 text-center text-muted-foreground">
        Something went wrong.{' '}
        <button onClick={() => location.reload()} className="underline">
          Reload
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
