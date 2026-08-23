// @ts-nocheck
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center rounded-xl bg-white/50 backdrop-blur border border-red-100 shadow-sm">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h2>
          <p className="text-slate-500 mb-6 max-w-md">
            An unexpected error occurred while rendering this component. 
            The rest of the application should continue to function normally.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <RefreshCcw className="w-4 h-4" />
            Try Again
          </button>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div className="mt-8 w-full text-left bg-slate-50 p-4 rounded-lg border border-slate-200 overflow-auto text-xs font-mono text-slate-600">
              <p className="font-bold text-red-500 mb-2">{this.state.error.toString()}</p>
              <pre>{this.state.error.stack}</pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
