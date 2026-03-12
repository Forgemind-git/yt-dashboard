import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card p-8 text-center">
          <p className="text-danger text-sm mb-2">Something went wrong</p>
          {this.state.error?.message && (
            <p className="text-xs text-gray-600 mb-3">{this.state.error.message}</p>
          )}
          <button
            className="text-xs px-3 py-1.5 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
