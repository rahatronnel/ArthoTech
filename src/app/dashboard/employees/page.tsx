"use client";

import { useState } from 'react';
import { employees as initialEmployees } from '@/lib/data';
import type { Employee } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, MoreHorizontal, FileDown, FileUp } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function EmployeesPage() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState(initialEmployees);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const roles: Employee['role'][] = ['Branch User', 'Area User', 'Zonal User', 'Regional User', 'Head Office'];

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

  const FormDialog = () => {
    const [name, setName] = useState(editingEmployee?.name || '');
    const [role, setRole] = useState<Employee['role'] | ''>(editingEmployee?.role || '');
    const [assignment, setAssignment] = useState(editingEmployee?.assignment || '');

    const handleSubmit = () => {
      if (!name || !role || !assignment) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Please fill out all fields.",
        });
        return;
      }
      if (editingEmployee) { // Update
        const updatedEmployee: Employee = { ...editingEmployee, name, role: role as Employee['role'], assignment };
        setEmployees(employees.map(e => (e.id === editingEmployee.id ? updatedEmployee : e)));
        toast({ title: "Employee updated", description: `"${name}" has been updated.` });
      } else { // Create
        const newEmployee: Employee = {
          id: `E${String(employees.length + 1).padStart(3, '0')}`,
          name,
          role: role as Employee['role'],
          assignment,
        };
        setEmployees([...employees, newEmployee]);
        toast({ title: "Employee created", description: `"${name}" has been added.` });
      }
      handleDialogClose();
    };

    return (
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleDialogClose()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'Edit Employee' : 'Create New Employee'}</DialogTitle>
            <DialogDescription>
              {editingEmployee ? 'Update the details of the employee.' : 'Add a new employee to your organization.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Employee Name
              </Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., John Doe" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Role
              </Label>
              <Select onValueChange={(value) => setRole(value as Employee['role'])} value={role}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="assignment" className="text-right">
                Assignment
              </Label>
              <Input id="assignment" value={assignment} onChange={(e) => setAssignment(e.target.value)} placeholder="e.g., Downtown Branch" className="col-span-3" />
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
        <CardHeader className="flex flex-row items-center justify-between">
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
                <TableHead>Role</TableHead>
                <TableHead>Assignment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.name}</TableCell>
                  <TableCell>{employee.role}</TableCell>
                  <TableCell>{employee.assignment}</TableCell>
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
