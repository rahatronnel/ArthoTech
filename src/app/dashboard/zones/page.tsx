
"use client";

import { useState, useRef } from 'react';
import type { Zone, Region, Employee } from '@/lib/data';
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

export default function ZonesPage() {
  const { toast } = useToast();
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadedZones, setUploadedZones] = useState<any[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  const getEmployeeName = (employeeId?: string) => {
    if (!employeeId) return 'N/A';
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
        "Responsible Employee Code": ""
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Zones");
    XLSX.writeFile(workbook, "ZonesTemplate.xlsx");
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
        const validZones: any[] = [];
        const employeeMap = new Map(employees?.filter(e => e.role === 'Zonal User').map(e => [String(e.code).trim().toLowerCase(), e.id]));
        const regionMap = new Map(regions?.map(r => [String(r.code).trim().toLowerCase(), r.id]));

        jsonData.forEach((row, index) => {
          const { 'Name': name, 'Bengali Name': bengaliName, 'Code': code, 'Region Code': regionCode, 'Responsible Employee Code': employeeCode } = row;
          if (!name || !code || !regionCode) {
            errors.push(`Row ${index + 2}: Missing required fields (Name, Code, Region Code).`);
            return;
          }
          const normalizedRegionCode = String(regionCode).trim().toLowerCase();
          if (!regionMap.has(normalizedRegionCode)) {
            errors.push(`Row ${index + 2}: Region with code "${regionCode}" not found.`);
            return;
          }
          const regionId = regionMap.get(normalizedRegionCode)!;

          let responsibleEmployeeId: string | undefined = undefined;
          if (employeeCode) {
            const normalizedEmployeeCode = String(employeeCode).trim().toLowerCase();
            if(employeeMap.has(normalizedEmployeeCode)) {
                responsibleEmployeeId = employeeMap.get(normalizedEmployeeCode);
            } else {
                errors.push(`Row ${index + 2}: Employee with code "${employeeCode}" not found or they do not have the 'Zonal User' role.`);
                return;
            }
          }
          validZones.push({ name, bengaliName: bengaliName || '', code, regionId, responsibleEmployeeId });
        });

        setUploadedZones(validZones);
        setUploadErrors(errors);
        setIsUploadDialogOpen(true);

      } catch (error) {
        toast({ variant: 'destructive', title: 'Error processing file', description: 'Please make sure it is a valid .xlsx file.' });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmUpload = async () => {
    if (uploadedZones.length === 0) {
        toast({ variant: 'destructive', title: 'No valid data to upload.' });
        return;
    }
    const batch = writeBatch(firestore);
    uploadedZones.forEach(zoneData => {
      const newDocRef = doc(collection(firestore, 'regions', zoneData.regionId, 'zones'));
      const newZone: Omit<Zone, 'id'> = {
        name: zoneData.name,
        bengaliName: zoneData.bengaliName,
        code: zoneData.code,
        regionId: zoneData.regionId,
        responsibleEmployeeId: zoneData.responsibleEmployeeId,
      };
      batch.set(newDocRef, { ...newZone, id: newDocRef.id });
    });

    try {
        await batch.commit();
        toast({ title: `${uploadedZones.length} zones uploaded successfully.` });
        setIsUploadDialogOpen(false);
        setUploadedZones([]);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
    }
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
    const [employeeId, setEmployeeId] = useState(editingZone?.responsibleEmployeeId || 'none');

    const handleSubmit = async () => {
       if (!name || !code || !regionId) {
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Please fill out Name, Code, and Region.",
        });
        return;
      }

      const finalEmployeeId = employeeId === 'none' ? undefined : employeeId;

      try {
        if (editingZone) { // Update
          const zoneDocRef = doc(firestore, 'regions', editingZone.regionId, 'zones', editingZone.id);
          const updatedData: {[key: string]: any} = { name, bengaliName, code, regionId };
          if(finalEmployeeId) {
            updatedData.responsibleEmployeeId = finalEmployeeId;
          } else {
            updatedData.responsibleEmployeeId = deleteField();
          }
          await setDoc(zoneDocRef, updatedData, { merge: true });
          toast({ title: "Zone updated", description: `"${name}" has been updated.` });
        } else { // Create
          const newDocRef = doc(collection(firestore, 'regions', regionId, 'zones'));
          const newZoneData: {[key: string]: any} = {
            id: newDocRef.id,
            name,
            bengaliName,
            code,
            regionId,
          };
          if (finalEmployeeId) {
            newZoneData.responsibleEmployeeId = finalEmployeeId;
          }
          await setDoc(newDocRef, newZoneData);
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
                Responsible Employee (optional)
              </Label>
              <Select onValueChange={setEmployeeId} value={employeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
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
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
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
                    <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(zone)}>
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(zone)} className="text-destructive hover:text-destructive">
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
                                <TableHead>Zone Name</TableHead>
                                <TableHead>Bengali Name</TableHead>
                                <TableHead>Code</TableHead>
                                <TableHead>Region</TableHead>
                                <TableHead>Responsible Employee</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {uploadedZones.map((zone, index) => (
                                <TableRow key={index}>
                                    <TableCell>{zone.name}</TableCell>
                                    <TableCell>{zone.bengaliName}</TableCell>
                                    <TableCell>{zone.code}</TableCell>
                                    <TableCell>{getRegionName(zone.regionId)}</TableCell>
                                    <TableCell>{getEmployeeName(zone.responsibleEmployeeId) || 'None'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            )}
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleConfirmUpload} disabled={uploadErrors.length > 0 || uploadedZones.length === 0}>Confirm Upload</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
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
