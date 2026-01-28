"use client";

import { useState, useMemo } from 'react';
import type { Branch, Region, Zone, Area } from '@/lib/data';
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

// Composite type for branch data including parent IDs for easier data handling
type FullBranch = Branch & { regionId: string; zoneId: string };
// Composite type for area data including parent ID
type FullArea = Area & { regionId: string };

export default function BranchesPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const firestore = useFirestore();

  // Firestore collections
  const branchesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'branches')) : null, [firestore]);
  const { data: branches, isLoading: branchesLoading } = useCollection<FullBranch>(branchesQuery);

  const areasQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'areas')) : null, [firestore]);
  const { data: areas, isLoading: areasLoading } = useCollection<FullArea>(areasQuery);

  const zonesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'zones')) : null, [firestore]);
  const { data: zones, isLoading: zonesLoading } = useCollection<Zone>(zonesQuery);

  const regionsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'regions') : null, [firestore]);
  const { data: regions, isLoading: regionsLoading } = useCollection<Region>(regionsQuery);

  // UI State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<FullBranch | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<FullBranch | null>(null);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);

  // Helper functions to get names from IDs
  const getAreaName = (areaId: string) => areas?.find(a => a.id === areaId)?.name || 'N/A';
  const getZoneName = (zoneId: string) => zones?.find(z => z.id === zoneId)?.name || 'N/A';
  const getRegionName = (regionId: string) => regions?.find(r => r.id === regionId)?.name || 'N/A';

  // Handlers
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

  const handleAddNewClick = () => {
    setEditingBranch(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (branch: FullBranch) => {
    setEditingBranch(branch);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (branch: FullBranch) => {
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

  // The Form Dialog component
  const FormDialog = () => {
    const [name, setName] = useState(editingBranch?.name || '');
    const [bengaliName, setBengaliName] = useState(editingBranch?.bengaliName || '');
    const [code, setCode] = useState(editingBranch?.code || '');
    const [address, setAddress] = useState(editingBranch?.address || '');
    const [contactNumber, setContactNumber] = useState(editingBranch?.contactNumber || '');
    const [selectedRegionId, setSelectedRegionId] = useState(editingBranch?.regionId || '');
    const [selectedZoneId, setSelectedZoneId] = useState(editingBranch?.zoneId || '');
    const [selectedAreaId, setSelectedAreaId] = useState(editingBranch?.areaId || '');
    
    // Cascading dropdown logic
    const filteredZones = useMemo(() => zones?.filter(z => z.regionId === selectedRegionId) || [], [selectedRegionId, zones]);
    const filteredAreas = useMemo(() => areas?.filter(a => a.zoneId === selectedZoneId) || [], [selectedZoneId, areas]);

    const handleSubmit = async () => {
      if (!name || !code || !selectedAreaId || !address || !contactNumber) {
        toast({ variant: "destructive", title: "Validation Error", description: "Please fill out all required fields." });
        return;
      }
      
      const selectedArea = areas?.find(a => a.id === selectedAreaId);
      if (!selectedArea) {
          toast({ variant: "destructive", title: "Invalid Selection", description: "Selected area could not be found." });
          return;
      }
      const { zoneId, regionId } = selectedArea;

      try {
        if (editingBranch) { // Update
          const branchDocRef = doc(firestore, 'regions', editingBranch.regionId, 'zones', editingBranch.zoneId, 'areas', editingBranch.areaId, 'branches', editingBranch.id);
          const updatedData: Partial<FullBranch> = { name, bengaliName, code, address, contactNumber };
          await setDoc(branchDocRef, updatedData, { merge: true });
          toast({ title: "Branch updated", description: `"${name}" has been updated.` });
        } else { // Create
          const newDocRef = doc(collection(firestore, 'regions', regionId, 'zones', zoneId, 'areas', selectedAreaId, 'branches'));
          const newBranch: FullBranch = {
            id: newDocRef.id,
            name,
            bengaliName,
            code,
            address,
            contactNumber,
            areaId: selectedAreaId,
            zoneId,
            regionId,
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
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Branches</CardTitle>
          <CardDescription>Manage your organization's branches.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={handleDownloadTemplate}><FileDown className="h-4 w-4" />Download</Button>
            <Button size="sm" variant="outline" className="gap-1"><FileUp className="h-4 w-4" />Upload</Button>
            {currentUser?.role === 'Super Admin' && (
              <Button size="sm" variant="destructive" className="gap-1" onClick={() => setIsDeleteAllOpen(true)}><Trash2 className="h-4 w-4" />Delete All</Button>
            )}
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
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
        )}
      </CardContent>
       {isDialogOpen && <FormDialog />}
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
