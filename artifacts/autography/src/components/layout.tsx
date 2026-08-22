import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useGetActiveCall } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: activeCall } = useGetActiveCall({
    query: {
      queryKey: ["/api/call/active"],
      refetchInterval: 1000,
    },
  });

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
      {/* Physical screen bezel / CRT rounding effect maybe? Keep it subtle */}
      <nav className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-6 border-b border-sepia/30">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/" className="hidden lg:block font-serif text-lg tracking-[0.08em] text-brass mr-2">
            AUTOGRAPHY
          </Link>
          <Link href="/" className="font-system tracking-[0.1em] text-oyster hover:text-white transition-colors">
            BOARD
          </Link>
          <Link href="/constellation" className="font-system tracking-[0.1em] text-sepia hover:text-oyster transition-colors">
            CONSTELLATION
          </Link>
          <Link href="/receipts" className="font-system tracking-[0.1em] text-sepia hover:text-oyster transition-colors">
            RECEIPTS
          </Link>
        </div>
        <div className="ml-auto">
          <Link href="/verify" className="font-system tracking-[0.1em] text-brass hover:text-white transition-colors">
            VERIFY
          </Link>
        </div>
      </nav>
      <div className="hidden md:flex items-center justify-between gap-4 px-6 py-2 border-b border-sepia/20 font-system text-[10px] tracking-[0.12em] text-sepia">
        <span>LIVE ENTERTAINMENT OPERATIONS</span>
        <span>SIGNAL ROOM · EVIDENCE COMPILER · RESPONSE ROOM</span>
      </div>
      <main className="flex-1 flex flex-col relative z-10">
        {children}
      </main>
    </div>
  );
}
