"use client";

import { useState } from 'react';
import { branches as initialBranches, regions, zones, areas } from '@/lib/data';
import type { Branch } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, MoreHorizontal, FileDown, FileUp } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function BranchesPage() {
  const { toast } = useToast();
  const [branches, setBranches] = useState(initialBranches);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  
  const handleAddNewClick = () => {
    setEditingBranch(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (branch: Branch) => {
    setEditingBranch(branch);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (branch: Branch) => {
    setBranchToDelete(branch);
  };

  const confirmDelete = () => {
    if (branchToDelete) {
      setBranches(branches.filter(b => b.id !== branchToDelete.id));
      toast({ title: "Branch deleted", description: `"${branchToDelete.name}" has been deleted.` });
      setBranchToDelete(null);
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingBranch(null);
  };

  const FormDialog = () => {
    const [name, setName] = useState(editingBranch?.name || '');
    const [bengaliName, setBengaliName] = useState(editingBranch?.bengaliName || '');
    const [code, setCode] = useState(editingBranch?.code || '');
    const [region, setRegion] = useState(editingBranch?.region || '');
    const [zone, setZone] = useState(editingBranch?.zone || '');
    const [area, setArea] = useState(editingBranch?.area || '');
    
    const handleSubmit = () => {
      if (!name || !bengaliName || !code || !region || !zone || !area ) {
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Please fill out all fields.",
        });
        return;
      }
      if (editingBranch) { // Update
        const updatedBranch: Branch = { ...editingBranch, name, bengaliName, code, region, zone, area };
        setBranches(branches.map(b => b.id === editingBranch.id ? updatedBranch : b));
        toast({ title: "Branch updated", description: `"${name}" has been updated.` });
      } else { // Create
        const newBranch: Branch = {
            id: `B${String(branches.length + 1).padStart(3, '0')}`,
            name,
            bengaliName,
            code,
            area,
            zone,
            region,
        };
        setBranches([...branches, newBranch]);
        toast({ title: "Branch created", description: `"${name}" has been created.` });
      }
      handleDialogClose();
    };

    return (
        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleDialogClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{editingBranch ? 'Edit Branch' : 'Create New Branch'}</DialogTitle>
                    <DialogDescription>
                       {editingBranch ? 'Update the details of the branch.' : 'Add a new branch to your organization.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">
                            Branch Name
                        </Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Downtown Branch" />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="bengaliName">
                            Bengali Name
                        </Label>
                        <Input id="bengaliName" value={bengaliName} onChange={(e) => setBengaliName(e.target.value)} placeholder="e.g., ডাউনটাউন শাখা" />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="code">
                            Branch Code
                        </Label>
                        <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., DB" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="region">
                            Region
                        </Label>
                        <Select onValueChange={setRegion} value={region}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a region" />
                            </SelectTrigger>
                            <SelectContent>
                                {regions.map(r => (
                                    <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="zone">
                            Zone
                        </Label>
                        <Select onValueChange={setZone} value={zone}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a zone" />
                            </SelectTrigger>
                            <SelectContent>
                                {zones.map(z => (
                                    <SelectItem key={z.id} value={z.name}>{z.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="area">
                            Area
                        </Label>
                        <Select onValueChange={setArea} value={area}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select an area" />
                            </SelectTrigger>
                            <SelectContent>
                                {areas.map(a => (
                                    <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                                ))}
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
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Branches</CardTitle>
          <CardDescription>Manage your organization's branches.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1">
                <FileDown className="h-4 w-4" />
                Download
            </Button>
            <Button size="sm" variant="outline" className="gap-1">
                <FileUp className="h-4 w-4" />
                Upload
            </Button>
            <Button size="sm" className="gap-1" onClick={handleAddNewClick}>
            <PlusCircle className="h-4 w-4" />
            New Branch
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch Name</TableHead>
              <TableHead>Bengali Name</TableHead>
              <TableHead className="hidden md:table-cell">Branch Code</TableHead>
              <TableHead>Area</TableHead>
              <TableHead className="hidden md:table-cell">Zone</TableHead>
              <TableHead className="hidden lg:table-cell">Region</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell className="font-medium">{branch.name}</TableCell>
                <TableCell>{branch.bengaliName}</TableCell>
                <TableCell className="hidden md:table-cell">{branch.code}</TableCell>
                <TableCell>{branch.area}</TableCell>
                <TableCell className="hidden md:table-cell">{branch.zone}</TableCell>
                <TableCell className="hidden lg:table-cell">{branch.region}</TableCell>
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
                      <DropdownMenuItem onSelect={() => handleEditClick(branch)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleDeleteClick(branch)} className="text-destructive focus:bg-destructive/30 focus:text-destructive-foreground">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
       {isDialogOpen && <FormDialog />}
       <AlertDialog open={!!branchToDelete} onOpenChange={() => setBranchToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the branch
              "{branchToDelete?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
