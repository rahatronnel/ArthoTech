
"use client";

import { useState, useMemo, useRef } from 'react';
import type { Branch, Region, Zone, Area } from '@/lib/data';
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
import { collection, doc, setDoc, deleteDoc, writeBatch, getDocs, collectionGroup, query } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function BranchesPage() {
  const { toast } = useToast();
  const firestore = useFirestore();

  const branchesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'branches')) : null, [firestore]);
  const { data: branches, isLoading: branchesLoading } = useCollection<Branch>(branchesQuery);

  const areasQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'areas')) : null, [firestore]);
  const { data: areas, isLoading: areasLoading } = useCollection<Area>(areasQuery);

  const zonesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'zones')) : null, [firestore]);
  const { data: zones, isLoading: zonesLoading } = useCollection<Zone>(zonesQuery);

  const regionsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'regions') : null, [firestore]);
  const { data: regions, isLoading: regionsLoading } = useCollection<Region>(regionsQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadedBranches, setUploadedBranches] = useState<any[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  const getAreaName = (areaId: string) => areas?.find(a => a.id === areaId)?.name || 'N/A';
  const getZoneName = (zoneId: string) => zones?.find(z => z.id === zoneId)?.name || 'N/A';
  const getRegionName = (regionId: string) => regions?.find(r => r.id === regionId)?.name || 'N/A';

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Name": "",
        "Bengali Name": "",
        "Code": "",
        "Address": "",
        "Contact Number": "",
        "Area Code": ""
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Branches");
    XLSX.writeFile(workbook, "BranchesTemplate.xlsx");
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
        const validBranches: any[] = [];
        const areaMap = new Map(areas?.map(a => [String(a.code).trim().toLowerCase(), { id: a.id, zoneId: a.zoneId, regionId: a.regionId }]));

        jsonData.forEach((row, index) => {
          const { 'Name': name, 'Bengali Name': bengaliName, 'Code': code, 'Address': address, 'Contact Number': contactNumber, 'Area Code': areaCode } = row;
          if (!name || !code || !address || !contactNumber || !areaCode) {
            errors.push(`Row ${index + 2}: Missing required fields.`);
            return;
          }
          const normalizedAreaCode = String(areaCode).trim().toLowerCase();
          if (!areaMap.has(normalizedAreaCode)) {
            errors.push(`Row ${index + 2}: Area with code "${areaCode}" not found.`);
            return;
          }
          const { id: areaId, zoneId, regionId } = areaMap.get(normalizedAreaCode)!;
          validBranches.push({ name, bengaliName: bengaliName || '', code, address, contactNumber, areaId, zoneId, regionId });
        });

        setUploadedBranches(validBranches);
        setUploadErrors(errors);
        setIsUploadDialogOpen(true);

      } catch (error) {
        toast({ variant: 'destructive', title: 'Error processing file', description: 'Please make sure it is a valid .xlsx file.' });
      }
    };
    reader.readAsArrayBuffer(file);
  };
  
  const handleConfirmUpload = async () => {
    if (uploadedBranches.length === 0) {
        toast({ variant: 'destructive', title: 'No valid data to upload.' });
        return;
    }
    const batch = writeBatch(firestore);
    uploadedBranches.forEach(branchData => {
      const newDocRef = doc(collection(firestore, 'regions', branchData.regionId, 'zones', branchData.zoneId, 'areas', branchData.areaId, 'branches'));
      const newBranch: Omit<Branch, 'id'> = {
        name: branchData.name,
        bengaliName: branchData.bengaliName,
        code: branchData.code,
        address: branchData.address,
        contactNumber: branchData.contactNumber,
        areaId: branchData.areaId,
        zoneId: branchData.zoneId,
        regionId: branchData.regionId,
      };
      batch.set(newDocRef, { ...newBranch, id: newDocRef.id });
    });

    try {
        await batch.commit();
        toast({ title: `${uploadedBranches.length} branches uploaded successfully.` });
        setIsUploadDialogOpen(false);
        setUploadedBranches([]);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
    }
  };

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

  const confirmDelete = async () => {
    if (branchToDelete) {
      try {
        const branchDocRef = doc(firestore, "regions", branchToDelete.regionId, "zones", branchToDelete.zoneId, "areas", branchToDelete.areaId, "branches", branchToDelete.id);
        await deleteDoc(branchDocRef);
        toast({ title: "Branch deleted", description: `"${branchToDelete.name}" has been deleted.` });
      } catch (error: any) {
        toast({ variant: "destructive", title: "Error deleting branch", description: error.message });
      } finally {
        setBranchToDelete(null);
      }
    }
  };

  const handleDeleteAll = async () => {
    if (!branchesQuery) return;
    try {
      const branchesSnapshot = await getDocs(branchesQuery);
      if (branchesSnapshot.empty) {
        toast({ title: "No branches to delete." });
        setIsDeleteAllOpen(false);
        return;
      }
      const batch = writeBatch(firestore);
      branchesSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      toast({ title: "All branches deleted." });
    } catch (error: any) {
       toast({ variant: "destructive", title: "Error deleting branches", description: error.message });
    }
    setIsDeleteAllOpen(false);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingBranch(null);
  };

  const FormDialog = () => {
    const [name, setName] = useState(editingBranch?.name || '');
    const [bengaliName, setBengaliName] = useState(editingBranch?.bengaliName || '');
    const [code, setCode] = useState(editingBranch?.code || '');
    const [address, setAddress] = useState(editingBranch?.address || '');
    const [contactNumber, setContactNumber] = useState(editingBranch?.contactNumber || '');
    const [selectedRegionId, setSelectedRegionId] = useState(editingBranch?.regionId || '');
    const [selectedZoneId, setSelectedZoneId] = useState(editingBranch?.zoneId || '');
    const [selectedAreaId, setSelectedAreaId] = useState(editingBranch?.areaId || '');
    
    const filteredZones = useMemo(() => zones?.filter(z => z.regionId === selectedRegionId) || [], [selectedRegionId, zones]);
    const filteredAreas = useMemo(() => areas?.filter(a => a.zoneId === selectedZoneId) || [], [selectedZoneId, areas]);

    const handleSubmit = async () => {
      if (!name || !code || !selectedAreaId || !address || !contactNumber || !selectedRegionId || !selectedZoneId) {
        toast({ variant: "destructive", title: "Validation Error", description: "Please fill out all required fields." });
        return;
      }

      try {
        if (editingBranch) { // Update
          const branchDocRef = doc(firestore, 'regions', editingBranch.regionId, 'zones', editingBranch.zoneId, 'areas', editingBranch.areaId, 'branches', editingBranch.id);
          const updatedData: Partial<Branch> = { name, bengaliName, code, address, contactNumber };
          await setDoc(branchDocRef, updatedData, { merge: true });
          toast({ title: "Branch updated", description: `"${name}" has been updated.` });
        } else { // Create
          const newDocRef = doc(collection(firestore, 'regions', selectedRegionId, 'zones', selectedZoneId, 'areas', selectedAreaId, 'branches'));
          const newBranch: Branch = {
            id: newDocRef.id,
            name,
            bengaliName,
            code,
            address,
            contactNumber,
            areaId: selectedAreaId,
            zoneId: selectedZoneId,
            regionId: selectedRegionId,
          };
          await setDoc(newDocRef, newBranch);
          toast({ title: "Branch created", description: `"${name}" has been created.` });
        }
        handleDialogClose();
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Save failed', description: error.message });
      }
    };

    return (
        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleDialogClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{editingBranch ? 'Edit Branch' : 'Create New Branch'}</DialogTitle>
                    <DialogDescription>
                       {editingBranch ? 'Update the details of the branch.' : 'Add a new branch and assign its location.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                          <Label htmlFor="name">Branch Name</Label>
                          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Downtown Branch" />
                      </div>
                      <div className="grid gap-2">
                          <Label htmlFor="bengaliName">Bengali Name</Label>
                          <Input id="bengaliName" value={bengaliName} onChange={(e) => setBengaliName(e.target.value)} placeholder="e.g., ডাউনটাউন শাখা" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="code">Branch Code</Label>
                        <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., DB01" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="address">Address</Label>
                        <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g., 123 Main St" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="contactNumber">Contact Number</Label>
                        <Input id="contactNumber" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="e.g., 555-1234" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="region">Region</Label>
                        <Select onValueChange={(value) => { setSelectedRegionId(value); setSelectedZoneId(''); setSelectedAreaId(''); }} value={selectedRegionId} disabled={!!editingBranch}>
                            <SelectTrigger><SelectValue placeholder="Select a region" /></SelectTrigger>
                            <SelectContent>{regions?.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="zone">Zone</Label>
                        <Select onValueChange={(value) => { setSelectedZoneId(value); setSelectedAreaId(''); }} value={selectedZoneId} disabled={!selectedRegionId || !!editingBranch}>
                            <SelectTrigger><SelectValue placeholder="Select a zone" /></SelectTrigger>
                            <SelectContent>{filteredZones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="area">Area</Label>
                        <Select onValueChange={setSelectedAreaId} value={selectedAreaId} disabled={!selectedZoneId || !!editingBranch}>
                            <SelectTrigger><SelectValue placeholder="Select an area" /></SelectTrigger>
                            <SelectContent>{filteredAreas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
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
  
  const isLoading = branchesLoading || areasLoading || zonesLoading || regionsLoading;

  return (
    <Card>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Branches</CardTitle>
          <CardDescription>Manage your organization's branches.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={handleDownloadTemplate}><FileDown className="h-4 w-4" />Download</Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={handleUploadClick}><FileUp className="h-4 w-4" />Upload</Button>
            
              <Button size="sm" variant="destructive" className="gap-1" onClick={() => setIsDeleteAllOpen(true)}><Trash2 className="h-4 w-4" />Delete All</Button>
            
            <Button size="sm" className="gap-1" onClick={handleAddNewClick}><PlusCircle className="h-4 w-4" />New Branch</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <p>Loading...</p> : (
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
            {branches?.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell className="font-medium">{branch.name}</TableCell>
                <TableCell>{branch.bengaliName}</TableCell>
                <TableCell className="hidden md:table-cell">{branch.code}</TableCell>
                <TableCell>{getAreaName(branch.areaId)}</TableCell>
                <TableCell className="hidden md:table-cell">{getZoneName(branch.zoneId)}</TableCell>
                <TableCell className="hidden lg:table-cell">{getRegionName(branch.regionId)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(branch)}>
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(branch)} className="text-destructive hover:text-destructive">
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
                                <TableHead>Name</TableHead>
                                <TableHead>Code</TableHead>
                                <TableHead>Area</TableHead>
                                <TableHead>Address</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {uploadedBranches.map((branch, index) => (
                                <TableRow key={index}>
                                    <TableCell>{branch.name}</TableCell>
                                    <TableCell>{branch.code}</TableCell>
                                    <TableCell>{getAreaName(branch.areaId)}</TableCell>
                                    <TableCell>{branch.address}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            )}
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleConfirmUpload} disabled={uploadErrors.length > 0 || uploadedBranches.length === 0}>Confirm Upload</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
       <AlertDialog open={!!branchToDelete} onOpenChange={() => setBranchToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the branch "{branchToDelete?.name}".</AlertDialogDescription>
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
            <AlertDialogDescription>This action cannot be undone. This will permanently delete ALL branches.</AlertDialogDescription>
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

    

    