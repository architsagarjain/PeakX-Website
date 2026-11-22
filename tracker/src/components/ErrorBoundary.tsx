import { Component, type ReactNode } from 'react';
import { reportError } from '../state/telemetry';

/** Catches a crash in one screen, reports it with the screen and last action, and offers a way out. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) { reportError(error, `render${info.componentStack ? `: ${info.componentStack.split('\n')[1]?.trim() ?? ''}` : ''}`); }
  componentDidUpdate(prev: { resetKey?: string }) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="px-screen" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div className="px-card" role="alert" style={{ maxWidth: '440px', padding: '28px', gap: '12px' }}>
          <span className="px-card-title" style={{ fontSize: '26px', lineHeight: '30px' }}>Something broke on this screen</span>
          <span className="px-body grey">Your data is safe. We’ve noted what happened. Try again, or go back to This week.</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="px-cta" type="button" style={{ flex: '0 0 auto', height: '44px', fontSize: '16px' }} onClick={() => this.setState({ error: null })}>Try again</button>
            <button className="px-cta glass" type="button" style={{ flex: '0 0 auto', height: '44px', fontSize: '16px' }} onClick={() => { window.location.hash = '#/'; this.setState({ error: null }); }}>Go to Home</button>
          </div>
        </div>
      </div>
    );
  }
}
