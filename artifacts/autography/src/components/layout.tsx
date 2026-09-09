import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { AlertTriangle, Menu, X, Info } from "lucide-react";
import { useGetActiveCall, useHealthCheck } from "@workspace/api-client-react";

function NavLink({ href, children, isPublic = false, activePattern }: { href: string, children: React.ReactNode, isPublic?: boolean, activePattern?: string }) {
  const [location] = useLocation();
  const isActive = activePattern && activePattern !== "/" 
    ? location.startsWith(activePattern) 
    : location === href;
  
  return (
    <Link 
      href={href} 
      aria-current={isActive ? "page" : undefined}
      className={`block whitespace-nowrap font-system text-xs tracking-[0.15em] transition-colors focus-visible:outline-none focus-visible:bg-sepia/20 px-5 py-3.5 sm:py-4 ${
        isActive 
          ? (isPublic ? "text-brass border-b-2 border-brass bg-brass/5" : "text-oyster border-b-2 border-oyster bg-house") 
          : "text-sepia hover:text-oyster hover:bg-house/50 border-b-2 border-transparent"
      }`}
    >
      {children}
    </Link>
  );
}

function Orientation() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem("autography_orientation_dismissed") === "true");
  }, []);

  if (dismissed) return null;

  return (
    <div className="bg-velvet/10 border-b border-velvet/30 p-4 sm:p-6 relative text-oyster animate-in slide-in-from-top-4 duration-500">
      <div className="max-w-7xl mx-auto flex gap-4 sm:gap-6 items-start">
        <div className="mt-1 flex-shrink-0">
          <Info className="w-5 h-5 text-brass" />
        </div>
        <div className="flex-1 pr-8">
          <h2 className="font-system tracking-[0.1em] text-sm text-brass mb-2 uppercase">Producer Orientation</h2>
          <p className="font-sans text-sm text-oyster/80 leading-relaxed max-w-4xl">
            Welcome to the Autography control room. This is a safety-first live production desk. 
            Start with the Board, inspect aggregate signals in Constellation, then choose whether a supported response
            should move through human review. Receipts preserve the decision trail; issued Drops carry a checkable hash.
          </p>
        </div>
        <button 
          onClick={() => {
            localStorage.setItem("autography_orientation_dismissed", "true");
            setDismissed(true);
          }}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 text-sepia hover:text-oyster focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass p-1 transition-colors"
          aria-label="Dismiss orientation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { data: activeCall } = useGetActiveCall({
    query: {
      queryKey: ["/api/call/active"],
      refetchInterval: 1000,
    },
  });
  const { data: health } = useHealthCheck({
    query: {
      queryKey: ["/api/healthz"],
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
      staleTime: 15_000,
    },
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!activeCall) return;
    
    const root = document.documentElement;
    if (activeCall.state !== "LIVE" || activeCall.seconds_remaining <= 0) {
      root.style.setProperty("--saturation", "0");
    } else {
      const remaining = activeCall.seconds_remaining;
      if (remaining > 60) {
        root.style.setProperty("--saturation", "1");
      } else {
        root.style.setProperty("--saturation", (remaining / 60).toString());
      }
    }
  }, [activeCall]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-house relative overflow-hidden">
      <nav className="flex flex-col sm:flex-row sm:items-end justify-between bg-house border-b border-sepia/30 relative z-30 shadow-md">
        <div className="flex items-center justify-between p-4 sm:p-0 sm:hidden border-b border-sepia/30">
          <Link href="/" className="font-serif text-xl tracking-[0.08em] text-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">
            AUTOGRAPHY
          </Link>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-sepia hover:text-oyster p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        
        <div className={`${mobileMenuOpen ? 'flex' : 'hidden'} sm:flex flex-col sm:flex-row w-full overflow-x-auto no-scrollbar`}>
          {/* Desktop Brand */}
          <Link href="/" className="hidden sm:flex items-center px-6 border-r border-sepia/30 font-serif text-lg tracking-[0.08em] text-brass hover:text-oyster transition-colors focus-visible:outline-none focus-visible:bg-sepia/20">
            AUTOGRAPHY
          </Link>

          {/* Production Nav */}
          <div className="flex flex-col sm:flex-row flex-1 sm:px-2">
            <div className="px-5 py-3 sm:hidden font-mono text-[9px] text-sepia tracking-[0.2em] bg-house border-b border-sepia/20">PRODUCTION DESK</div>
            <NavLink href="/" activePattern="/">BOARD</NavLink>
            <NavLink href="/constellation" activePattern="/constellation">CONSTELLATION</NavLink>
            <NavLink href="/podcast" activePattern="/podcast">PODCAST ROOM</NavLink>
          </div>

          {/* Trace and public proof */}
          <div className="flex flex-col sm:flex-row border-t sm:border-t-0 sm:border-l border-sepia/30 bg-house/40">
            <div className="px-5 py-3 sm:hidden font-mono text-[9px] text-sepia tracking-[0.2em] bg-house border-b border-sepia/20">TRACE &amp; PUBLIC PROOF</div>
            <NavLink href="/receipts" activePattern="/receipts">RECEIPTS</NavLink>
            <NavLink href="/verify" activePattern="/verify" isPublic>VERIFY</NavLink>
          </div>
        </div>
      </nav>

      {health && "storage" in health && health.storage === "degraded" && (
        <div
          className="flex items-start gap-3 border-b border-[#b34b36]/60 bg-[#b34b36]/15 px-4 py-3 text-[#f1c8b9] sm:px-6 animate-in slide-in-from-top-2"
          role="alert"
          data-testid="storage-degraded-warning"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#e28b72]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-system text-xs font-semibold uppercase tracking-[0.12em] text-[#f3b09b]">
              Workspace storage needs attention
            </p>
            <p className="mt-1 max-w-3xl font-sans text-sm leading-5 text-[#f1c8b9]">
              Persistence is temporarily unavailable. New workspace changes may not survive a restart.
              Your existing workspace remains available while storage recovers.
            </p>
          </div>
        </div>
      )}

      <Orientation />

      <div className="hidden md:flex items-center justify-between gap-4 px-6 py-2 border-b border-sepia/20 bg-house/80 font-system text-[10px] tracking-[0.12em] text-sepia z-20">
        <span>LIVE ENTERTAINMENT OPERATIONS</span>
        <span>SIGNAL ROOM · EVIDENCE COMPILER · RESPONSE ROOM</span>
      </div>
      
      <main className="flex-1 flex flex-col relative z-10 w-full overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}