import { employees } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, MoreHorizontal, FileDown, FileUpload } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function EmployeesPage() {
  return (
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
                <FileUpload className="h-4 w-4" />
                Upload
            </Button>
            <Button size="sm" className="gap-1">
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
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell className="font-medium">{employee.name}</TableCell>
                <TableCell>{employee.role}</TableCell>
                <TableCell>{employee.assignment}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Toggle menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem>View Profile</DropdownMenuItem>
                      <DropdownMenuItem>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
