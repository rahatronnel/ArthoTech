"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from 'next/image';
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarContent,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Building2,
  Users,
  UserRound,
  ShieldCheck,
  PiggyBank,
  Settings,
  Map,
  MapPin,
  Network,
  Newspaper,
  Archive,
  Wallet,
  Landmark,
  HandCoins,
  Database,
} from "lucide-react";
import { useOrganization } from '@/context/OrganizationContext';

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/reports", icon: Newspaper, label: "Reports" },
  { href: "/dashboard/regions", icon: Map, label: "Regions" },
  { href: "/dashboard/zones", icon: MapPin, label: "Zones" },
  { href: "/dashboard/areas", icon: Network, label: "Areas" },
  { href: "/dashboard/branches", icon: Building2, label: "Branches" },
  { href: "/dashboard/employees", icon: Users, label: "Employees" },
  { href: "/dashboard/groups", icon: UserRound, label: "Groups" },
  { href: "/dashboard/members", icon: Users, label: "Members" },
  { href: "/dashboard/savings-balance", icon: Wallet, label: "Savings Balance" },
  { href: "/dashboard/loan-disbursement", icon: Landmark, label: "Loan Disbursement" },
  { href: "/dashboard/loan-collection", icon: HandCoins, label: "Loan Collection" },
  { href: "/dashboard/upload-bulk-data", icon: Archive, label: "Others Data" },
  { href: "/dashboard/raw-data-entry", icon: Database, label: "Raw Data Entry" },
  { href: "/dashboard/roles", icon: ShieldCheck, label: "Roles" },
  { href: "/dashboard/configuration", icon: Settings, label: "Configuration" },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const { orgInfo } = useOrganization();

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex h-14 items-center gap-3 p-2">
          {orgInfo.logo ? (
            <Image src={orgInfo.logo} alt={orgInfo.name} width={32} height={32} className="size-8 flex-shrink-0 object-contain" />
          ) : (
             <PiggyBank className="size-8 flex-shrink-0 text-primary" />
          )}

          {state === 'expanded' && (
            <div className="flex flex-col overflow-hidden">
              <h1 className="text-lg font-semibold truncate">{orgInfo.name}</h1>
              <span className="text-xs text-muted-foreground truncate">{orgInfo.bengaliName}</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(item.href) && (item.href === '/dashboard' ? pathname === item.href : true)}
                tooltip={item.label}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </>
  );
}
