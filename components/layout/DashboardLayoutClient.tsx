"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageTransition from "@/components/layout/PageTransition";
import DriverAlertsProvider from "@/components/DriverAlertsProvider";

export default function DashboardLayoutClient({
  children,
  username,
  role,
}: {
  children: React.ReactNode;
  username: string;
  role: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <DriverAlertsProvider role={role}>
      <div className="flex h-screen bg-[#f4f6f8] dashboard-bg overflow-hidden">
        <Sidebar role={role} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Navbar username={username} role={role} onMenuClick={() => setMobileOpen(true)} />
          <main className="flex-1 p-4 md:p-6 overflow-y-auto">
            <div className="max-w-[1440px] mx-auto w-full">
              <PageTransition>{children}</PageTransition>
            </div>
          </main>
        </div>
      </div>
    </DriverAlertsProvider>
  );
}
