import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  stepName: string;
  onReset: () => void;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary that wraps each wizard step.
 * Prevents a crash in one step from killing the whole wizard.
 */
export class StepErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Onboarding] Step "${this.props.stepName}" crashed:`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoBack = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="py-8 text-center" role="alert">
          <div className="text-4xl mb-4" aria-hidden="true">😵</div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-600 mb-6">
            An error occurred on the "{this.props.stepName}" step. Your progress has been saved.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-6 py-2.5 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 active:bg-orange-700 transition-colors min-h-[44px]"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={this.handleGoBack}
              className="px-6 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 active:bg-slate-100 transition-colors min-h-[44px]"
            >
              Go to Previous Step
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre className="mt-6 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 text-left overflow-auto max-h-32">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
