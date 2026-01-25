"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useToast } from "@/hooks/use-toast";

function getTitleFromPath(path: string): string {
  if (path === '/dashboard') return 'Dashboard';

  const segments = path.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] || '';
  
  if (!lastSegment) return 'Dashboard';

  const title = lastSegment
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
    
  return title;
}

function ChangePasswordDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
    const { updatePassword } = useAuth();
    const { toast } = useToast();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        setError('');
        if (newPassword !== confirmPassword) {
            setError("New passwords do not match.");
            return;
        }
        if (newPassword.length < 6) {
            setError("Password must be at least 6 characters long.");
            return;
        }

        try {
            await updatePassword(currentPassword, newPassword);
            toast({
                title: "Password Changed",
                description: "Your password has been updated successfully.",
            });
            onOpenChange(false);
        } catch (err: any) {
            setError(err.message);
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Change Password</DialogTitle>
                    <DialogDescription>Update your login password.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="current-password">Current Password</Label>
                        <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="new-password">New Password</Label>
                        <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="confirm-password">Confirm New Password</Label>
                        <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function UserNav() {
  const { currentUser, logout } = useAuth();
  const userAvatar = PlaceHolderImages.find(p => p.id === 'user-avatar');
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  const handleLogout = () => {
    logout();
  };

  if (!currentUser) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={userAvatar?.imageUrl} alt={currentUser.name} />
              <AvatarFallback>{currentUser.name?.[0].toUpperCase()}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{currentUser.name}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {currentUser.loginId}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
             <DropdownMenuItem onSelect={() => setIsPasswordDialogOpen(true)}>
              Change Password
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleLogout}>
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangePasswordDialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen} />
    </>
  )
}

export function Header() {
  const pathname = usePathname();
  const title = getTitleFromPath(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="md:hidden" />
        <h1 className="text-lg font-semibold md:text-xl">{title}</h1>
      </div>
       <div className="ml-auto flex items-center gap-4">
          <UserNav />
      </div>
    </header>
  );
}
