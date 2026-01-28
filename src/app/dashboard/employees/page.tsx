
"use client";

import { useState, useMemo, useRef } from 'react';
import type { Employee, Branch } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, MoreHorizontal, FileDown, FileUp, Copy, Trash2 } from 'lucide-react';
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
import { createUserWithEmailAndPassword, fetchSignInMethodsForEmail } from 'firebase/auth';
import * as XLSX from 'xlsx';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';

export default function EmployeesPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const firestore = useFirestore();
  const auth = useAuth().firebaseUser?.auth;

  const employeesQuery = useMemoFirebase(() => collection(firestore, 'employees'), [firestore]);
  const { data: employeesData, isLoading } = useCollection<Employee>(employeesQuery);
  
  const branchesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'branches')) : null, [firestore]);
  const { data: branchesData } = useCollection<Branch>(branchesQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadedEmployees, setUploadedEmployees] = useState<any[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);

  const roles: Employee['role'][] = ['Branch User', 'Area User', 'Zonal User', 'Regional User', 'Head Office'];
  const assignments = ['Head Office', ...(branchesData?.map(b => b.name) || [])];

  const employees = useMemo(() => {
    return employeesData?.filter(e => e.role !== 'Super Admin') || [];
  }, [employeesData]);

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Name": "",
        "Bengali Name": "",
        "Code": "",
        "Role": "Branch User | Area User | Zonal User | Regional User | Head Office",
        "Assignment (Branch Name or 'Head Office')": "",
        "Login ID": "",
        "Password": ""
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");
    XLSX.writeFile(workbook, "EmployeesTemplate.xlsx");
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
    setIsProcessingUpload(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        const errors: string[] = [];
        const validEmployees: any[] = [];
        const existingLoginIds = new Set(employeesData?.map(emp => emp.loginId.toLowerCase()));
        const newLoginIdsInFile = new Set<string>();
        const validAssignments = new Set(assignments);

        for (const [index, row] of jsonData.entries()) {
          const { 'Name': name, 'Bengali Name': bengaliName, 'Code': code, 'Role': role, 'Assignment (Branch Name or \'Head Office\')': assignment, 'Login ID': loginId, 'Password': password } = row;
          if (!name || !code || !role || !assignment || !loginId || !password) {
            errors.push(`Row ${index + 2}: Missing required fields.`);
            continue;
          }
          if (password.length < 6) {
            errors.push(`Row ${index + 2}: Password for ${loginId} must be at least 6 characters.`);
            continue;
          }

          const normalizedLoginId = String(loginId).toLowerCase().trim();

          if (existingLoginIds.has(normalizedLoginId)) {
            errors.push(`Row ${index + 2}: Login ID "${loginId}" already exists in the employee database.`);
            continue;
          }
          if (newLoginIdsInFile.has(normalizedLoginId)) {
            errors.push(`Row ${index + 2}: Duplicate Login ID "${loginId}" found in the upload file.`);
            continue;
          }
          if (!roles.includes(role)) {
             errors.push(`Row ${index + 2}: Invalid role "${role}".`);
            continue;
          }
          if (!validAssignments.has(assignment)) {
             errors.push(`Row ${index + 2}: Invalid assignment "${assignment}".`);
            continue;
          }
          
          if (!auth || !auth.app.options.authDomain) {
            errors.push(`Row ${index + 2}: Firebase Auth is not configured correctly.`);
            continue;
          }

          const email = `${normalizedLoginId}@${auth.app.options.authDomain}`;
          try {
            const methods = await fetchSignInMethodsForEmail(auth, email);
            if (methods.length > 0) {
              errors.push(`Row ${index + 2}: Login ID "${loginId}" is already registered in the authentication system.`);
              continue;
            }
          } catch (authError: any) {
            errors.push(`Row ${index + 2}: Could not verify Login ID "${loginId}" due to a network error. Please try again.`);
            continue;
          }

          validEmployees.push({ name, bengaliName, code, role, assignment, loginId, password });
          newLoginIdsInFile.add(normalizedLoginId);
        }

        setUploadedEmployees(validEmployees);
        setUploadErrors(errors);
        setIsUploadDialogOpen(true);

      } catch (error) {
        toast({ variant: 'destructive', title: 'Error processing file' });
      } finally {
        setIsProcessingUpload(false);
      }
    };
    reader.onerror = () => {
        setIsProcessingUpload(false);
        toast({ variant: 'destructive', title: 'Could not read the file.' });
    };
    reader.readAsArrayBuffer(file);
  };
  
  const handleConfirmUpload = async () => {
    if (uploadedEmployees.length === 0 || !auth?.app.options.authDomain) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    let successCount = 0;
    const uploadProcessErrors: string[] = [];

    for (let i = 0; i < uploadedEmployees.length; i++) {
        const emp = uploadedEmployees[i];
        try {
            const normalizedLoginId = String(emp.loginId).toLowerCase().trim();
            const email = `${normalizedLoginId}@${auth.app.options.authDomain}`;
            const userCredential = await createUserWithEmailAndPassword(auth, email, emp.password);
            const uid = userCredential.user.uid;

            const newEmployee: Omit<Employee, 'id' | 'password'> = {
                name: emp.name,
                bengaliName: emp.bengaliName,
                code: emp.code,
                role: emp.role,
                assignment: emp.assignment,
                loginId: emp.loginId,
            };
            await setDoc(doc(firestore, "employees", uid), newEmployee);
            successCount++;
        } catch (error: any) {
            let errorMessage = error.message;
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'This Login ID is already registered. If you deleted this employee, you must also contact support to have their authentication account removed before re-creating them.';
            }
            uploadProcessErrors.push(`Failed to create employee ${emp.name} (${emp.loginId}): ${errorMessage}`);
        }
        setUploadProgress(((i + 1) / uploadedEmployees.length) * 100);
    }
    
    setIsUploading(false);
    
    if(uploadProcessErrors.length > 0) {
        setUploadErrors(uploadProcessErrors);
        toast({ variant: 'destructive', title: `Upload partially failed.`, description: `${successCount} employees created. ${uploadProcessErrors.length} failed.` });
    } else {
        toast({ title: 'Upload Successful', description: `${successCount} employees created successfully.`});
        setIsUploadDialogOpen(false);
    }
  };

  const handleAddNewClick = () => {
    setEditingEmployee(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (employee: Employee) => {
    setEditingEmployee(employee);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (employee: Employee) => {
    setEmployeeToDelete(employee);
  };

  const confirmDelete = async () => {
    if (employeeToDelete) {
      try {
        await deleteDoc(doc(firestore, "employees", employeeToDelete.id));
        toast({ title: "Employee deleted", description: `"${employeeToDelete.name}" has been deleted.` });
      } catch (error: any) {
        toast({ variant: "destructive", title: "Error deleting employee", description: error.message });
      } finally {
        setEmployeeToDelete(null);
      }
    }
  };

  const handleDeleteAll = async () => {
    if (currentUser?.role !== 'Super Admin' || !employeesData) return;
    
    try {
      const employeesToDelete = employeesData.filter(e => e.role !== 'Super Admin');
      const batch = writeBatch(firestore);
      employeesToDelete.forEach(emp => {
        batch.delete(doc(firestore, "employees", emp.id));
      });
      await batch.commit();
      toast({ title: "All non-admin employees deleted." });
    } catch (error: any) {
       toast({ variant: "destructive", title: "Error deleting employees", description: error.message });
    }
    setIsDeleteAllOpen(false);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingEmployee(null);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied!",
        description: `Login ID "${text}" copied to clipboard.`,
      });
    });
  };

  const FormDialog = () => {
    const [name, setName] = useState(editingEmployee?.name || '');
    const [bengaliName, setBengaliName] = useState(editingEmployee?.bengaliName || '');
    const [code, setCode] = useState(editingEmployee?.code || '');
    const [role, setRole] = useState<Employee['role'] | ''>(editingEmployee?.role || '');
    const [assignment, setAssignment] = useState(editingEmployee?.assignment || '');
    const [loginId, setLoginId] = useState(editingEmployee?.loginId || '');
    const [password, setPassword] = useState('');

    const handleSubmit = async () => {
      if (!name || !bengaliName || !code || !role || !assignment || !loginId || (!editingEmployee && !password)) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Please fill out all fields.",
        });
        return;
      }
      
      if (!auth || !auth.app.options.authDomain) {
          toast({ variant: "destructive", title: "Authentication Error", description: "Firebase Auth is not configured correctly." });
          return;
      }

      try {
        if (editingEmployee) { // Update
          const employeeDocRef = doc(firestore, 'employees', editingEmployee.id);
          const updatedData: Partial<Employee> = { name, bengaliName, code, role: role as Employee['role'], assignment, loginId };
          await setDoc(employeeDocRef, updatedData, { merge: true });
          toast({ title: "Employee updated", description: `"${name}" has been updated.` });
        } else { // Create
          const normalizedLoginId = loginId.toLowerCase().trim();
          const email = `${normalizedLoginId}@${auth.app.options.authDomain}`;
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const uid = userCredential.user.uid;

          const newEmployee: Omit<Employee, 'id' | 'password'> = {
            name,
            bengaliName,
            code,
            role: role as Employee['role'],
            assignment,
            loginId,
          };
          
          await setDoc(doc(firestore, "employees", uid), newEmployee);
          toast({ title: "Employee created", description: `"${name}" has been added.` });
        }
        handleDialogClose();
      } catch (error: any) {
        console.error("Form submission error:", error);
        toast({
          variant: "destructive",
          title: "An error occurred",
          description: error.message || "Could not save employee.",
        });
      }
    };

    return (
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleDialogClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'Edit Employee' : 'Create New Employee'}</DialogTitle>
            <DialogDescription>
              {editingEmployee ? 'Update the details of the employee.' : 'Add a new employee to your organization.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">
                Name (English)
              </Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., John Doe" />
            </div>
             <div className="grid gap-2">
              <Label htmlFor="bengaliName">
                Name (Bengali)
              </Label>
              <Input id="bengaliName" value={bengaliName} onChange={(e) => setBengaliName(e.target.value)} placeholder="e.g., জন ডো" />
            </div>
             <div className="grid gap-2">
              <Label htmlFor="code">
                Employee Code
              </Label>
              <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., E-007" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">
                Role
              </Label>
              <Select onValueChange={(value) => setRole(value as Employee['role'])} value={role}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="assignment">
                Assignment
              </Label>
              <Select onValueChange={setAssignment} value={assignment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select assignment" />
                </SelectTrigger>
                <SelectContent>
                  {assignments.map(a => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
             <div className="grid gap-2">
              <Label htmlFor="loginId">
                Login ID
              </Label>
              <Input id="loginId" value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="e.g., johndoe" disabled={!!editingEmployee} />
            </div>
             <div className="grid gap-2">
              <Label htmlFor="password">
                Password
              </Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={editingEmployee ? "Leave blank to keep unchanged" : "Set a password"} />
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
    <>
      <Card>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Employees</CardTitle>
            <CardDescription>Manage staff and their roles.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="gap-1" onClick={handleDownloadTemplate}>
                    <FileDown className="h-4 w-4" />
                    Download
                </Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={handleUploadClick} disabled={isProcessingUpload}>
                  {isProcessingUpload ? 'Processing...' : (
                    <>
                      <FileUp className="h-4 w-4" />
                      Upload
                    </>
                  )}
                </Button>
                {currentUser?.role === 'Super Admin' && (
                  <Button size="sm" variant="destructive" className="gap-1" onClick={() => setIsDeleteAllOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                    Delete All
                  </Button>
                )}
              <Button size="sm" className="gap-1" onClick={handleAddNewClick}>
                  <PlusCircle className="h-4 w-4" />
                  New Employee
              </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading employees...</p>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee Name</TableHead>
                <TableHead>Bengali Name</TableHead>
                <TableHead className="hidden md:table-cell">Employee Code</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Assignment</TableHead>
                <TableHead className="hidden md:table-cell">Login ID</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.name}</TableCell>
                  <TableCell>{employee.bengaliName}</TableCell>
                  <TableCell className="hidden md:table-cell">{employee.code}</TableCell>
                  <TableCell>{employee.role}</TableCell>
                  <TableCell>{employee.assignment}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-1">
                      <span>{employee.loginId}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleCopy(employee.loginId)}
                      >
                        <Copy className="h-3 w-3" />
                        <span className="sr-only">Copy Login ID</span>
                      </Button>
                    </div>
                  </TableCell>
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
                        <DropdownMenuItem onSelect={() => handleEditClick(employee)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleDeleteClick(employee)} className="text-destructive focus:bg-destructive/30 focus:text-destructive-foreground">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      {isDialogOpen && <FormDialog />}

       <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-4xl">
            <DialogHeader>
                <DialogTitle>Confirm Upload</DialogTitle>
                <DialogDescription>
                    {isUploading ? "Uploading employees... Please do not close this window." :
                     uploadErrors.length > 0 ? 'Please fix the errors and re-upload.' : 'Review the data below. Click "Confirm" to create new employee accounts.'
                    }
                </DialogDescription>
            </DialogHeader>
            {isUploading ? (
                 <div className="flex flex-col items-center justify-center gap-4 py-8">
                    <p>Creating {uploadedEmployees.length} employee(s)...</p>
                    <Progress value={uploadProgress} className="w-full" />
                 </div>
            ) : uploadErrors.length > 0 ? (
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
                                <TableHead>Role</TableHead>
                                <TableHead>Assignment</TableHead>
                                <TableHead>Login ID</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {uploadedEmployees.map((emp, index) => (
                                <TableRow key={index}>
                                    <TableCell>{emp.name}</TableCell>
                                    <TableCell>{emp.code}</TableCell>
                                    <TableCell>{emp.role}</TableCell>
                                    <TableCell>{emp.assignment}</TableCell>
                                    <TableCell>{emp.loginId}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            )}
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)} disabled={isUploading}>Cancel</Button>
                <Button onClick={handleConfirmUpload} disabled={isUploading || uploadErrors.length > 0 || uploadedEmployees.length === 0}>
                  {isUploading ? 'Uploading...' : 'Confirm Upload'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!employeeToDelete} onOpenChange={() => setEmployeeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the employee
              "{employeeToDelete?.name}". The associated login will remain, but will not have access.
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
              This action cannot be undone. This will permanently delete ALL employees except for the Super Admin user.
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

    