"use client";

import { usePathname } from "next/navigation";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Keying by pathname remounts this div on every navigation, which naturally
  // restarts the CSS animation — no transition-state machine needed.
  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  );
}
