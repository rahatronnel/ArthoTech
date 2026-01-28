
"use client";

import { useState, useRef } from 'react';
import type { Region, Employee } from '@/lib/data';
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
import { collection, doc, setDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function RegionsPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const firestore = useFirestore();

  const regionsQuery = useMemoFirebase(() => collection(firestore, 'regions'), [firestore]);
  const { data: regions, isLoading } = useCollection<Region>(regionsQuery);

  const employeesQuery = useMemoFirebase(() => collection(firestore, 'employees'), [firestore]);
  const { data: employees } = useCollection<Employee>(employeesQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [regionToDelete, setRegionToDelete] = useState<Region | null>(null);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadedRegions, setUploadedRegions] = useState<any[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  const getEmployeeName = (employeeId?: string) => {
    if (!employeeId) return 'N/A';
    return employees?.find(e => e.id === employeeId)?.name || 'N/A';
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Name": "",
        "Bengali Name": "",
        "Code": "",
        "Responsible Employee Login ID": ""
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Regions");
    XLSX.writeFile(workbook, "RegionsTemplate.xlsx");
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
        const validRegions: any[] = [];
        const employeeMap = new Map(employees?.map(e => [e.loginId, e.id]));

        jsonData.forEach((row, index) => {
          const { 'Name': name, 'Bengali Name': bengaliName, 'Code': code, 'Responsible Employee Login ID': loginId } = row;
          if (!name || !bengaliName || !code) {
            errors.push(`Row ${index + 2}: Missing required fields (Name, Bengali Name, Code).`);
            return;
          }
          let responsibleEmployeeId: string | undefined = undefined;
          if (loginId) {
            if(employeeMap.has(loginId)) {
                responsibleEmployeeId = employeeMap.get(loginId);
            } else {
                errors.push(`Row ${index + 2}: Employee with login ID "${loginId}" not found or they do not have the 'Regional User' role.`);
                return;
            }
          }
          validRegions.push({ name, bengaliName, code, responsibleEmployeeId });
        });

        setUploadedRegions(validRegions);
        setUploadErrors(errors);
        setIsUploadDialogOpen(true);

      } catch (error) {
        toast({ variant: 'destructive', title: 'Error processing file', description: 'Please make sure it is a valid .xlsx file.' });
      }
    };
    reader.readAsArrayBuffer(file);
  };
  
  const handleConfirmUpload = async () => {
    if (uploadedRegions.length === 0) {
        toast({ variant: 'destructive', title: 'No valid data to upload.' });
        return;
    }
    const batch = writeBatch(firestore);
    uploadedRegions.forEach(regionData => {
      const newDocRef = doc(collection(firestore, 'regions'));
      const newRegion: Omit<Region, 'id'> = {
        ...regionData
      };
      batch.set(newDocRef, { ...newRegion, id: newDocRef.id });
    });

    try {
        await batch.commit();
        toast({ title: `${uploadedRegions.length} regions uploaded successfully.` });
        setIsUploadDialogOpen(false);
        setUploadedRegions([]);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
    }
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
  
  const confirmDelete = async () => {
    if (regionToDelete) {
      try {
        await deleteDoc(doc(firestore, "regions", regionToDelete.id));
        toast({ title: "Region deleted", description: `"${regionToDelete.name}" has been deleted.` });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error deleting region', description: error.message });
      } finally {
        setRegionToDelete(null);
      }
    }
  };

  const handleDeleteAll = async () => {
    if(!regionsQuery) return;
    try {
      const regionsSnapshot = await getDocs(regionsQuery);
      const batch = writeBatch(firestore);
      regionsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      toast({ title: 'All regions have been deleted.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error deleting all regions', description: error.message });
    }
    setIsDeleteAllOpen(false);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingRegion(null);
  };

  const FormDialog = () => {
    const [name, setName] = useState(editingRegion?.name || '');
    const [bengaliName, setBengaliName] = useState(editingRegion?.bengaliName || '');
    const [code, setCode] = useState(editingRegion?.code || '');
    const [employeeId, setEmployeeId] = useState(editingRegion?.responsibleEmployeeId || 'none');
  
    const handleSubmit = async () => {
      if (!name || !bengaliName || !code) {
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Please fill out Name, Bengali Name, and Code.",
        });
        return;
      }
      
      const finalEmployeeId = employeeId === 'none' ? undefined : employeeId;

      try {
        if (editingRegion) { // Update
          const regionDocRef = doc(firestore, 'regions', editingRegion.id);
          const updatedData: Partial<Region> = { name, bengaliName, code, responsibleEmployeeId: finalEmployeeId };
          await setDoc(regionDocRef, updatedData, { merge: true });
          toast({ title: "Region updated", description: `"${name}" has been updated.` });
        } else { // Create
          const newDocRef = doc(collection(firestore, 'regions'));
          const newRegion: Region = {
              id: newDocRef.id,
              name,
              bengaliName,
              code,
              responsibleEmployeeId: finalEmployeeId,
          };
          await setDoc(newDocRef, newRegion);
          toast({ title: "Region created", description: `"${name}" has been added.` });
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
            <DialogTitle>{editingRegion ? 'Edit Region' : 'Create New Region'}</DialogTitle>
            <DialogDescription>
              {editingRegion ? 'Update the details of the region.' : 'Add a new region and optionally assign a responsible employee.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">
                Region Name
              </Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Capital Region" />
            </div>
             <div className="grid gap-2">
              <Label htmlFor="bengaliName">
                Bengali Name
              </Label>
              <Input id="bengaliName" value={bengaliName} onChange={(e) => setBengaliName(e.target.value)} placeholder="e.g., রাজধানী অঞ্চল" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="code">
                Region Code
              </Label>
              <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., CR" />
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
                  {employees?.filter(e => e.role === 'Regional User').map(employee => (
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
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Regions</CardTitle>
          <CardDescription>Manage your organization's regions.</CardDescription>
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
            {currentUser?.role === 'Super Admin' && (
              <Button size="sm" variant="destructive" className="gap-1" onClick={() => setIsDeleteAllOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Delete All
              </Button>
            )}
            <Button size="sm" className="gap-1" onClick={handleAddNewClick}>
                <PlusCircle className="h-4 w-4" />
                New Region
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <p>Loading...</p> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Region Name</TableHead>
              <TableHead>Bengali Name</TableHead>
              <TableHead className="hidden md:table-cell">Region Code</TableHead>
              <TableHead>Responsible Employee</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {regions?.map((region) => (
              <TableRow key={region.id}>
                <TableCell className="font-medium">{region.name}</TableCell>
                <TableCell>{region.bengaliName}</TableCell>
                <TableCell className="hidden md:table-cell">{region.code}</TableCell>
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
                                <TableHead>Region Name</TableHead>
                                <TableHead>Bengali Name</TableHead>
                                <TableHead>Code</TableHead>
                                <TableHead>Responsible Employee</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {uploadedRegions.map((region, index) => (
                                <TableRow key={index}>
                                    <TableCell>{region.name}</TableCell>
                                    <TableCell>{region.bengaliName}</TableCell>
                                    <TableCell>{region.code}</TableCell>
                                    <TableCell>{getEmployeeName(region.responsibleEmployeeId) || 'None'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            )}
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleConfirmUpload} disabled={uploadErrors.length > 0 || uploadedRegions.length === 0}>Confirm Upload</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
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
      <AlertDialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete ALL regions.
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
