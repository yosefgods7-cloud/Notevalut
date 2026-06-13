import React, { Component, ErrorInfo } from 'react';
import { StorageProvider } from './context/StorageContext';
import { AuthProvider } from './context/AuthContext';
import { MainLayout } from './components/MainLayout';
import { GlobalDialogs } from './components/GlobalDialogs';

class ErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'var(--color-text-primary)' }}>
          <h1>Component Error</h1>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
          <button onClick={() => window.location.reload()} style={{marginTop: 10, padding: 8, background: 'var(--color-accent)'}}>Reload</button>
        </div>
      );
    }
    return this.props.children; 
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
          <StorageProvider>
            <MainLayout />
            <GlobalDialogs />
          </StorageProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
