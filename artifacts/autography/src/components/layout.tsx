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
      <nav className="flex items-center justify-between p-6 border-b border-sepia/30">
        <div className="flex items-center gap-6">
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
        <div>
          <Link href="/verify" className="font-system tracking-[0.1em] text-brass hover:text-white transition-colors">
            VERIFY
          </Link>
        </div>
      </nav>
      <main className="flex-1 flex flex-col relative z-10">
        {children}
      </main>
    </div>
  );
}
