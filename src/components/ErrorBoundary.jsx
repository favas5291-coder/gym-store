import { Component } from "react";
export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="empty-state" role="alert">
        <h1>This page couldn’t load</h1>
        <p>Please reload to try again.</p>
        <button
          type="button"
          className="button"
          onClick={() => window.location.reload()}
        >
          Reload page
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}