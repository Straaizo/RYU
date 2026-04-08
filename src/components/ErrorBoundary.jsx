import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="error-boundary">
        <pre className="error-boundary-banner">{`
╔══════════════════════════════════════════════╗
║        ██████╗ ██╗   ██╗██╗   ██╗            ║
║        ██╔══██╗╚██╗ ██╔╝██║   ██║            ║
║        ██████╔╝ ╚████╔╝ ██║   ██║            ║
║        ██╔══██╗  ╚██╔╝  ██║   ██║            ║
║        ██║  ██║   ██║   ╚██████╔╝            ║
║        ╚═╝  ╚═╝   ╚═╝    ╚═════╝             ║
╚══════════════════════════════════════════════╝`}</pre>

        <div className="error-boundary-content">
          <p className="red" style={{ fontSize: 16, fontWeight: 700 }}>
            ✗ Algo salió mal
          </p>
          <p className="gray" style={{ marginTop: 8 }}>
            {this.state.error.message}
          </p>

          <div className="error-boundary-acciones">
            <button
              className="onboarding-btn"
              style={{ maxWidth: 220 }}
              onClick={() => this.setState({ error: null, info: null })}
            >
              ↺ Intentar de nuevo
            </button>
            <button
              className="onboarding-btn"
              style={{ maxWidth: 220, borderColor: 'var(--gray)', color: 'var(--gray)' }}
              onClick={() => window.location.reload()}
            >
              ⟳ Recargar app
            </button>
          </div>

          <details className="error-boundary-details">
            <summary className="gray">Ver detalle técnico</summary>
            <pre className="error-trace">
              {this.state.error.stack}
              {this.state.info?.componentStack}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
