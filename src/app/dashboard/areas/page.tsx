"use client";

import { useState } from 'react';
import { areas as initialAreas, zones, regions, employees } from '@/lib/data';
import type { Area } from '@/lib/data';
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

export default function AreasPage() {
  const { toast } = useToast();
  const [areas, setAreas] = useState(initialAreas);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [areaToDelete, setAreaToDelete] = useState<Area | null>(null);

  const getEmployeeName = (employeeId: string) => {
    return employees.find(e => e.id === employeeId)?.name || 'N/A';
  };
  
  const handleAddNewClick = () => {
    setEditingArea(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (area: Area) => {
    setEditingArea(area);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (area: Area) => {
    setAreaToDelete(area);
  };

  const confirmDelete = () => {
    if (areaToDelete) {
      setAreas(areas.filter(a => a.id !== areaToDelete.id));
      toast({ title: "Area deleted", description: `"${areaToDelete.name}" has been deleted.` });
      setAreaToDelete(null);
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingArea(null);
  };

  const FormDialog = () => {
    const [name, setName] = useState(editingArea?.name || '');
    const [bengaliName, setBengaliName] = useState(editingArea?.bengaliName || '');
    const [code, setCode] = useState(editingArea?.code || '');
    const [region, setRegion] = useState(editingArea?.region || '');
    const [zone, setZone] = useState(editingArea?.zone || '');
    const [employeeId, setEmployeeId] = useState(editingArea?.responsibleEmployeeId || '');

    const handleSubmit = () => {
      if (!name || !bengaliName || !code || !region || !zone || !employeeId) {
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Please fill out all fields.",
        });
        return;
      }
      if (editingArea) { // Update
        const updatedArea: Area = { ...editingArea, name, bengaliName, code, region, zone, responsibleEmployeeId: employeeId };
        setAreas(areas.map(a => (a.id === editingArea.id ? updatedArea : a)));
        toast({ title: "Area updated", description: `"${name}" has been updated.` });
      } else { // Create
        const newArea: Area = {
          id: `A${String(areas.length + 1).padStart(3, '0')}`,
          name,
          bengaliName,
          code,
          zone,
          region,
          responsibleEmployeeId: employeeId,
        };
        setAreas([...areas, newArea]);
        toast({ title: "Area created", description: `"${name}" has been created.` });
      }
      handleDialogClose();
    };

    return (
        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleDialogClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{editingArea ? 'Edit Area' : 'Create New Area'}</DialogTitle>
                    <DialogDescription>
                        {editingArea ? 'Update the details of the area.' : 'Add a new area and assign it to a zone and region.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Area Name
                        </Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Central Area" className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="bengaliName" className="text-right">
                           Bengali Name
                        </Label>
                        <Input id="bengaliName" value={bengaliName} onChange={(e) => setBengaliName(e.target.value)} placeholder="e.g., কেন্দ্রীয় এলাকা" className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="code" className="text-right">
                           Area Code
                        </Label>
                        <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., CA" className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="region" className="text-right">
                            Region
                        </Label>
                        <Select onValueChange={setRegion} value={region}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select a region" />
                            </SelectTrigger>
                            <SelectContent>
                                {regions.map(r => (
                                    <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="zone" className="text-right">
                            Zone
                        </Label>
                        <Select onValueChange={setZone} value={zone}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select a zone" />
                            </SelectTrigger>
                            <SelectContent>
                                {zones.map(z => (
                                    <SelectItem key={z.id} value={z.name}>{z.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                                {employees.filter(e => e.role === 'Area User').map(employee => (
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
          <CardTitle>Areas</CardTitle>
          <CardDescription>Manage your organization's areas.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1" onClick={handleAddNewClick}>
            <PlusCircle className="h-4 w-4" />
            New Area
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Area Name</TableHead>
              <TableHead>Bengali Name</TableHead>
              <TableHead>Area Code</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Responsible Employee</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {areas.map((area) => (
              <TableRow key={area.id}>
                <TableCell className="font-medium">{area.name}</TableCell>
                <TableCell>{area.bengaliName}</TableCell>
                <TableCell>{area.code}</TableCell>
                <TableCell>{area.zone}</TableCell>
                <TableCell>{area.region}</TableCell>
                <TableCell>{getEmployeeName(area.responsibleEmployeeId)}</TableCell>
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
                      <DropdownMenuItem onSelect={() => handleEditClick(area)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleDeleteClick(area)} className="text-destructive focus:bg-destructive/30 focus:text-destructive-foreground">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      {isDialogOpen && <FormDialog />}
      <AlertDialog open={!!areaToDelete} onOpenChange={() => setAreaToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the area
              "{areaToDelete?.name}".
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
