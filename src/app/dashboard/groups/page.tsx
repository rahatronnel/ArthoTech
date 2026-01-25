"use client";

import { useState } from 'react';
import { groups as initialGroups, employees } from '@/lib/data';
import type { Group } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMember } from '@/context/MemberContext';
import { useSavings } from '@/context/SavingsContext';

export default function GroupsPage() {
  const { toast } = useToast();
  const [groups, setGroups] = useState(initialGroups);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const { memberChanges } = useMember();
  const { savingsTransactions } = useSavings(); 

  const weekDays = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };
  
  const calculateCurrentMembers = (groupId: string, initialMembers: number) => {
    const totalAdded = memberChanges
      .filter(c => c.groupId === groupId)
      .reduce((sum, change) => sum + change.added, 0);
    const totalDropped = memberChanges
      .filter(c => c.groupId === groupId)
      .reduce((sum, change) => sum + change.dropped, 0);
    return initialMembers + totalAdded - totalDropped;
  };

  const calculateCurrentSavings = (groupId: string, initialSavings: number) => {
    const totalDeposits = savingsTransactions
        .filter(t => t.groupId === groupId)
        .reduce((sum, t) => sum + t.deposit, 0);
    const totalWithdrawals = savingsTransactions
        .filter(t => t.groupId === groupId)
        .reduce((sum, t) => sum + t.withdraw, 0);
    return initialSavings + totalDeposits - totalWithdrawals;
  };

  const handleAddNewClick = () => {
    setEditingGroup(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (group: Group) => {
    setEditingGroup(group);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (group: Group) => {
    setGroupToDelete(group);
  };

  const confirmDelete = () => {
    if (groupToDelete) {
      setGroups(groups.filter(g => g.id !== groupToDelete.id));
      toast({ title: "Group deleted", description: `"${groupToDelete.name}" has been deleted.` });
      setGroupToDelete(null);
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingGroup(null);
  };
  
  const FormDialog = () => {
    const [name, setName] = useState(editingGroup?.name || '');
    const [code, setCode] = useState(editingGroup?.code || '');
    const [day, setDay] = useState(editingGroup?.day || '');
    const [leader, setLeader] = useState(editingGroup?.leader || '');
    const [initialMembers, setInitialMembers] = useState(editingGroup?.initialMembers || 0);
    const [initialSavings, setInitialSavings] = useState(editingGroup?.initialSavings || 0);
    const [status, setStatus] = useState<Group['status'] | ''>(editingGroup?.status || '');

    const handleSubmit = () => {
      if (!name || !code || !day || !leader || !status) {
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Please fill out all fields.",
        });
        return;
      }
      if (editingGroup) { // Update
        const updatedGroup: Group = { ...editingGroup, name, code, day, leader, status: status as Group['status'], initialMembers, initialSavings };

        setGroups(groups.map(g => (g.id === editingGroup.id ? updatedGroup : g)));
        toast({ title: "Group updated", description: `"${name}" has been updated.` });
      } else { // Create
        const newGroup: Group = {
          id: `G${String(groups.length + 1).padStart(3, '0')}`,
          name,
          code,
          day,
          leader,
          initialMembers: initialMembers,
          initialSavings: initialSavings,
          status: status as Group['status'],
          totalLoans: 0,
        };
        setGroups([...groups, newGroup]);
        toast({ title: "Group created", description: `"${name}" has been created.` });
      }
      handleDialogClose();
    };

    return (
        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleDialogClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{editingGroup ? 'Edit Group' : 'Create New Group'}</DialogTitle>
                    <DialogDescription>
                        {editingGroup ? 'Update the details of the group.' : 'Add a new group and assign a leader.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="name">
                                Group Name
                            </Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Sunrise Group" />
                        </div>
                         <div className="grid gap-2">
                            <Label htmlFor="code">
                                Group Code
                            </Label>
                            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., SG001" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                         <div className="grid gap-2">
                            <Label htmlFor="day">
                               Group Day
                            </Label>
                            <Select onValueChange={setDay} value={day}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a day" />
                                </SelectTrigger>
                                <SelectContent>
                                    {weekDays.map(d => (
                                         <SelectItem key={d} value={d}>{d}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="leader">
                               Leader
                            </Label>
                            <Select onValueChange={setLeader} value={leader}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a leader" />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees.map(e => (
                                        <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="members">
                               Initial Members
                            </Label>
                            <Input id="members" type="number" value={initialMembers} onChange={(e) => setInitialMembers(Number(e.target.value))} placeholder="e.g., 10" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="savings">
                               Initial Savings
                            </Label>
                            <Input id="savings" type="number" value={initialSavings} onChange={(e) => setInitialSavings(Number(e.target.value))} placeholder="e.g., 12000" />
                        </div>
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="status">
                            Status
                        </Label>
                        <Select onValueChange={(value) => setStatus(value as Group['status'])} value={status}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleDialogClose}>Cancel</Button>
                    <Button type="submit" onClick={handleSubmit}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Groups / Centers</CardTitle>
            <CardDescription>Manage client groups and their financial activities.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
              <Button size="sm" className="gap-1" onClick={handleAddNewClick}>
                  <PlusCircle className="h-4 w-4" />
                  New Group
              </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group Name</TableHead>
                <TableHead className="hidden md:table-cell">Group Code</TableHead>
                <TableHead>Group Day</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Leader</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Total Loans</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Total Savings</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell className="hidden md:table-cell">{group.code}</TableCell>
                  <TableCell>{group.day}</TableCell>
                  <TableCell>
                    <Badge variant={group.status === 'Active' ? 'default' : 'secondary'}>{group.status}</Badge>
                  </TableCell>
                  <TableCell>{group.leader}</TableCell>
                  <TableCell className="text-right">{calculateCurrentMembers(group.id, group.initialMembers)}</TableCell>
                  <TableCell className="hidden text-right lg:table-cell">{formatCurrency(group.totalLoans)}</TableCell>
                  <TableCell className="hidden text-right lg:table-cell">{formatCurrency(calculateCurrentSavings(group.id, group.initialSavings))}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => handleEditClick(group)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleDeleteClick(group)} className="text-destructive focus:bg-destructive/30 focus:text-destructive-foreground">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {isDialogOpen && <FormDialog />}

      <AlertDialog open={!!groupToDelete} onOpenChange={() => setGroupToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the group
              "{groupToDelete?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
