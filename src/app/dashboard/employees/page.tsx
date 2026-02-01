
"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import type { Employee, Branch, Area, Zone, Region } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit, FileDown, FileUp, Trash2, Mail } from 'lucide-react';
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
    
    const regionsQuery = useMemoFirebase(() => collection(firestore, 'regions'), [firestore]);
    const { data: regionsData, isLoading: regionsLoading } = useCollection<Region>(regionsQuery);

    const zonesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'zones')) : null, [firestore]);
    const { data: zonesData, isLoading: zonesLoading } = useCollection<Zone>(zonesQuery);
    
    const areasQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'areas')) : null, [firestore]);
    const { data: areasData, isLoading: areasLoading } = useCollection<Area>(areasQuery);

    const branchesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'branches')) : null, [firestore]);
    const { data: branchesData, isLoading: branchesLoading } = useCollection<Branch>(branchesQuery);
    

    const employees = useMemo(() => employeesData?.filter(e => e.role !== 'Super Admin') || [], [employeesData]);
    
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

    const isLoading = employeesLoading || branchesLoading || areasLoading || zonesLoading || regionsLoading;

     const assignmentMaps = useMemo(() => {
        return {
            regions: new Map(regionsData?.map(r => [r.id, r.name])),
            zones: new Map(zonesData?.map(z => [z.id, z.name])),
            areas: new Map(areasData?.map(a => [a.id, a.name])),
            branches: new Map(branchesData?.map(b => [b.id, b.name])),
        };
    }, [regionsData, zonesData, areasData, branchesData]);

    const getAssignmentName = (employee: Employee): string => {
        if (employee.assignment === 'Head Office') return 'Head Office';
        if (!employee.assignment) return 'N/A';

        switch (employee.role) {
            case 'Regional User': return assignmentMaps.regions.get(employee.assignment) || 'Unknown';
            case 'Zonal User': return assignmentMaps.zones.get(employee.assignment) || 'Unknown';
            case 'Area User': return assignmentMaps.areas.get(employee.assignment) || 'Unknown';
            case 'Branch User': return assignmentMaps.branches.get(employee.assignment) || 'Unknown';
            default: return 'N/A';
        }
    };
    
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
            "Assignment Name": "Name of the Region/Zone/Area/Branch",
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
        const existingCodes = new Set(employeesData?.filter(e => e.code).map(e => e.code.toLowerCase()));
        const existingEmails = new Set(employeesData?.filter(e => e.email).map(e => e.email.toLowerCase()));
        const fileCodes = new Set<string>();
        const fileEmails = new Set<string>();
        
        const assignmentNameMaps = {
            'Regional User': new Map(regionsData?.map(r => [r.name.toLowerCase(), r.id])),
            'Zonal User': new Map(zonesData?.map(z => [z.name.toLowerCase(), z.id])),
            'Area User': new Map(areasData?.map(a => [a.name.toLowerCase(), a.id])),
            'Branch User': new Map(branchesData?.map(b => [b.name.toLowerCase(), b.id])),
        };

        jsonData.forEach((row, index) => {
            const { 'Name': name, 'Bengali Name': bengaliName, 'Code': code, 'Email': email, 'Password': password, 'Role': role, 'Assignment Name': assignmentName } = row;
            const rowIndex = index + 2;

            if (!name || !code || !role || !assignmentName || !email || !password) {
                errors.push(`Row ${rowIndex}: Missing required fields.`);
                return;
            }
            if (!ROLES.includes(role)) {
                errors.push(`Row ${rowIndex}: Invalid role "${role}".`);
                return;
            }

            let assignmentId: string | undefined = undefined;
            if (role === 'Head Office' || role === 'Super Admin') {
                if (assignmentName.toLowerCase() === 'head office') {
                    assignmentId = 'Head Office';
                }
            } else {
                const nameMap = assignmentNameMaps[role as keyof typeof assignmentNameMaps];
                if (nameMap) {
                    assignmentId = nameMap.get(String(assignmentName).toLowerCase().trim());
                }
            }

            if (!assignmentId) {
                 errors.push(`Row ${rowIndex}: Invalid assignment "${assignmentName}" for role "${role}".`);
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
            validEmployees.push({ name, bengaliName: bengaliName || '', code: String(code).trim(), email, password, role, assignment: assignmentId });
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
                        <Button size="sm" variant="outline" className="gap-1" onClick={handleDownloadTemplate}><FileDown />Download</Button>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => fileInputRef.current?.click()} disabled={uploadState.status === 'validating'}><FileUp />{uploadState.status === 'validating' ? 'Processing...' : 'Upload'}</Button>
                        <Button size="sm" variant="destructive" className="gap-1" onClick={() => setIsDeleteAllOpen(true)}><Trash2 />Delete All</Button>
                        <Button size="sm" className="gap-1" onClick={handleAddNew}><PlusCircle />New Employee</Button>
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
                                        <TableCell>{getAssignmentName(emp)}</TableCell>
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
                firestore={firestore}
                existingUsers={employeesData || []}
                regions={regionsData || []}
                zones={zonesData || []}
                areas={areasData || []}
                branches={branchesData || []}
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

function FormDialog({ isOpen, onClose, employee, roles, firestore, existingUsers, regions, zones, areas, branches }: any) {
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [bengaliName, setBengaliName] = useState('');
    const [code, setCode] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<Employee['role'] | ''>('');
    const [assignment, setAssignment] = useState('');
    const [showPasswordReset, setShowPasswordReset] = useState(false);
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
    
     useEffect(() => {
        if (employee?.role !== role) {
            setAssignment(''); // Reset assignment if role changes
        }
     }, [role, employee]);

    const handleSendPasswordReset = async () => {
        if (!email) return;
        setIsSendingReset(true);
        const auth = getAuth();
        try {
            await sendPasswordResetEmail(auth, email);
            toast({
                title: "Password Reset Email Sent",
                description: `An email has been sent to ${email} with instructions.`
            });
            setShowPasswordReset(false);
        } catch (error: any) {
             toast({
                variant: "destructive",
                title: "Failed to Send Email",
                description: error.message
            });
        } finally {
            setIsSendingReset(false);
        }
    };

    const handleSubmit = async () => {
        let finalAssignment = assignment;
        if (role === 'Head Office' || role === 'Super Admin') {
            finalAssignment = 'Head Office';
        }

        if (!name || !code || !role || !finalAssignment || !email) {
            toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields." });
            return;
        }

        if (employee) { // Update existing employee
            const updatedData: Partial<Employee> = { name, bengaliName, code, role: role as Employee['role'], assignment: finalAssignment, email };
            await setDoc(doc(firestore, 'employees', employee.id), updatedData, { merge: true });
            toast({ title: "Employee updated" });
            onClose();
        } else { // Create new employee
            if (!password || password.length < 6) {
                toast({ variant: "destructive", title: "Validation Error", description: "Password must be at least 6 characters long." });
                return;
            }
             if (existingUsers.some((u: Employee) => u.email && u.email.toLowerCase() === email.toLowerCase())) {
                toast({ variant: "destructive", title: "Email exists", description: "This email is already in use." });
                return;
            }
             if (existingUsers.some((u: Employee) => u.code && u.code.toLowerCase() === code.toLowerCase())) {
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
                    assignment: finalAssignment,
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
    
    const renderAssignmentDropdown = () => {
        const commonProps = {
            onValueChange: setAssignment,
            value: assignment
        };

        switch(role) {
            case 'Regional User':
                return <Select {...commonProps}><SelectTrigger><SelectValue placeholder="Select a region"/></SelectTrigger><SelectContent>{regions.map((r: Region) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select>
            case 'Zonal User':
                 return <Select {...commonProps}><SelectTrigger><SelectValue placeholder="Select a zone"/></SelectTrigger><SelectContent>{zones.map((z: Zone) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent></Select>
            case 'Area User':
                 return <Select {...commonProps}><SelectTrigger><SelectValue placeholder="Select an area"/></SelectTrigger><SelectContent>{areas.map((a: Area) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select>
            case 'Branch User':
                 return <Select {...commonProps}><SelectTrigger><SelectValue placeholder="Select a branch"/></SelectTrigger><SelectContent>{branches.map((b: Branch) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
            case 'Head Office':
            case 'Super Admin':
                return <Input value="Head Office" disabled />
            default:
                return <Input value="Select a role first" disabled />
        }
    }


    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{employee ? 'Edit Employee' : 'Create New Employee'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                    <Label>Name (English)</Label><Input value={name} onChange={(e) => setName(e.target.value)} />
                    <Label>Name (Bengali)</Label><Input value={bengaliName} onChange={(e) => setBengaliName(e.target.value)} />
                    <Label>Email (Login ID)</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!employee} />
                    {!employee && (<><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></>)}
                    <Label>Employee Code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} />
                    <Label>Role</Label>
                    <Select onValueChange={(v) => setRole(v as Employee['role'])} value={role}>
                        <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                        <SelectContent>{roles.map((r: string) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                    <Label>Assignment</Label>
                    {renderAssignmentDropdown()}
                </div>

                {employee && (
                    <div className="border-t pt-4">
                        <p className="text-sm font-medium">Manage Password</p>
                        <p className="text-xs text-muted-foreground pb-2">You cannot directly change a user's password. You can send them a password reset link to their email address ({employee.email}).</p>
                        <Button variant="outline" size="sm" onClick={() => setShowPasswordReset(true)}><Mail className="mr-2 h-4 w-4"/>Send Password Reset Email</Button>
                    </div>
                )}
                
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit}>Save</Button>
                </DialogFooter>

                 <AlertDialog open={showPasswordReset} onOpenChange={setShowPasswordReset}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirm Password Reset</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will send a password reset link to <span className="font-semibold">{employee?.email}</span>. The employee must click the link in the email to set a new password.
                                <br/><br/>
                                Please advise the employee to check their spam/junk folder if they do not receive it.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isSendingReset}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleSendPasswordReset} disabled={isSendingReset}>
                                {isSendingReset ? 'Sending...' : 'Send Email'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
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
                            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Code</TableHead><TableHead>Role</TableHead><TableHead>Assignment ID</TableHead></TableRow></TableHeader>
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
