import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { AlertTriangle } from 'lucide-react';

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  /** Changing this clears a caught error. Pass the route to recover on navigation. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

function DefaultFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-house text-oyster p-6">
      <div className="max-w-lg w-full text-center flex flex-col items-center border border-velvet/30 bg-velvet/5 p-8 sm:p-12 shadow-2xl">
        <div className="w-16 h-16 bg-velvet/20 flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-velvet" />
        </div>
        <h1 className="text-3xl font-serif text-oyster mb-4">
          Something went wrong
        </h1>
        <p className="font-sans text-sm text-sepia leading-relaxed mb-6">
          This part of the app hit an unexpected error. The rest of the app should still be running.
        </p>
        {/* Dev only: messages can carry API responses and other internals. */}
        {import.meta.env.DEV ? (
          <pre className="w-full overflow-x-auto border border-sepia/30 bg-house/80 p-4 text-left font-mono text-[10px] text-sepia leading-relaxed mb-8 shadow-inner">
            {error.message || String(error)}
          </pre>
        ) : null}
        <button
          type="button"
          onClick={resetError}
          className="border border-oyster/30 bg-house px-8 py-3 font-system text-xs tracking-[0.15em] text-oyster transition-colors hover:bg-oyster/10 hover:border-oyster/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
        >
          TRY AGAIN
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(
      'ErrorBoundary caught an error:',
      toError(error),
      info.componentStack,
    );
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.error !== null &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetError();
    }
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }
    const Fallback = this.props.FallbackComponent ?? DefaultFallback;
    return <Fallback error={error} resetError={this.resetError} />;
  }
}