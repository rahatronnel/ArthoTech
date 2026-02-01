
"use client";

import type { PropsWithChildren } from 'react';
import { redirect } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { Header } from '@/components/dashboard/header';
import { SidebarNav } from '@/components/dashboard/sidebar-nav';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

function DashboardSkeleton() {
  return (
    <div className="flex h-screen w-full">
      <div className="hidden md:block w-64 border-r p-4">
        <Skeleton className="h-10 w-3/4 mb-6" />
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1">
        <div className="h-16 border-b flex items-center px-6">
           <Skeleton className="h-6 w-1/3" />
        </div>
        <div className="p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: PropsWithChildren) {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!currentUser) {
    return redirect('/login');
  }
  
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

    