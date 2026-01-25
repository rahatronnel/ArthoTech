"use client";

import { useState } from 'react';
import { zones as initialZones, regions, employees } from '@/lib/data';
import type { Zone } from '@/lib/data';
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

export default function ZonesPage() {
  const { toast } = useToast();
  const [zones, setZones] = useState(initialZones);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [zoneToDelete, setZoneToDelete] = useState<Zone | null>(null);

  const getEmployeeName = (employeeId: string) => {
    return employees.find(e => e.id === employeeId)?.name || 'N/A';
  };
  
  const handleAddNewClick = () => {
    setEditingZone(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (zone: Zone) => {
    setEditingZone(zone);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (zone: Zone) => {
    setZoneToDelete(zone);
  };

  const confirmDelete = () => {
    if (zoneToDelete) {
      setZones(zones.filter(z => z.id !== zoneToDelete.id));
      toast({ title: "Zone deleted", description: `"${zoneToDelete.name}" has been deleted.` });
      setZoneToDelete(null);
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingZone(null);
  };

  const FormDialog = () => {
    const [name, setName] = useState(editingZone?.name || '');
    const [bengaliName, setBengaliName] = useState(editingZone?.bengaliName || '');
    const [code, setCode] = useState(editingZone?.code || '');
    const [region, setRegion] = useState(editingZone?.region || '');
    const [employeeId, setEmployeeId] = useState(editingZone?.responsibleEmployeeId || '');

    const handleSubmit = () => {
       if (!name || !bengaliName || !code || !region || !employeeId) {
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Please fill out all fields.",
        });
        return;
      }

      if (editingZone) { // Update
        const updatedZone: Zone = { ...editingZone, name, bengaliName, code, region, responsibleEmployeeId: employeeId };
        setZones(zones.map(z => z.id === editingZone.id ? updatedZone : z));
        toast({ title: "Zone updated", description: `"${name}" has been updated.` });
      } else { // Create
        const newZone: Zone = {
          id: `Z${String(zones.length + 1).padStart(3, '0')}`,
          name,
          bengaliName,
          code,
          region,
          responsibleEmployeeId: employeeId,
        };
        setZones([...zones, newZone]);
        toast({ title: "Zone created", description: `"${name}" has been created.` });
      }
      handleDialogClose();
    };

    return (
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleDialogClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingZone ? 'Edit Zone' : 'Create New Zone'}</DialogTitle>
            <DialogDescription>
              {editingZone ? 'Update the details of the zone.' : 'Add a new zone and assign it to a region.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">
                Zone Name
              </Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Metro Zone" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bengaliName">
                Bengali Name
              </Label>
              <Input id="bengaliName" value={bengaliName} onChange={(e) => setBengaliName(e.target.value)} placeholder="e.g., মেট্রো জোন" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="code">
                Zone Code
              </Label>
              <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., MZ" />
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
              <Label htmlFor="employee">
                Responsible Employee
              </Label>
              <Select onValueChange={setEmployeeId} value={employeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(e => e.role === 'Zonal User').map(employee => (
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
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Zones</CardTitle>
          <CardDescription>Manage your organization's zones.</CardDescription>
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
            New Zone
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zone Name</TableHead>
              <TableHead>Bengali Name</TableHead>
              <TableHead className="hidden md:table-cell">Zone Code</TableHead>
              <TableHead className="hidden md:table-cell">Region</TableHead>
              <TableHead>Responsible Employee</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {zones.map((zone) => (
              <TableRow key={zone.id}>
                <TableCell className="font-medium">{zone.name}</TableCell>
                <TableCell>{zone.bengaliName}</TableCell>
                <TableCell className="hidden md:table-cell">{zone.code}</TableCell>
                <TableCell className="hidden md:table-cell">{zone.region}</TableCell>
                <TableCell>{getEmployeeName(zone.responsibleEmployeeId)}</TableCell>
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
                      <DropdownMenuItem onSelect={() => handleEditClick(zone)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleDeleteClick(zone)} className="text-destructive focus:bg-destructive/30 focus:text-destructive-foreground">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      {isDialogOpen && <FormDialog />}
      <AlertDialog open={!!zoneToDelete} onOpenChange={() => setZoneToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the zone
              "{zoneToDelete?.name}".
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
