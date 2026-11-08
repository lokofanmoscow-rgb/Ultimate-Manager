import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import './ui/styles.css';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { console.error(err); }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 20 }}>
          <h2>Произошла ошибка</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{String(this.state.err.stack || this.state.err)}</pre>
          <button className="btn primary" onClick={() => this.setState({ err: null })}>Продолжить</button>{' '}
          <button className="btn" onClick={() => location.reload()}>Перезапустить</button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>);
