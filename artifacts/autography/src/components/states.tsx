import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoadingPanel({ text = "LOADING" }: { text?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[50vh] animate-in fade-in duration-1000" role="status" aria-live="polite">
      <Loader2 className="w-8 h-8 text-sepia animate-spin mb-6" aria-hidden="true" />
      <div className="font-system text-sepia tracking-[0.2em] text-xs uppercase">{text}</div>
    </div>
  );
}

export function ErrorPanel({ error, onRetry, message }: { error?: Error; onRetry?: () => void, message?: string }) {
  const errorMessage = message || error?.message || "An unexpected error occurred during the operation.";
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[50vh]" role="alert">
      <div className="w-16 h-16 bg-velvet/10 flex items-center justify-center border border-velvet/30 mb-6 shadow-[0_0_20px_rgba(58,31,43,0.5)]">
        <AlertTriangle className="w-8 h-8 text-tally" aria-hidden="true" />
      </div>
      <h3 className="font-serif text-3xl text-oyster mb-4">Operation Failed</h3>
      <p className="font-mono text-xs text-sepia max-w-md mb-8 leading-relaxed">
        {errorMessage}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="border-velvet/30 text-oyster hover:bg-velvet/10 tracking-[0.1em] px-8">
          RETRY
        </Button>
      )}
    </div>
  );
}
