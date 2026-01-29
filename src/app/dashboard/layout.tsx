
"use client";

import type { PropsWithChildren } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { Header } from '@/components/dashboard/header';
import { SidebarNav } from '@/components/dashboard/sidebar-nav';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLayout({ children }: PropsWithChildren) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If loading is finished and there's no user, redirect to login.
    if (!loading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, loading, router]);

  // While loading, always show the skeleton screen.
  if (loading) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                </div>
            </div>
        </div>
    );
  }

  // If loading is done AND we have a current user, show the dashboard.
  if (currentUser) {
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
  
  // If loading is done and there is NO user, the useEffect is handling the redirect.
  // Show a skeleton screen in the meantime to prevent a flash of an empty page.
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
            </div>
        </div>
    </div>
  );
}
