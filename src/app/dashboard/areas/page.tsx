"use client";

import { useState, useMemo } from 'react';
import type { Area, Zone, Region, Employee } from '@/lib/data';
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

// New Area type with regionId for easier data handling
type FullArea = Area & { regionId: string };

export default function AreasPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const firestore = useFirestore();

  const areasQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'areas')) : null, [firestore]);
  const { data: areas, isLoading: areasLoading } = useCollection<FullArea>(areasQuery);

  const zonesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'zones')) : null, [firestore]);
  const { data: zones, isLoading: zonesLoading } = useCollection<Zone>(zonesQuery);

  const regionsQuery = useMemoFirebase(() => collection(firestore, 'regions'), [firestore]);
  const { data: regions, isLoading: regionsLoading } = useCollection<Region>(regionsQuery);

  const employeesQuery = useMemoFirebase(() => collection(firestore, 'employees'), [firestore]);
  const { data: employees, isLoading: employeesLoading } = useCollection<Employee>(employeesQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<FullArea | null>(null);
  const [areaToDelete, setAreaToDelete] = useState<FullArea | null>(null);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);

  const getEmployeeName = (employeeId: string) => {
    const employee = employees?.find(e => e.id === employeeId);
    return employee?.name || 'N/A';
  };

  const getZoneName = (zoneId: string) => {
    return zones?.find(z => z.id === zoneId)?.name || 'N/A';
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
        "Zone Code": "",
        "Responsible Employee Login ID": ""
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Areas");
    XLSX.writeFile(workbook, "AreasTemplate.xlsx");
    toast({ title: "Template Downloaded", description: "Fill in the template and upload it." });
  };

  const handleAddNewClick = () => {
    setEditingArea(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (area: FullArea) => {
    setEditingArea(area);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (area: FullArea) => {
    setAreaToDelete(area);
  };

  const confirmDelete = async () => {
    if (areaToDelete) {
      try {
        await deleteDoc(doc(firestore, "regions", areaToDelete.regionId, "zones", areaToDelete.zoneId, "areas", areaToDelete.id));
        toast({ title: "Area deleted", description: `"${areaToDelete.name}" has been deleted.` });
      } catch (error: any) {
        toast({ variant: "destructive", title: "Error deleting area", description: error.message });
      } finally {
        setAreaToDelete(null);
      }
    }
  };

  const handleDeleteAll = async () => {
    if (!areasQuery) return;
    try {
      const areasSnapshot = await getDocs(areasQuery);
      if (areasSnapshot.empty) {
        toast({ title: "No areas to delete." });
        setIsDeleteAllOpen(false);
        return;
      }
      const batch = writeBatch(firestore);
      areasSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      toast({ title: "All areas deleted." });
    } catch (error: any) {
       toast({ variant: "destructive", title: "Error deleting areas", description: error.message });
    }
    setIsDeleteAllOpen(false);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingArea(null);
  };

  const FormDialog = () => {
    const [name, setName] = useState(editingArea?.name || '');
    const [bengaliName, setBengaliName] = useState(editingArea?.bengaliName || '');
    const [code, setCode] = useState(editingArea?.code || '');
    const [regionId, setRegionId] = useState(editingArea?.regionId || '');
    const [zoneId, setZoneId] = useState(editingArea?.zoneId || '');
    const [employeeId, setEmployeeId] = useState(editingArea?.responsibleEmployeeId || '');
    
    const filteredZones = useMemo(() => {
        if (!regionId || !zones) return [];
        return zones.filter(z => z.regionId === regionId);
    }, [regionId, zones]);

    const handleSubmit = async () => {
      if (!name || !bengaliName || !code || !regionId || !zoneId || !employeeId) {
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Please fill out all fields.",
        });
        return;
      }

      try {
        if (editingArea) { // Update
          const areaDocRef = doc(firestore, 'regions', editingArea.regionId, 'zones', editingArea.zoneId, 'areas', editingArea.id);
          const updatedData: Partial<FullArea> = { name, bengaliName, code, responsibleEmployeeId: employeeId, zoneId, regionId };
          await setDoc(areaDocRef, updatedData, { merge: true });
          toast({ title: "Area updated", description: `"${name}" has been updated.` });
        } else { // Create
          const newDocRef = doc(collection(firestore, 'regions', regionId, 'zones', zoneId, 'areas'));
          const newArea: Area & { regionId: string } = {
            id: newDocRef.id,
            name,
            bengaliName,
            code,
            zoneId,
            regionId,
            responsibleEmployeeId: employeeId,
          };
          await setDoc(newDocRef, newArea);
          toast({ title: "Area created", description: `"${name}" has been created.` });
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
                    <DialogTitle>{editingArea ? 'Edit Area' : 'Create New Area'}</DialogTitle>
                    <DialogDescription>
                        {editingArea ? 'Update the details of the area.' : 'Add a new area and assign it to a zone and region.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">
                            Area Name
                        </Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Central Area" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="bengaliName">
                           Bengali Name
                        </Label>
                        <Input id="bengaliName" value={bengaliName} onChange={(e) => setBengaliName(e.target.value)} placeholder="e.g., কেন্দ্রীয় এলাকা" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="code">
                           Area Code
                        </Label>
                        <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., CA" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="region">
                            Region
                        </Label>
                        <Select onValueChange={(value) => { setRegionId(value); setZoneId(''); }} value={regionId} disabled={!!editingArea}>
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
                        <Label htmlFor="zone">
                            Zone
                        </Label>
                        <Select onValueChange={setZoneId} value={zoneId} disabled={!regionId || !!editingArea}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a zone" />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredZones.map(z => (
                                    <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
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
                                {employees?.filter(e => e.role === 'Area User').map(employee => (
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

  const isLoading = areasLoading || zonesLoading || regionsLoading || employeesLoading;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Areas</CardTitle>
          <CardDescription>Manage your organization's areas.</CardDescription>
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
            New Area
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        { isLoading ? <p>Loading...</p> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Area Name</TableHead>
              <TableHead>Bengali Name</TableHead>
              <TableHead className="hidden md:table-cell">Area Code</TableHead>
              <TableHead className="hidden md:table-cell">Zone</TableHead>
              <TableHead className="hidden lg:table-cell">Region</TableHead>
              <TableHead>Responsible Employee</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {areas?.map((area) => (
              <TableRow key={area.id}>
                <TableCell className="font-medium">{area.name}</TableCell>
                <TableCell>{area.bengaliName}</TableCell>
                <TableCell className="hidden md:table-cell">{area.code}</TableCell>
                <TableCell className="hidden md:table-cell">{getZoneName(area.zoneId)}</TableCell>
                <TableCell className="hidden lg:table-cell">{getRegionName(area.regionId)}</TableCell>
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
        )}
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
      <AlertDialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete ALL areas.
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
