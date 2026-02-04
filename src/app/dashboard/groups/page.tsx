
"use client";

import { useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit, Trash2, FileDown, FileUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMember } from '@/context/MemberContext';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, writeBatch, collectionGroup, query, getDocs } from 'firebase/firestore';
import type { Group, Employee, Branch, Area } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import * as XLSX from 'xlsx';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function GroupsPage() {
  const { toast } = useToast();
  const firestore = useFirestore();

  const employeesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'employees'): null, [firestore]);
  const { data: employees, isLoading: employeesLoading } = useCollection<Employee>(employeesQuery);

  const groupsQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'groups')) : null, [firestore]);
  const { data: groupsData, isLoading: groupsLoading } = useCollection<Group>(groupsQuery);
  
  const branchesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'branches')) : null, [firestore]);
  const { data: branches, isLoading: branchesLoading } = useCollection<Branch>(branchesQuery);

  const areasQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'areas')) : null, [firestore]);
  const { data: areas, isLoading: areasLoading } = useCollection<Area>(areasQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadedGroups, setUploadedGroups] = useState<any[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  const [branchSearch, setBranchSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const { memberChanges } = useMember();

  const weekDays = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const userVisibleGroups = useMemo(() => {
    if (!groupsData) return [];
    return groupsData;
  }, [groupsData]);

  const sortedGroups = useMemo(() => {
    if (!userVisibleGroups) return [];
    return [...userVisibleGroups].sort((a, b) => a.code.localeCompare(b.code));
  }, [userVisibleGroups]);

  const getEmployeeName = (employeeId: string) => {
    return employees?.find(e => e.id === employeeId)?.name || 'N/A';
  };
  
  const getBranchName = (branchId: string) => {
    return branches?.find(b => b.id === branchId)?.name || 'N/A';
  }
  
  const getBranchCode = (branchId: string) => {
    return branches?.find(b => b.id === branchId)?.code || '';
  }

  const filteredGroups = useMemo(() => {
    let groupsToFilter = sortedGroups;

    if (branchSearch) {
        const searchTerm = branchSearch.toLowerCase();
        groupsToFilter = groupsToFilter.filter(group => {
            const branchName = getBranchName(group.branchId).toLowerCase();
            const branchCode = getBranchCode(group.branchId).toLowerCase();
            return branchName.includes(searchTerm) || branchCode.includes(searchTerm);
        });
    }

    return groupsToFilter;
  }, [sortedGroups, branchSearch, branches]);

  const paginatedGroups = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredGroups.slice(startIndex, endIndex);
  }, [filteredGroups, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredGroups.length / rowsPerPage);

  const calculateCurrentMembers = (groupId: string, initialMembers: number) => {
    const totalAdded = memberChanges
      .filter(c => c.groupId === groupId)
      .reduce((sum, change) => sum + change.added, 0);
    const totalDropped = memberChanges
      .filter(c => c.groupId === groupId)
      .reduce((sum, change) => sum + change.dropped, 0);
    return initialMembers + totalAdded - totalDropped;
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Group Name": "",
        "Code": "",
        "Day": "Saturday",
        "Branch Code": "",
        "Leader Name and Code": "Asif Hawlader - 137",
        "Initial Members": 0,
        "Initial Savings": 0,
        "Status": "Active"
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Groups");
    XLSX.writeFile(workbook, "GroupsTemplate.xlsx");
    toast({ title: "Template Downloaded" });
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
        const validGroups: any[] = [];
        const employeeMap = new Map(employees?.map(e => [String(e.code).trim().toLowerCase(), e.id]));
        const branchMap = new Map(branches?.map(b => [String(b.code).trim().toLowerCase(), b]));
        const areaMap = new Map(areas?.map(a => [a.id, a]));

        jsonData.forEach((row, index) => {
          const { "Group Name": name, "Code": code, "Day": day, "Branch Code": branchCode, "Leader Name and Code": leaderInfo, "Initial Members": initialMembers, "Initial Savings": initialSavings, "Status": status } = row;
          if (!name || !code || !day || !branchCode || !leaderInfo || !status) {
            errors.push(`Row ${index + 2}: Missing required fields.`);
            return;
          }
          
          const leaderCodeRaw = String(leaderInfo).split(' - ').pop()?.trim();
          if (!leaderCodeRaw) {
             errors.push(`Row ${index + 2}: Leader Name and Code "${leaderInfo}" is not in the correct 'Name - Code' format.`);
             return;
          }
          const leaderCodeValue = leaderCodeRaw.toLowerCase();

          const normalizedBranchCode = String(branchCode).trim().toLowerCase();
          if (!branchMap.has(normalizedBranchCode)) {
            errors.push(`Row ${index + 2}: Branch with code "${branchCode}" not found.`);
            return;
          }
          
          if (!employeeMap.has(leaderCodeValue)) {
            errors.push(`Row ${index + 2}: Leader with code "${leaderCodeRaw}" not found.`);
            return;
          }

          const branchForGroup = branchMap.get(normalizedBranchCode)!;
          const responsibleEmployeeId = employeeMap.get(leaderCodeValue)!;
          
          let regionId = branchForGroup.regionId;
          let zoneId = branchForGroup.zoneId;
          let areaId = branchForGroup.areaId;

          if (!regionId || !zoneId) {
            const area = areaMap.get(areaId);
            if (area) {
                regionId = area.regionId;
                zoneId = area.zoneId;
            }
          }
          
          if (!regionId || !zoneId || !areaId) { 
            errors.push(`Row ${index + 2}: Branch data for "${branchCode}" is incomplete. Could not resolve full path.`); 
            return; 
          }
          
          validGroups.push({ name, code, day, branchId: branchForGroup.id, responsibleEmployeeId, initialMembers: Number(initialMembers) || 0, initialSavings: Number(initialSavings) || 0, status, areaId: areaId, zoneId: zoneId, regionId: regionId });
        });

        setUploadedGroups(validGroups);
        setUploadErrors(errors);
        setIsUploadDialogOpen(true);

      } catch (error) {
        toast({ variant: 'destructive', title: 'Error processing file' });
      }
    };
    reader.readAsArrayBuffer(file);
  };
  
  const handleConfirmUpload = async () => {
    if (uploadedGroups.length === 0) return;
    const batch = writeBatch(firestore);
    uploadedGroups.forEach(groupData => {
      const newDocRef = doc(collection(firestore, 'regions', groupData.regionId, 'zones', groupData.zoneId, 'areas', groupData.areaId, 'branches', groupData.branchId, 'groups'));
      const newGroup: Group = {
        id: newDocRef.id,
        name: groupData.name,
        code: groupData.code,
        day: groupData.day,
        status: groupData.status,
        responsibleEmployeeId: groupData.responsibleEmployeeId,
        initialMembers: groupData.initialMembers,
        initialSavings: groupData.initialSavings,
        branchId: groupData.branchId,
        areaId: groupData.areaId,
        zoneId: groupData.zoneId,
        regionId: groupData.regionId,
      };
      batch.set(newDocRef, newGroup);
    });

    try {
        await batch.commit();
        toast({ title: `${uploadedGroups.length} groups uploaded successfully.` });
        setIsUploadDialogOpen(false);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
    }
  };


  const handleAddNewClick = () => {
    setEditingGroup(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (group: Group) => {
    setEditingGroup(group);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (group: Group) => {
    setGroupToDelete(group);
  };

  const confirmDelete = async () => {
    if (groupToDelete && firestore) {
      if (!groupToDelete.regionId || !groupToDelete.zoneId || !groupToDelete.areaId) {
        toast({
          variant: "destructive",
          title: "Cannot Delete Group",
          description: "This group is missing path information. It might be old data. Please re-create it to fix.",
          duration: 7000,
        });
        setGroupToDelete(null);
        return;
      }
      try {
        const groupDocRef = doc(firestore, "regions", groupToDelete.regionId, "zones", groupToDelete.zoneId, "areas", groupToDelete.areaId, "branches", groupToDelete.branchId, "groups", groupToDelete.id);
        await deleteDoc(groupDocRef);
        toast({ title: "Group deleted", description: `"${groupToDelete.name}" has been deleted.` });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error deleting group', description: error.message });
      } finally {
        setGroupToDelete(null);
      }
    }
  };

  const handleDeleteAll = async () => {
    if (!firestore || !groupsQuery) return;
    try {
      const groupsSnapshot = await getDocs(groupsQuery);
      if (groupsSnapshot.empty) {
        toast({ title: "No groups to delete." });
        setIsDeleteAllOpen(false);
        return;
      }
      const batch = writeBatch(firestore);
      groupsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      toast({ title: "All groups deleted." });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error deleting groups', description: error.message });
    }
    setIsDeleteAllOpen(false);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingGroup(null);
  };
  
  const FormDialog = () => {
    const [name, setName] = useState(editingGroup?.name || '');
    const [code, setCode] = useState(editingGroup?.code || '');
    const [day, setDay] = useState(editingGroup?.day || '');
    const [branchId, setBranchId] = useState(editingGroup?.branchId || '');
    const [responsibleEmployeeId, setResponsibleEmployeeId] = useState(editingGroup?.responsibleEmployeeId || '');
    const [initialMembers, setInitialMembers] = useState(editingGroup?.initialMembers || 0);
    const [initialSavings, setInitialSavings] = useState(editingGroup?.initialSavings || 0);
    const [status, setStatus] = useState<Group['status'] | ''>(editingGroup?.status || '');

    const handleSubmit = async () => {
      if (!name || !code || !day || !branchId || !responsibleEmployeeId || !status || !firestore) {
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Please fill out all fields.",
        });
        return;
      }
      try {
        const selectedBranch = branches?.find(b => b.id === branchId);
        if (!selectedBranch || !selectedBranch.regionId || !selectedBranch.zoneId || !selectedBranch.areaId) {
            toast({ variant: "destructive", title: "Invalid Branch", description: "Selected branch is missing path information." });
            return;
        }

        if (editingGroup) { // Update
          const groupDocRef = doc(firestore, 'regions', editingGroup.regionId, 'zones', editingGroup.zoneId, 'areas', editingGroup.areaId, 'branches', editingGroup.branchId, 'groups', editingGroup.id);
          const updatedGroup: Partial<Group> = { name, code, day, responsibleEmployeeId, status: status as Group['status'], initialMembers, initialSavings };
          await setDoc(groupDocRef, updatedGroup, { merge: true });
          toast({ title: "Group updated", description: `"${name}" has been updated.` });
        } else { // Create
          const newDocRef = doc(collection(firestore, 'regions', selectedBranch.regionId, 'zones', selectedBranch.zoneId, 'areas', selectedBranch.areaId, 'branches', selectedBranch.id, 'groups'));
          const newGroup: Group = {
            id: newDocRef.id,
            name,
            code,
            day,
            responsibleEmployeeId,
            initialMembers,
            initialSavings,
            status: status as Group['status'],
            branchId,
            areaId: selectedBranch.areaId,
            zoneId: selectedBranch.zoneId,
            regionId: selectedBranch.regionId,
          };
          await setDoc(newDocRef, newGroup);
          toast({ title: "Group created", description: `"${name}" has been created.` });
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
                    <DialogTitle>{editingGroup ? 'Edit Group' : 'Create New Group'}</DialogTitle>
                    <DialogDescription>
                        {editingGroup ? 'Update the details of the group.' : 'Add a new group and assign a leader.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="branch">
                           Branch
                        </Label>
                        <Select onValueChange={setBranchId} value={branchId} disabled={!!editingGroup}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a branch" />
                            </SelectTrigger>
                            <SelectContent>
                                {branches?.map(b => (
                                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="name">
                                Group Name
                            </Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Sunrise Group" />
                        </div>
                         <div className="grid gap-2">
                            <Label htmlFor="code">
                                Group Code
                            </Label>
                            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., SG001" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                         <div className="grid gap-2">
                            <Label htmlFor="day">
                               Group Day
                            </Label>
                            <Select onValueChange={setDay} value={day}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a day" />
                                </SelectTrigger>
                                <SelectContent>
                                    {weekDays.map(d => (
                                         <SelectItem key={d} value={d}>{d}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="leader">
                               Leader
                            </Label>
                            <Select onValueChange={setResponsibleEmployeeId} value={responsibleEmployeeId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a leader" />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees?.map(e => (
                                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="members">
                               Initial Members
                            </Label>
                            <Input id="members" type="number" value={initialMembers} onChange={(e) => setInitialMembers(Number(e.target.value))} placeholder="e.g., 10" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="savings">
                               Initial Savings
                            </Label>
                            <Input id="savings" type="number" value={initialSavings} onChange={(e) => setInitialSavings(Number(e.target.value))} placeholder="e.g., 12000" />
                        </div>
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="status">
                            Status
                        </Label>
                        <Select onValueChange={(value) => setStatus(value as Group['status'])} value={status}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Inactive">Inactive</SelectItem>
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
  
  const isLoading = groupsLoading || employeesLoading || branchesLoading || areasLoading;

  return (
    <>
      <Card>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Groups / Centers</CardTitle>
            <CardDescription>Manage client groups and their financial activities.</CardDescription>
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
                  New Group
              </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
              <div className="grid gap-1.5">
                  <Label htmlFor="branch-filter">Filter by Branch</Label>
                  <Input
                      id="branch-filter"
                      placeholder="Type branch name or code..."
                      value={branchSearch}
                      onChange={e => setBranchSearch(e.target.value)}
                      className="w-[250px]"
                  />
              </div>
          </div>
          {isLoading ? (
             Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4 border-b">
                    <Skeleton className="h-10 w-full" />
                </div>
            ))
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SL</TableHead>
                <TableHead>Group Name</TableHead>
                <TableHead>Group Code</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Branch Code</TableHead>
                <TableHead>Group Day</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Leader</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedGroups.map((group, index) => (
                <TableRow key={group.id}>
                  <TableCell>{(currentPage - 1) * rowsPerPage + index + 1}</TableCell>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell>{group.code}</TableCell>
                  <TableCell>{getBranchName(group.branchId)}</TableCell>
                  <TableCell>{getBranchCode(group.branchId)}</TableCell>
                  <TableCell>{group.day}</TableCell>
                  <TableCell>
                    <Badge variant={group.status === 'Active' ? 'default' : 'secondary'}>{group.status}</Badge>
                  </TableCell>
                  <TableCell>{getEmployeeName(group.responsibleEmployeeId)}</TableCell>
                  <TableCell className="text-right">{calculateCurrentMembers(group.id, group.initialMembers)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(group)}>
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(group)} className="text-destructive hover:text-destructive">
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
        <CardFooter className="flex items-center justify-between pt-6">
            <div className="text-sm text-muted-foreground">
                Showing {paginatedGroups.length} of {filteredGroups.length} groups.
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <Label htmlFor="rows-per-page">Rows per page</Label>
                    <Select
                        value={String(rowsPerPage)}
                        onValueChange={(value) => {
                            setRowsPerPage(Number(value));
                            setCurrentPage(1);
                        }}
                    >
                        <SelectTrigger id="rows-per-page" className="w-20">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {[50, 100, 150, 200, 300, 400, 500].map(size => (
                                <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="text-sm font-medium">
                    Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages || totalPages === 0}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </CardFooter>
      </Card>
      
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
                                <TableHead>Group Name</TableHead>
                                <TableHead>Code</TableHead>
                                <TableHead>Branch</TableHead>
                                <TableHead>Leader</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {uploadedGroups.map((group, index) => (
                                <TableRow key={index}>
                                    <TableCell>{group.name}</TableCell>
                                    <TableCell>{group.code}</TableCell>
                                    <TableCell>{getBranchName(group.branchId)}</TableCell>
                                    <TableCell>{getEmployeeName(group.responsibleEmployeeId)}</TableCell>
                                    <TableCell><Badge variant={group.status === 'Active' ? 'default' : 'secondary'}>{group.status}</Badge></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            )}
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleConfirmUpload} disabled={uploadErrors.length > 0 || uploadedGroups.length === 0}>Confirm Upload</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!groupToDelete} onOpenChange={() => setGroupToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the group
              "{groupToDelete?.name}".
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
              This action cannot be undone. This will permanently delete ALL groups.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive hover:bg-destructive/90">Delete All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
