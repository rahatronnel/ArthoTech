"use client";

import { useState } from 'react';
import { groups as initialGroups, employees } from '@/lib/data';
import type { Group, MemberChangeEvent } from '@/lib/data';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

export default function GroupsPage() {
  const { toast } = useToast();
  const [groups, setGroups] = useState(initialGroups);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [memberManagementGroup, setMemberManagementGroup] = useState<Group | null>(null);
  const weekDays = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };
  
  const calculateCurrentMembers = (history: MemberChangeEvent[]) => {
    return history.reduce((total, change) => total + change.added - change.dropped, 0);
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
    const [initialMembers, setInitialMembers] = useState(0);
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
        const updatedGroup: Partial<Group> = { ...editingGroup, name, code, day, leader, status: status as Group['status'] };
        delete updatedGroup.memberHistory; // Member history is managed separately

        setGroups(groups.map(g => (g.id === editingGroup.id ? {...g, ...updatedGroup} : g)));
        toast({ title: "Group updated", description: `"${name}" has been updated.` });
      } else { // Create
        const newGroup: Group = {
          id: `G${String(groups.length + 1).padStart(3, '0')}`,
          name,
          code,
          day,
          leader,
          memberHistory: [{ date: new Date().toISOString().split('T')[0], added: initialMembers, dropped: 0, notes: 'Initial members' }],
          status: status as Group['status'],
          totalLoans: 0,
          totalSavings: 0,
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
                    <div className="grid gap-2">
                        <Label htmlFor="members">
                           Initial Members
                        </Label>
                        <Input id="members" type="number" value={initialMembers} onChange={(e) => setInitialMembers(Number(e.target.value))} placeholder="e.g., 10" disabled={!!editingGroup} />
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

  const ManageMembersDialog = () => {
    if (!memberManagementGroup) return null;

    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [added, setAdded] = useState(0);
    const [dropped, setDropped] = useState(0);
    const [notes, setNotes] = useState('');

    const handleAddChange = () => {
        if (added === 0 && dropped === 0) {
             toast({
                variant: "destructive",
                title: "No Change",
                description: "Please enter a value for added or dropped members.",
            });
            return;
        }

        const newChange: MemberChangeEvent = { date, added, dropped, notes };

        const updatedGroup = {
            ...memberManagementGroup,
            memberHistory: [...memberManagementGroup.memberHistory, newChange],
        };

        setGroups(groups.map(g => g.id === updatedGroup.id ? updatedGroup : g));
        toast({ title: "Member history updated", description: `Changes for "${memberManagementGroup.name}" have been saved.` });
        
        const newMemberManagementGroup = { ...memberManagementGroup, memberHistory: [...memberManagementGroup.memberHistory, newChange] };
        setMemberManagementGroup(newMemberManagementGroup);
        
        // Reset form
        setAdded(0);
        setDropped(0);
        setNotes('');
    };
    
    const currentMembers = calculateCurrentMembers(memberManagementGroup.memberHistory);

    return (
        <Dialog open={!!memberManagementGroup} onOpenChange={(open) => !open && setMemberManagementGroup(null)}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Manage Members for {memberManagementGroup.name}</DialogTitle>
                    <DialogDescription>
                        Current Members: {currentMembers}. View history and record new member additions or dropouts.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h3 className="font-semibold mb-2">New Change</h3>
                        <div className="grid gap-4 py-4">
                             <div className="grid gap-2">
                                <Label htmlFor="change-date">Date</Label>
                                <Input id="change-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
                             </div>
                             <div className="grid gap-2">
                                <Label htmlFor="added-members">Members Added</Label>
                                <Input id="added-members" type="number" min="0" value={added} onChange={e => setAdded(Number(e.target.value))} />
                             </div>
                             <div className="grid gap-2">
                                <Label htmlFor="dropped-members">Members Dropped</Label>
                                <Input id="dropped-members" type="number" min="0" value={dropped} onChange={e => setDropped(Number(e.target.value))} />
                             </div>
                             <div className="grid gap-2">
                                <Label htmlFor="notes">Notes</Label>
                                <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..."/>
                             </div>
                             <Button onClick={handleAddChange}>Add Change</Button>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold mb-2">Change History</h3>
                        <ScrollArea className="h-72">
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Added</TableHead>
                                        <TableHead>Dropped</TableHead>
                                        <TableHead>Notes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {memberManagementGroup.memberHistory.slice().reverse().map((change, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{new Date(change.date).toLocaleDateString()}</TableCell>
                                            <TableCell>{change.added}</TableCell>
                                            <TableCell>{change.dropped}</TableCell>
                                            <TableCell>{change.notes}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setMemberManagementGroup(null)}>Close</Button>
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
                  <TableCell className="text-right">{calculateCurrentMembers(group.memberHistory)}</TableCell>
                  <TableCell className="hidden text-right lg:table-cell">{formatCurrency(group.totalLoans)}</TableCell>
                  <TableCell className="hidden text-right lg:table-cell">{formatCurrency(group.totalSavings)}</TableCell>
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
                        <DropdownMenuItem onSelect={() => setMemberManagementGroup(group)}>Manage Members</DropdownMenuItem>
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
      {memberManagementGroup && <ManageMembersDialog />}

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
