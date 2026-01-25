"use client";

import { useState } from 'react';
import { regions as initialRegions, employees } from '@/lib/data';
import type { Region } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function RegionsPage() {
  const { toast } = useToast();
  const [regions, setRegions] = useState(initialRegions);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [regionToDelete, setRegionToDelete] = useState<Region | null>(null);

  const getEmployeeName = (employeeId: string) => {
    return employees.find(e => e.id === employeeId)?.name || 'N/A';
  };

  const handleAddNewClick = () => {
    setEditingRegion(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (region: Region) => {
    setEditingRegion(region);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (region: Region) => {
    setRegionToDelete(region);
  };
  
  const confirmDelete = () => {
    if (regionToDelete) {
      setRegions(regions.filter(r => r.id !== regionToDelete.id));
      toast({ title: "Region deleted", description: `"${regionToDelete.name}" has been deleted.` });
      setRegionToDelete(null);
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingRegion(null);
  };

  const FormDialog = () => {
    const [name, setName] = useState(editingRegion?.name || '');
    const [employeeId, setEmployeeId] = useState(editingRegion?.responsibleEmployeeId || '');
  
    const handleSubmit = () => {
      if (!name || !employeeId) {
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Please fill out all fields.",
        });
        return;
      }

      if (editingRegion) { // Update
        const updatedRegion = { ...editingRegion, name, responsibleEmployeeId: employeeId };
        setRegions(regions.map(r => (r.id === editingRegion.id ? updatedRegion : r)));
        toast({ title: "Region updated", description: `"${name}" has been updated.` });
      } else { // Create
        const newRegion = {
            id: `R${String(regions.length + 1).padStart(3, '0')}`,
            name,
            responsibleEmployeeId: employeeId,
        };
        setRegions([...regions, newRegion]);
        toast({ title: "Region created", description: `"${name}" has been added.` });
      }
      handleDialogClose();
    };
  
    return (
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleDialogClose()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingRegion ? 'Edit Region' : 'Create New Region'}</DialogTitle>
            <DialogDescription>
              {editingRegion ? 'Update the details of the region.' : 'Add a new region and assign a responsible employee.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Region Name
              </Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Capital Region" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="employee" className="text-right">
                Responsible Employee
              </Label>
              <Select onValueChange={setEmployeeId} value={employeeId}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(e => e.role === 'Regional User').map(employee => (
                    <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
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
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Regions</CardTitle>
          <CardDescription>Manage your organization's regions.</CardDescription>
        </div>
        <Button size="sm" className="gap-1" onClick={handleAddNewClick}>
            <PlusCircle className="h-4 w-4" />
            New Region
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Region Name</TableHead>
              <TableHead>Responsible Employee</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {regions.map((region) => (
              <TableRow key={region.id}>
                <TableCell className="font-medium">{region.name}</TableCell>
                <TableCell>{getEmployeeName(region.responsibleEmployeeId)}</TableCell>
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
                      <DropdownMenuItem onSelect={() => handleEditClick(region)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleDeleteClick(region)} className="text-destructive focus:bg-destructive/30 focus:text-destructive-foreground">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      {isDialogOpen && <FormDialog />}
      <AlertDialog open={!!regionToDelete} onOpenChange={() => setRegionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the region
              "{regionToDelete?.name}".
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
