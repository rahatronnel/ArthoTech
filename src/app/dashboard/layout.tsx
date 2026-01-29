
"use client";

import type { PropsWithChildren } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { Header } from '@/components/dashboard/header';
import { SidebarNav } from '@/components/dashboard/sidebar-nav';

export default function DashboardLayout({ children }: PropsWithChildren) {
  return (
    <SidebarProvider>
      <div className="print:hidden">
        <Sidebar>
          <SidebarNav />
        </Sidebar>
      </div>
      <SidebarInset>
        <div className="print:hidden">
          <Header />
        </div>
        <main className="p-4 sm:p-6 print:p-0">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
