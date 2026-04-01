import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Something went wrong</p>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: '0.5rem' }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
