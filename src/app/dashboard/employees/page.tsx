"use client";

import { useState } from 'react';
import { employees as initialEmployees, branches } from '@/lib/data';
import type { Employee } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, MoreHorizontal, FileDown, FileUp, Copy } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function EmployeesPage() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState(initialEmployees.filter(e => e.role !== 'Super Admin'));
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const roles: Employee['role'][] = ['Branch User', 'Area User', 'Zonal User', 'Regional User', 'Head Office'];
  const assignments = ['Head Office', ...branches.map(b => b.name)];

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

  const confirmDelete = () => {
    if (employeeToDelete) {
      setEmployees(employees.filter(e => e.id !== employeeToDelete.id));
      toast({ title: "Employee deleted", description: `"${employeeToDelete.name}" has been deleted.` });
      setEmployeeToDelete(null);
    }
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

    const handleSubmit = () => {
      if (!name || !bengaliName || !code || !role || !assignment || !loginId || (!editingEmployee && !password)) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Please fill out all fields.",
        });
        return;
      }

      if (editingEmployee) { // Update
        const updatedEmployee: Employee = { ...editingEmployee, name, bengaliName, code, role: role as Employee['role'], assignment, loginId };
        setEmployees(employees.map(e => (e.id === editingEmployee.id ? updatedEmployee : e)));
        toast({ title: "Employee updated", description: `"${name}" has been updated.` });
      } else { // Create
        const newEmployee: Employee = {
          id: `E${String(initialEmployees.length + 1).padStart(3, '0')}`,
          name,
          bengaliName,
          code,
          role: role as Employee['role'],
          assignment,
          loginId,
        };
        setEmployees([...employees, newEmployee]);
        toast({ title: "Employee created", description: `"${name}" has been added.` });
      }
      handleDialogClose();
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
              <Input id="loginId" value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="e.g., johndoe" />
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
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Employees</CardTitle>
            <CardDescription>Manage staff and their roles.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="gap-1">
                    <FileDown className="h-4 w-4" />
                    Download
                </Button>
                <Button size="sm" variant="outline" className="gap-1">
                    <FileUp className="h-4 w-4" />
                    Upload
                </Button>
              <Button size="sm" className="gap-1" onClick={handleAddNewClick}>
                  <PlusCircle className="h-4 w-4" />
                  New Employee
              </Button>
          </div>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {isDialogOpen && <FormDialog />}

      <AlertDialog open={!!employeeToDelete} onOpenChange={() => setEmployeeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the employee
              "{employeeToDelete?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
