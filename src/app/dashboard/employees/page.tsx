
"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
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
import { firebaseConfig } from '@/firebase/config';
import { collection, doc, setDoc, deleteDoc, writeBatch, getDocs, collectionGroup, query } from 'firebase/firestore';
import { getAuth as getFirebaseAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import * as XLSX from 'xlsx';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';

// --- Constants and Types ---
const ROLES: Employee['role'][] = ['Branch User', 'Area User', 'Zonal User', 'Regional User', 'Head Office'];

// --- Helper Functions ---

/**
 * Creates a user and their profile without affecting the current admin's session.
 * Uses a secondary Firebase app instance for isolation.
 */
async function createIsolatedUser(employeeData: any, firestore: any, authDomain: string) {
    const tempApp = initializeApp(firebaseConfig, `employee-creator-${Date.now()}-${Math.random()}`);
    try {
        const tempAuth = getFirebaseAuth(tempApp);
        const email = `${employeeData.loginId}@${authDomain}`;
        
        const userCredential = await createUserWithEmailAndPassword(tempAuth, email, employeeData.password);
        const uid = userCredential.user.uid;

        const newEmployee: Omit<Employee, 'id' | 'password'> = {
            name: employeeData.name,
            bengaliName: employeeData.bengaliName,
            code: employeeData.code,
            role: employeeData.role,
            assignment: employeeData.assignment,
            loginId: employeeData.loginId,
        };
        // The employee ID in Firestore MUST match the auth UID
        await setDoc(doc(firestore, "employees", uid), newEmployee);
    } finally {
        // Ensure the temporary app is cleaned up
        await deleteApp(tempApp);
    }
}


export default function EmployeesPage() {
    // --- Hooks ---
    const { toast } = useToast();
    const { currentUser } = useAuth();
    const firestore = useFirestore();
    const auth = useAuth().firebaseUser?.auth;
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
            await deleteDoc(doc(firestore, "employees", employeeToDelete.id));
            toast({ title: "Employee Record Deleted", description: `"${employeeToDelete.name}" has been removed.` });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Deletion Failed", description: error.message });
        } finally {
            setEmployeeToDelete(null);
        }
    };
    
    const confirmDeleteAll = async () => {
        if (currentUser?.role !== 'Super Admin' || !employeesData) return;
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
            toast({ title: `All ${employeesToDelete.length} employee records deleted.` });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error Deleting Employees", description: error.message });
        } finally {
            setIsDeleteAllOpen(false);
        }
    };

    const handleDownloadTemplate = () => {
        const templateData = [{
            "Name": "", "Bengali Name": "", "Code": "",
            "Role": "Branch User | Area User | Zonal User | Regional User | Head Office",
            "Assignment (Branch Name or 'Head Office')": "", "Login ID": "", "Password": ""
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
        const existingLoginIds = new Set(employeesData?.map(e => e.loginId.toLowerCase()));
        const fileLoginIds = new Set<string>();
        const validAssignments = new Set(assignments);

        jsonData.forEach((row, index) => {
            const { 'Name': name, 'Bengali Name': bengaliName, 'Code': code, 'Role': role, 'Assignment (Branch Name or \'Head Office\')': assignment, 'Login ID': loginId, 'Password': password } = row;
            const rowIndex = index + 2;

            if (!name || !code || !role || !assignment || !loginId || !password) {
                errors.push(`Row ${rowIndex}: Missing required fields.`);
                return;
            }
            if (String(password).length < 6) {
                errors.push(`Row ${rowIndex}: Password for ${loginId} must be at least 6 characters.`);
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

            const normalizedLoginId = String(loginId).toLowerCase().trim();
            if (existingLoginIds.has(normalizedLoginId)) {
                errors.push(`Row ${rowIndex}: Login ID "${loginId}" already exists in the database.`);
                return;
            }
            if (fileLoginIds.has(normalizedLoginId)) {
                errors.push(`Row ${rowIndex}: Duplicate Login ID "${loginId}" found in the file.`);
                return;
            }
            
            fileLoginIds.add(normalizedLoginId);
            validEmployees.push({ name, bengaliName, code, role, assignment, loginId: normalizedLoginId, password });
        });

        return { validEmployees, errors };
    };

    const handleConfirmUpload = async () => {
        if (uploadState.data.length === 0 || !auth?.app.options.authDomain) {
            toast({ variant: 'destructive', title: 'Upload Failed', description: 'No valid data or auth not configured.' });
            return;
        }

        setUploadState(s => ({ ...s, status: 'uploading' }));
        let successCount = 0;
        const creationErrors: string[] = [];

        for (let i = 0; i < uploadState.data.length; i++) {
            const empData = uploadState.data[i];
            try {
                await createIsolatedUser(empData, firestore, auth.app.options.authDomain);
                successCount++;
            } catch (error: any) {
                const message = error.code === 'auth/email-already-in-use' ? 'This Login ID is already registered in Firebase Auth.' : error.message;
                creationErrors.push(`Failed for ${empData.loginId}: ${message}`);
            }
            setUploadState(s => ({ ...s, progress: ((i + 1) / s.data.length) * 100 }));
        }

        if (creationErrors.length > 0) {
            toast({ variant: 'destructive', title: 'Upload Partially Failed', description: `${successCount} created. ${creationErrors.length} failed.` });
            setUploadState(s => ({ ...s, status: 'preview', errors: creationErrors }));
        } else {
            toast({ title: 'Upload Successful', description: `${successCount} employees created.` });
            setIsUploadDialogOpen(false);
            setUploadState({ status: 'idle', data: [], errors: [], progress: 0 });
        }
    };
    
    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text).then(() => toast({ title: "Copied!", description: `Login ID "${text}" copied.` }));
    };

    // --- Render ---
    return (
        <>
            <Card>
                <input type="file" ref={fileInputRef} onChange={handleFileSelected} className="hidden" accept=".xlsx, .xls" />
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>Employees</CardTitle>
                        <CardDescription>Manage staff and their roles.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={handleDownloadTemplate}><FileDown />Download</Button>
                        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadState.status === 'validating'}><FileUp />{uploadState.status === 'validating' ? 'Processing...' : 'Upload'}</Button>
                        {currentUser?.role === 'Super Admin' && (<Button size="sm" variant="destructive" onClick={() => setIsDeleteAllOpen(true)}><Trash2 />Delete All</Button>)}
                        <Button size="sm" onClick={handleAddNew}><PlusCircle />New Employee</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? <p>Loading employees...</p> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Bengali Name</TableHead>
                                    <TableHead className="hidden md:table-cell">Code</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Assignment</TableHead>
                                    <TableHead className="hidden md:table-cell">Login ID</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {employees.map((emp) => (
                                    <TableRow key={emp.id}>
                                        <TableCell className="font-medium">{emp.name}</TableCell>
                                        <TableCell>{emp.bengaliName}</TableCell>
                                        <TableCell className="hidden md:table-cell">{emp.code}</TableCell>
                                        <TableCell>{emp.role}</TableCell>
                                        <TableCell>{emp.assignment}</TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            <div className="flex items-center gap-1">
                                                <span>{emp.loginId}</span>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(emp.loginId)}><Copy className="h-3 w-3" /></Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onSelect={() => handleEdit(emp)}>Edit</DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => handleDelete(emp)} className="text-destructive">Delete</DropdownMenuItem>
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

            {isFormOpen && (
                <FormDialog
                    isOpen={isFormOpen}
                    setIsOpen={setIsFormOpen}
                    employee={editingEmployee}
                    roles={ROLES}
                    assignments={assignments}
                    firestore={firestore}
                    authDomain={auth?.app.options.authDomain}
                    existingLoginIds={new Set(employeesData?.map(e => e.loginId.toLowerCase()))}
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
                            This will delete the employee record for "{employeeToDelete?.name}". 
                            For security reasons, the user's login account will NOT be deleted. To permanently prevent login, please contact support to have the authentication account removed.
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
                            This will permanently delete all employee records from the database, except for Super Admins. This action cannot be undone.
                            <br/><br/>
                            <span className="font-semibold">Note:</span> This does not delete their login accounts.
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

function FormDialog({ isOpen, setIsOpen, employee, roles, assignments, firestore, authDomain, existingLoginIds }: any) {
    const { toast } = useToast();
    const [name, setName] = useState(employee?.name || '');
    const [bengaliName, setBengaliName] = useState(employee?.bengaliName || '');
    const [code, setCode] = useState(employee?.code || '');
    const [role, setRole] = useState<Employee['role'] | ''>(employee?.role || '');
    const [assignment, setAssignment] = useState(employee?.assignment || '');
    const [loginId, setLoginId] = useState(employee?.loginId || '');
    const [password, setPassword] = useState('');

    const handleSubmit = async () => {
        if (!name || !code || !role || !assignment || !loginId || (!employee && !password)) {
            toast({ variant: "destructive", title: "Validation Error", description: "Please fill all fields." });
            return;
        }
        
        const normalizedLoginId = loginId.toLowerCase().trim();
        if (!employee && existingLoginIds.has(normalizedLoginId)) {
            toast({ variant: "destructive", title: "Login ID exists", description: "This Login ID is already in use. Please choose another." });
            return;
        }

        try {
            if (employee) { // Update
                const updatedData: Partial<Employee> = { name, bengaliName, code, role: role as Employee['role'], assignment };
                await setDoc(doc(firestore, 'employees', employee.id), updatedData, { merge: true });
                toast({ title: "Employee updated" });
            } else { // Create
                if (!authDomain) {
                    toast({ variant: "destructive", title: "Auth Error", description: "Auth domain not configured." });
                    return;
                }
                const newEmployeeData = { name, bengaliName, code, role, assignment, loginId: normalizedLoginId, password };
                await createIsolatedUser(newEmployeeData, firestore, authDomain);
                toast({ title: "Employee created" });
            }
            setIsOpen(false);
        } catch (error: any) {
            const message = error.code === 'auth/email-already-in-use' ? 'This Login ID is already registered in Firebase Auth.' : error.message;
            toast({ variant: "destructive", title: "An error occurred", description: message });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{employee ? 'Edit Employee' : 'Create New Employee'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                    <Label>Name (English)</Label><Input value={name} onChange={(e) => setName(e.target.value)} />
                    <Label>Name (Bengali)</Label><Input value={bengaliName} onChange={(e) => setBengaliName(e.target.value)} />
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
                    <Label>Login ID</Label><Input value={loginId} onChange={(e) => setLoginId(e.target.value)} disabled={!!employee} />
                    <Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={employee ? "Leave blank to keep unchanged" : "Set password"} />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
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
                         'Review the data below. Click "Confirm" to create new employee accounts.'}
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
                            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Role</TableHead><TableHead>Assignment</TableHead><TableHead>Login ID</TableHead></TableRow></TableHeader>
                            <TableBody>{state.data.map((emp: any, index: number) => (<TableRow key={index}><TableCell>{emp.name}</TableCell><TableCell>{emp.code}</TableCell><TableCell>{emp.role}</TableCell><TableCell>{emp.assignment}</TableCell><TableCell>{emp.loginId}</TableCell></TableRow>))}</TableBody>
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

    