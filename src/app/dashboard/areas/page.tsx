
"use client";

import { useState, useMemo, useRef } from 'react';
import type { Area, Zone, Region, Employee } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit, FileDown, FileUp, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, writeBatch, getDocs, collectionGroup, query, deleteField } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AreasPage() {
  const { toast } = useToast();
  const firestore = useFirestore();

  const areasQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'areas')) : null, [firestore]);
  const { data: areas, isLoading: areasLoading } = useCollection<Area>(areasQuery);

  const zonesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'zones')) : null, [firestore]);
  const { data: zones, isLoading: zonesLoading } = useCollection<Zone>(zonesQuery);

  const regionsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'regions') : null, [firestore]);
  const { data: regions, isLoading: regionsLoading } = useCollection<Region>(regionsQuery);

  const employeesQuery = useMemoFirebase(() => collection(firestore, 'employees'), [firestore]);
  const { data: employees, isLoading: employeesLoading } = useCollection<Employee>(employeesQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [areaToDelete, setAreaToDelete] = useState<Area | null>(null);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadedAreas, setUploadedAreas] = useState<any[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  const getEmployeeName = (employeeId?: string) => {
    if (!employeeId) return 'N/A';
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
        "Responsible Employee Code": ""
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Areas");
    XLSX.writeFile(workbook, "AreasTemplate.xlsx");
    toast({ title: "Template Downloaded", description: "Fill in the template and upload it." });
  };
  
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processUpload(file);
      event.target.value = '';
    }
  };

  const processUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        const errors: string[] = [];
        const validAreas: any[] = [];
        const employeeMap = new Map(employees?.filter(e => e.role === 'Area User').map(e => [String(e.code).trim().toLowerCase(), e.id]));
        const zoneMap = new Map(zones?.map(z => [String(z.code).trim().toLowerCase(), { id: z.id, regionId: z.regionId }]));

        jsonData.forEach((row, index) => {
          const { 'Name': name, 'Bengali Name': bengaliName, 'Code': code, 'Zone Code': zoneCode, 'Responsible Employee Code': employeeCode } = row;
          if (!name || !code || !zoneCode) {
            errors.push(`Row ${index + 2}: Missing required fields (Name, Code, Zone Code).`);
            return;
          }
          const normalizedZoneCode = String(zoneCode).trim().toLowerCase();
          if (!zoneMap.has(normalizedZoneCode)) {
            errors.push(`Row ${index + 2}: Zone with code "${zoneCode}" not found.`);
            return;
          }
          const { id: zoneId, regionId } = zoneMap.get(normalizedZoneCode)!;

          let responsibleEmployeeId: string | undefined = undefined;
          if (employeeCode) {
            const normalizedEmployeeCode = String(employeeCode).trim().toLowerCase();
            if(employeeMap.has(normalizedEmployeeCode)) {
                responsibleEmployeeId = employeeMap.get(normalizedEmployeeCode);
            } else {
                errors.push(`Row ${index + 2}: Employee with code "${employeeCode}" not found or they do not have the 'Area User' role.`);
                return;
            }
          }
          validAreas.push({ name, bengaliName: bengaliName || '', code, zoneId, regionId, responsibleEmployeeId });
        });

        setUploadedAreas(validAreas);
        setUploadErrors(errors);
        setIsUploadDialogOpen(true);

      } catch (error) {
        toast({ variant: 'destructive', title: 'Error processing file', description: 'Please make sure it is a valid .xlsx file.' });
      }
    };
    reader.readAsArrayBuffer(file);
  };
  
  const handleConfirmUpload = async () => {
    if (uploadedAreas.length === 0) {
        toast({ variant: 'destructive', title: 'No valid data to upload.' });
        return;
    }
    const batch = writeBatch(firestore);
    uploadedAreas.forEach(areaData => {
      const newDocRef = doc(collection(firestore, 'regions', areaData.regionId, 'zones', areaData.zoneId, 'areas'));
      const newArea: Omit<Area, 'id'> = {
        name: areaData.name,
        bengaliName: areaData.bengaliName,
        code: areaData.code,
        zoneId: areaData.zoneId,
        regionId: areaData.regionId,
        responsibleEmployeeId: areaData.responsibleEmployeeId,
      };
      batch.set(newDocRef, { ...newArea, id: newDocRef.id });
    });

    try {
        await batch.commit();
        toast({ title: `${uploadedAreas.length} areas uploaded successfully.` });
        setIsUploadDialogOpen(false);
        setUploadedAreas([]);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
    }
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
    const [employeeId, setEmployeeId] = useState(editingArea?.responsibleEmployeeId || 'none');
    
    const filteredZones = useMemo(() => {
        if (!regionId || !zones) return [];
        return zones.filter(z => z.regionId === regionId);
    }, [regionId, zones]);

    const handleSubmit = async () => {
      if (!name || !code || !regionId || !zoneId) {
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Please fill out Name, Code, Region and Zone.",
        });
        return;
      }

      const finalEmployeeId = employeeId === 'none' ? undefined : employeeId;

      try {
        if (editingArea) { // Update
          const areaDocRef = doc(firestore, 'regions', editingArea.regionId, 'zones', editingArea.zoneId, 'areas', editingArea.id);
          const updatedData: {[key:string]: any} = { name, bengaliName, code, zoneId, regionId };
          if(finalEmployeeId) {
            updatedData.responsibleEmployeeId = finalEmployeeId;
          } else {
            updatedData.responsibleEmployeeId = deleteField();
          }
          await setDoc(areaDocRef, updatedData, { merge: true });
          toast({ title: "Area updated", description: `"${name}" has been updated.` });
        } else { // Create
          const newDocRef = doc(collection(firestore, 'regions', regionId, 'zones', zoneId, 'areas'));
          const newAreaData: {[key:string]: any} = {
            id: newDocRef.id,
            name,
            bengaliName,
            code,
            zoneId,
            regionId,
          };
          if(finalEmployeeId) {
            newAreaData.responsibleEmployeeId = finalEmployeeId;
          }
          await setDoc(newDocRef, newAreaData);
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
                            Responsible Employee (optional)
                        </Label>
                        <Select onValueChange={setEmployeeId} value={employeeId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select an employee" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
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
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
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
            <Button size="sm" variant="outline" className="gap-1" onClick={handleUploadClick}>
                <FileUp className="h-4 w-4" />
                Upload
            </Button>
             
              <Button size="sm" variant="destructive" className="gap-1" onClick={() => setIsDeleteAllOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Delete All
              </Button>
            
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
                    <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(area)}>
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(area)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                        </Button>
                    </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )}
      </CardContent>
      {isDialogOpen && <FormDialog />}
       <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-4xl">
            <DialogHeader>
                <DialogTitle>Confirm Upload</DialogTitle>
                <DialogDescription>
                    Review the data below. {uploadErrors.length > 0 ? 'Please fix the errors and re-upload.' : 'Click "Confirm" to upload.'}
                </DialogDescription>
            </DialogHeader>
            {uploadErrors.length > 0 ? (
                <div className="my-4 space-y-2 rounded-md bg-destructive/10 p-4">
                    <h3 className="font-semibold text-destructive">Upload Errors</h3>
                    <ScrollArea className="h-40">
                        <ul className="list-disc pl-5 text-sm text-destructive">
                            {uploadErrors.map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                    </ScrollArea>
                </div>
            ) : (
                <ScrollArea className="h-64">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Area Name</TableHead>
                                <TableHead>Bengali Name</TableHead>
                                <TableHead>Code</TableHead>
                                <TableHead>Zone</TableHead>
                                <TableHead>Responsible Employee</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {uploadedAreas.map((area, index) => (
                                <TableRow key={index}>
                                    <TableCell>{area.name}</TableCell>
                                    <TableCell>{area.bengaliName}</TableCell>
                                    <TableCell>{area.code}</TableCell>
                                    <TableCell>{getZoneName(area.zoneId)}</TableCell>
                                    <TableCell>{getEmployeeName(area.responsibleEmployeeId) || 'None'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            )}
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleConfirmUpload} disabled={uploadErrors.length > 0 || uploadedAreas.length === 0}>Confirm Upload</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
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
