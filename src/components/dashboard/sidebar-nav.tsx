"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from 'next/image';
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
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
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useOrganization } from '@/context/OrganizationContext';

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/regions", icon: Map, label: "Regions" },
  { href: "/dashboard/zones", icon: MapPin, label: "Zones" },
  { href: "/dashboard/areas", icon: Network, label: "Areas" },
  { href: "/dashboard/branches", icon: Building2, label: "Branches" },
  { href: "/dashboard/employees", icon: Users, label: "Employees" },
  { href: "/dashboard/groups", icon: UserRound, label: "Groups" },
  { href: "/dashboard/roles", icon: ShieldCheck, label: "Roles" },
  { href: "/dashboard/configuration", icon: Settings, label: "Configuration" },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const userAvatar = PlaceHolderImages.find(p => p.id === 'user-avatar');
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
      <SidebarFooter className="border-t border-sidebar-border p-2">
         <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={userAvatar?.imageUrl} alt="Admin User" data-ai-hint="person face" />
              <AvatarFallback>AU</AvatarFallback>
            </Avatar>
            {state === 'expanded' && (
                <div className="flex flex-col overflow-hidden">
                    <span className="truncate font-semibold text-sm">Admin User</span>
                    <span className="truncate text-xs text-muted-foreground">admin@lendeasy.com</span>
                </div>
            )}
         </div>
      </SidebarFooter>
    </>
  );
}
