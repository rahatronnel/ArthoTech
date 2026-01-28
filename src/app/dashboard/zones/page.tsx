"use client";

import { useState } from 'react';
import type { Zone, Region, Employee } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, MoreHorizontal, FileDown, FileUp, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/AuthContext';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, writeBatch, getDocs, collectionGroup, query } from 'firebase/firestore';
import * as XLSX from 'xlsx';

export default function ZonesPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const firestore = useFirestore();

  const zonesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'zones')) : null, [firestore]);
  const { data: zones, isLoading: zonesLoading } = useCollection<Zone>(zonesQuery);

  const regionsQuery = useMemoFirebase(() => collection(firestore, 'regions'), [firestore]);
  const { data: regions, isLoading: regionsLoading } = useCollection<Region>(regionsQuery);

  const employeesQuery = useMemoFirebase(() => collection(firestore, 'employees'), [firestore]);
  const { data: employees, isLoading: employeesLoading } = useCollection<Employee>(employeesQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [zoneToDelete, setZoneToDelete] = useState<Zone | null>(null);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);

  const getEmployeeName = (employeeId: string) => {
    return employees?.find(e => e.id === employeeId)?.name || 'N/A';
  };
  
  const getRegionName = (regionId: string) => {
    return regions?.find(r => r.id === regionId)?.name || 'N/A';
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Name": "",
        "Bengali Name": "",
        "Code": "",
        "Region Code": "",
        "Responsible Employee Login ID": ""
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Zones");
    XLSX.writeFile(workbook, "ZonesTemplate.xlsx");
    toast({ title: "Template Downloaded", description: "Fill in the template and upload it." });
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

  const confirmDelete = async () => {
    if (zoneToDelete) {
       try {
        await deleteDoc(doc(firestore, "regions", zoneToDelete.regionId, "zones", zoneToDelete.id));
        toast({ title: "Zone deleted", description: `"${zoneToDelete.name}" has been deleted.` });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error deleting zone', description: error.message });
      } finally {
        setZoneToDelete(null);
      }
    }
  };
  
  const handleDeleteAll = async () => {
    if (!zonesQuery) return;
    try {
      const zonesSnapshot = await getDocs(zonesQuery);
      if (zonesSnapshot.empty) {
        toast({ title: "No zones to delete." });
        setIsDeleteAllOpen(false);
        return;
      }
      const batch = writeBatch(firestore);
      zonesSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      toast({ title: 'All zones have been deleted.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error deleting all zones', description: error.message });
    }
    setIsDeleteAllOpen(false);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingZone(null);
  };

  const FormDialog = () => {
    const [name, setName] = useState(editingZone?.name || '');
    const [bengaliName, setBengaliName] = useState(editingZone?.bengaliName || '');
    const [code, setCode] = useState(editingZone?.code || '');
    const [regionId, setRegionId] = useState(editingZone?.regionId || '');
    const [employeeId, setEmployeeId] = useState(editingZone?.responsibleEmployeeId || '');

    const handleSubmit = async () => {
       if (!name || !bengaliName || !code || !regionId || !employeeId) {
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Please fill out all fields.",
        });
        return;
      }

      try {
        if (editingZone) { // Update
          const zoneDocRef = doc(firestore, 'regions', editingZone.regionId, 'zones', editingZone.id);
          const updatedData: Partial<Zone> = { name, bengaliName, code, responsibleEmployeeId: employeeId, regionId };
          await setDoc(zoneDocRef, updatedData, { merge: true });
          toast({ title: "Zone updated", description: `"${name}" has been updated.` });
        } else { // Create
          const newDocRef = doc(collection(firestore, 'regions', regionId, 'zones'));
          const newZone: Zone = {
            id: newDocRef.id,
            name,
            bengaliName,
            code,
            regionId,
            responsibleEmployeeId: employeeId,
          };
          await setDoc(newDocRef, newZone);
          toast({ title: "Zone created", description: `"${name}" has been created.` });
        }
        handleDialogClose();
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Save failed', description: error.message });
      }
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
              <Select onValueChange={setRegionId} value={regionId} disabled={!!editingZone}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a region" />
                </SelectTrigger>
                <SelectContent>
                  {regions?.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
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
                  {employees?.filter(e => e.role === 'Zonal User').map(employee => (
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
  
  const isLoading = zonesLoading || regionsLoading || employeesLoading;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Zones</CardTitle>
          <CardDescription>Manage your organization's zones.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={handleDownloadTemplate}>
                <FileDown className="h-4 w-4" />
                Download
            </Button>
            <Button size="sm" variant="outline" className="gap-1">
                <FileUp className="h-4 w-4" />
                Upload
            </Button>
             {currentUser?.role === 'Super Admin' && (
              <Button size="sm" variant="destructive" className="gap-1" onClick={() => setIsDeleteAllOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Delete All
              </Button>
            )}
            <Button size="sm" className="gap-1" onClick={handleAddNewClick}>
            <PlusCircle className="h-4 w-4" />
            New Zone
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <p>Loading...</p> : (
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
            {zones?.map((zone) => (
              <TableRow key={zone.id}>
                <TableCell className="font-medium">{zone.name}</TableCell>
                <TableCell>{zone.bengaliName}</TableCell>
                <TableCell className="hidden md:table-cell">{zone.code}</TableCell>
                <TableCell className="hidden md:table-cell">{getRegionName(zone.regionId)}</TableCell>
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
        )}
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
       <AlertDialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete ALL zones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive hover:bg-destructive/90">Delete All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
