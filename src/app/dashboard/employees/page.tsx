
"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import type { Employee, Branch } from '@/lib/data';
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
import { useCollection, useFirestore, useMemoFirebase, useAuth } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, writeBatch, getDocs, collectionGroup, query } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { firebaseConfig } from '@/firebase/config';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

// --- Constants and Types ---
const ROLES: Employee['role'][] = ['Branch User', 'Area User', 'Zonal User', 'Regional User', 'Head Office', 'Super Admin'];


export default function EmployeesPage() {
    // --- Hooks ---
    const { toast } = useToast();
    const firestore = useFirestore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // --- Data Fetching ---
    const employeesQuery = useMemoFirebase(() => collection(firestore, 'employees'), [firestore]);
    const { data: employeesData, isLoading: employeesLoading } = useCollection<Employee>(employeesQuery);
    
    const branchesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'branches')) : null, [firestore]);
    const { data: branchesData, isLoading: branchesLoading } = useCollection<Branch>(branchesQuery);

    const employees = useMemo(() => employeesData?.filter(e => e.role !== 'Super Admin') || [], [employeesData]);
    const assignments = useMemo(() => ['Head Office', ...(branchesData?.map(b => b.name) || [])], [branchesData]);
    
    // --- State Management ---
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
    const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
    
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
    const [uploadState, setUploadState] = useState<{
        status: 'idle' | 'validating' | 'preview' | 'uploading';
        data: any[];
        errors: string[];
        progress: number;
    }>({ status: 'idle', data: [], errors: [], progress: 0 });

    const isLoading = employeesLoading || branchesLoading;
    
    // --- Core Functions ---
    const handleAddNew = () => {
        setEditingEmployee(null);
        setIsFormOpen(true);
    };

    const handleEdit = (employee: Employee) => {
        setEditingEmployee(employee);
        setIsFormOpen(true);
    };
    
    const handleDelete = (employee: Employee) => {
        setEmployeeToDelete(employee);
    };
    
    const confirmDelete = async () => {
        if (!employeeToDelete) return;
        try {
            // Note: This only deletes the Firestore record. The Firebase Auth user is not deleted.
            // Deleting auth users requires admin privileges not available in the client SDK.
            await deleteDoc(doc(firestore, "employees", employeeToDelete.id));
            toast({ title: "Employee Record Deleted", description: `"${employeeToDelete.name}" has been removed. Their login has not been disabled.` });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Deletion Failed", description: error.message });
        } finally {
            setEmployeeToDelete(null);
        }
    };
    
    const confirmDeleteAll = async () => {
        if (!employeesData) return;
        try {
            const employeesToDelete = employeesData.filter(e => e.role !== 'Super Admin');
            if(employeesToDelete.length === 0) {
                 toast({ title: "No employee records to delete." });
                 setIsDeleteAllOpen(false);
                 return;
            }
            const batch = writeBatch(firestore);
            employeesToDelete.forEach(emp => batch.delete(doc(firestore, "employees", emp.id)));
            await batch.commit();
            toast({ title: `All ${employeesToDelete.length} employee records deleted. Their logins have not been disabled.` });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error Deleting Employees", description: error.message });
        } finally {
            setIsDeleteAllOpen(false);
        }
    };

    const handleDownloadTemplate = () => {
        const templateData = [{
            "Name": "", "Bengali Name": "", "Code": "", "Email": "", "Password": "",
            "Role": "Branch User | Area User | Zonal User | Regional User | Head Office",
            "Assignment (Branch Name or 'Head Office')": "",
        }];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Employees");
        XLSX.writeFile(wb, "EmployeesTemplate.xlsx");
        toast({ title: "Template Downloaded" });
    };

    const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploadState({ status: 'validating', data: [], errors: [], progress: 0 });
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const ws = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData: any[] = XLSX.utils.sheet_to_json(ws);
                
                const { validEmployees, errors } = validateUploadData(jsonData);
                
                setUploadState(s => ({ ...s, status: 'preview', data: validEmployees, errors: errors }));
                setIsUploadDialogOpen(true);
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error processing file' });
                setUploadState({ status: 'idle', data: [], errors: [], progress: 0 });
            }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = ''; // Reset file input
    };
    
    const validateUploadData = (jsonData: any[]) => {
        const errors: string[] = [];
        const validEmployees: any[] = [];
        const existingCodes = new Set(employeesData?.map(e => e.code.toLowerCase()));
        const existingEmails = new Set(employeesData?.map(e => e.email.toLowerCase()));
        const fileCodes = new Set<string>();
        const fileEmails = new Set<string>();
        const validAssignments = new Set(assignments);

        jsonData.forEach((row, index) => {
            const { 'Name': name, 'Bengali Name': bengaliName, 'Code': code, 'Email': email, 'Password': password, 'Role': role, 'Assignment (Branch Name or \'Head Office\')': assignment } = row;
            const rowIndex = index + 2;

            if (!name || !code || !role || !assignment || !email || !password) {
                errors.push(`Row ${rowIndex}: Missing required fields.`);
                return;
            }
            if (!ROLES.includes(role)) {
                errors.push(`Row ${rowIndex}: Invalid role "${role}".`);
                return;
            }
            if (!validAssignments.has(assignment)) {
                errors.push(`Row ${rowIndex}: Invalid assignment "${assignment}".`);
                return;
            }

            const normalizedCode = String(code).toLowerCase().trim();
            if (existingCodes.has(normalizedCode) || fileCodes.has(normalizedCode)) {
                errors.push(`Row ${rowIndex}: Employee Code "${code}" already exists.`);
                return;
            }
            
            const normalizedEmail = String(email).toLowerCase().trim();
            if (existingEmails.has(normalizedEmail) || fileEmails.has(normalizedEmail)) {
                 errors.push(`Row ${rowIndex}: Email "${email}" already exists.`);
                return;
            }
            
            fileCodes.add(normalizedCode);
            fileEmails.add(normalizedEmail);
            validEmployees.push({ name, bengaliName: bengaliName || '', code: String(code).trim(), email, password, role, assignment });
        });

        return { validEmployees, errors };
    };

    const handleConfirmUpload = async () => {
        if (uploadState.data.length === 0) {
            toast({ variant: 'destructive', title: 'Upload Failed', description: 'No valid data to upload.' });
            return;
        }

        setUploadState(s => ({ ...s, status: 'uploading', progress: 0 }));

        for (let i = 0; i < uploadState.data.length; i++) {
            const empData = uploadState.data[i];
            const tempApp = initializeApp(firebaseConfig, `temp-user-creation-${Date.now()}`);
            const tempAuth = getAuth(tempApp);
            
            try {
                // Create auth user
                const userCredential = await createUserWithEmailAndPassword(tempAuth, empData.email, empData.password);
                const uid = userCredential.user.uid;

                // Create Firestore doc
                const newDocRef = doc(collection(firestore, "employees"));
                const newEmployee: Employee = {
                    id: newDocRef.id,
                    uid: uid,
                    email: empData.email,
                    name: empData.name,
                    bengaliName: empData.bengaliName,
                    code: empData.code,
                    role: empData.role,
                    assignment: empData.assignment,
                };
                await setDoc(newDocRef, newEmployee);
                
                setUploadState(s => ({ ...s, progress: ((i + 1) / s.data.length) * 100 }));

            } catch (error: any) {
                toast({ variant: 'destructive', title: `Error on row ${i+2}`, description: error.message });
                // Stop the upload on first error
                setUploadState(s => ({ ...s, status: 'preview' }));
                await deleteApp(tempApp);
                return;
            } finally {
                await deleteApp(tempApp);
            }
        }
        
        toast({ title: 'Upload Successful', description: `${uploadState.data.length} employees created.` });
        setIsUploadDialogOpen(false);
        setUploadState({ status: 'idle', data: [], errors: [], progress: 0 });
    };
    
    // --- Render ---
    return (
        <>
            <Card>
                <input type="file" ref={fileInputRef} onChange={handleFileSelected} className="hidden" accept=".xlsx, .xls" />
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>Employees</CardTitle>
                        <CardDescription>Manage staff, their roles, and their login credentials.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={handleDownloadTemplate}><FileDown />Download</Button>
                        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadState.status === 'validating'}><FileUp />{uploadState.status === 'validating' ? 'Processing...' : 'Upload'}</Button>
                        <Button size="sm" variant="destructive" onClick={() => setIsDeleteAllOpen(true)}><Trash2 />Delete All</Button>
                        <Button size="sm" onClick={handleAddNew}><PlusCircle />New Employee</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? <p>Loading employees...</p> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Assignment</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {employees.map((emp) => (
                                    <TableRow key={emp.id}>
                                        <TableCell className="font-medium">{emp.name}</TableCell>
                                        <TableCell className="text-muted-foreground">{emp.email}</TableCell>
                                        <TableCell>{emp.code}</TableCell>
                                        <TableCell>{emp.role}</TableCell>
                                        <TableCell>{emp.assignment}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(emp)}>
                                                    <Edit className="h-4 w-4" />
                                                    <span className="sr-only">Edit</span>
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(emp)} className="text-destructive hover:text-destructive">
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
            </Card>

            {isFormOpen && (
              <FormDialog
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                employee={editingEmployee}
                roles={ROLES}
                assignments={assignments}
                firestore={firestore}
                existingUsers={employeesData || []}
              />
            )}
            
            {isUploadDialogOpen && (
                <UploadDialog
                    isOpen={isUploadDialogOpen}
                    setIsOpen={setIsUploadDialogOpen}
                    state={uploadState}
                    onConfirm={handleConfirmUpload}
                />
            )}

            <AlertDialog open={!!employeeToDelete} onOpenChange={() => setEmployeeToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will delete the employee record for "{employeeToDelete?.name}". This action does not disable their login. 
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete Record</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <AlertDialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete all employee records from the database, except for Super Admins. This action cannot be undone and does not disable their logins.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteAll} className="bg-destructive hover:bg-destructive/90">Yes, delete all records</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

// --- Sub-components ---

function FormDialog({ isOpen, onClose, employee, roles, assignments, firestore, existingUsers }: any) {
    const { toast } = useToast();
    const auth = useAuth();
    const [name, setName] = useState('');
    const [bengaliName, setBengaliName] = useState('');
    const [code, setCode] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<Employee['role'] | ''>('');
    const [assignment, setAssignment] = useState('');
    const [isSendingReset, setIsSendingReset] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setName(employee?.name || '');
            setBengaliName(employee?.bengaliName || '');
            setCode(employee?.code || '');
            setEmail(employee?.email || '');
            setPassword('');
            setRole(employee?.role || '');
            setAssignment(employee?.assignment || '');
        }
    }, [employee, isOpen]);
    
    const handlePasswordReset = async () => {
      if (!email) {
          toast({
              variant: "destructive",
              title: "Email Address Required",
              description: "Cannot send a password reset without an email address.",
          });
          return;
      }
      setIsSendingReset(true);
      try {
          await sendPasswordResetEmail(auth, email);
          toast({
              title: "Password Reset Email Sent",
              description: `A password reset link has been sent to ${email}.`,
          });
      } catch (error: any) {
          toast({
              variant: "destructive",
              title: "Error Sending Email",
              description: error.message,
          });
      } finally {
          setIsSendingReset(false);
      }
    };

    const handleSubmit = async () => {
        if (!name || !code || !role || !assignment || !email) {
            toast({ variant: "destructive", title: "Validation Error", description: "Please fill all fields." });
            return;
        }

        if (employee) { // Update existing employee
            const updatedData: Partial<Employee> = { name, bengaliName, code, role: role as Employee['role'], assignment, email };
            await setDoc(doc(firestore, 'employees', employee.id), updatedData, { merge: true });
            toast({ title: "Employee updated" });
            onClose();
        } else { // Create new employee
            if (!password || password.length < 6) {
                toast({ variant: "destructive", title: "Validation Error", description: "Password must be at least 6 characters long." });
                return;
            }
            if (existingUsers.some((u: Employee) => u.email.toLowerCase() === email.toLowerCase())) {
                toast({ variant: "destructive", title: "Email exists", description: "This email is already in use." });
                return;
            }
             if (existingUsers.some((u: Employee) => u.code.toLowerCase() === code.toLowerCase())) {
                toast({ variant: "destructive", title: "Employee Code exists", description: "This code is already in use." });
                return;
            }

            const tempApp = initializeApp(firebaseConfig, `temp-user-creation-${Date.now()}`);
            const tempAuth = getAuth(tempApp);

            try {
                // 1. Create Auth user
                const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
                const uid = userCredential.user.uid;

                // 2. Create Firestore document
                const newDocRef = doc(collection(firestore, "employees"));
                const newEmployee: Employee = {
                    id: newDocRef.id,
                    uid,
                    email,
                    name,
                    bengaliName,
                    code,
                    role: role as Employee['role'],
                    assignment,
                };
                await setDoc(newDocRef, newEmployee);
                toast({ title: "Employee created successfully" });
                onClose();
            } catch (error: any) {
                toast({ variant: "destructive", title: "Creation Failed", description: error.message });
            } finally {
                await deleteApp(tempApp);
            }
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{employee ? 'Edit Employee' : 'Create New Employee'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                    <Label>Name (English)</Label><Input value={name} onChange={(e) => setName(e.target.value)} />
                    <Label>Name (Bengali)</Label><Input value={bengaliName} onChange={(e) => setBengaliName(e.target.value)} />
                     <div className="space-y-1">
                        <Label>Email (Login ID)</Label>
                        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                         {employee && (
                            <p className="text-xs text-muted-foreground pt-1">
                                To change a user's login, you must delete and re-create their account. This only updates their contact email.
                            </p>
                        )}
                    </div>
                    
                    {!employee && (<><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></>)}

                    {employee && (
                      <div className="space-y-2 rounded-lg border bg-background/50 p-3 mt-2">
                        <h4 className="font-semibold text-sm text-foreground">Manage Password</h4>
                        <p className="text-xs text-muted-foreground">
                            For security, you cannot directly change a user's password. You can send them a secure link to reset it themselves.
                        </p>
                        <Button
                            variant="secondary"
                            className="mt-2"
                            size="sm"
                            type="button"
                            onClick={handlePasswordReset}
                            disabled={isSendingReset}
                        >
                            {isSendingReset ? 'Sending Email...' : 'Send Password Reset Email'}
                        </Button>
                      </div>
                    )}

                    <Label>Employee Code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} />
                    <Label>Role</Label>
                    <Select onValueChange={(v) => setRole(v as Employee['role'])} value={role}>
                        <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                        <SelectContent>{roles.map((r: string) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                    <Label>Assignment</Label>
                    <Select onValueChange={setAssignment} value={assignment}>
                        <SelectTrigger><SelectValue placeholder="Select assignment" /></SelectTrigger>
                        <SelectContent>{assignments.map((a: string) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function UploadDialog({ isOpen, setIsOpen, state, onConfirm }: any) {
    const isUploading = state.status === 'uploading';
    const hasErrors = state.errors.length > 0;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Confirm Upload</DialogTitle>
                    <DialogDescription>
                        {isUploading ? "Uploading employees... please wait." : 
                         hasErrors ? 'Please fix the errors in your file and re-upload.' : 
                         'Review the data below. Click "Confirm" to create new employee records.'}
                    </DialogDescription>
                </DialogHeader>

                {isUploading ? (
                    <div className="flex flex-col items-center justify-center gap-4 py-8">
                        <p>Creating {state.data.length} employee(s)...</p>
                        <Progress value={state.progress} className="w-full" />
                    </div>
                ) : hasErrors ? (
                    <div className="my-4 space-y-2 rounded-md bg-destructive/10 p-4">
                        <h3 className="font-semibold text-destructive">Upload Errors</h3>
                        <ScrollArea className="h-40"><ul className="list-disc pl-5 text-sm text-destructive">{state.errors.map((err: string, i: number) => <li key={i}>{err}</li>)}</ul></ScrollArea>
                    </div>
                ) : (
                    <ScrollArea className="h-64">
                        <Table>
                            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Code</TableHead><TableHead>Role</TableHead><TableHead>Assignment</TableHead></TableRow></TableHeader>
                            <TableBody>{state.data.map((emp: any, index: number) => (<TableRow key={index}><TableCell>{emp.name}</TableCell><TableCell>{emp.email}</TableCell><TableCell>{emp.code}</TableCell><TableCell>{emp.role}</TableCell><TableCell>{emp.assignment}</TableCell></TableRow>))}</TableBody>
                        </Table>
                    </ScrollArea>
                )}
                
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isUploading}>Cancel</Button>
                    <Button onClick={onConfirm} disabled={isUploading || hasErrors || state.data.length === 0}>{isUploading ? 'Uploading...' : 'Confirm Upload'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

    

    
