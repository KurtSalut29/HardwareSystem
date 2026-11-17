"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import PageTransition from "@/components/layout/PageTransition";
import DriverAlertsProvider from "@/components/DriverAlertsProvider";
import NotificationsProvider from "@/components/NotificationsProvider";
import ReorderReminder from "@/components/inventory/ReorderReminder";

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
      <NotificationsProvider role={role} username={username}>
        <ReorderReminder role={role} username={username} />
        <div className="flex h-dvh overflow-hidden bg-canvas">
          <Sidebar role={role} username={username} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onOpen={() => setMobileOpen(true)} />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <Navbar username={username} role={role} onMenuClick={() => setMobileOpen(true)} />
            <main className="flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 md:px-6 md:pt-5 lg:pb-6">
              <div className="w-full">
                <PageTransition>{children}</PageTransition>
              </div>
            </main>
          </div>
        </div>
      </NotificationsProvider>
    </DriverAlertsProvider>
  );
}
