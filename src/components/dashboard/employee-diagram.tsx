'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, collectionGroup, query } from 'firebase/firestore';
import type { Region, Zone, Area, Branch, Employee } from '@/lib/data';
import { useOrganization } from '@/context/OrganizationContext';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { User, Mail, GitFork } from 'lucide-react';
import { cn } from '@/lib/utils';

// Data structure for the employee tree
interface EmployeeNode extends Employee {
    type: 'employee';
    children?: EmployeeNode[];
}

function EmployeeDiagramSkeleton() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Employee Diagram</CardTitle>
                <CardDescription>Visualizing the employee hierarchy of your organization.</CardDescription>
            </CardHeader>
            <CardContent>
                <Skeleton className="h-96 w-full" />
            </CardContent>
        </Card>
    )
}

const EmployeeNodeCard = ({ node }: { node: EmployeeNode }) => {
    const colors: { [key: string]: string } = {
        'Regional User': 'bg-red-100 border-red-300 text-red-800',
        'Zonal User': 'bg-blue-100 border-blue-300 text-blue-800',
        'Area User': 'bg-green-100 border-green-300 text-green-800',
        'Branch User': 'bg-yellow-100 border-yellow-300 text-yellow-800',
        'Super Admin': 'bg-purple-100 border-purple-300 text-purple-800',
        'Head Office': 'bg-gray-100 border-gray-300 text-gray-800',
    };
    const colorClass = colors[node.role] || colors['Head Office'];
    
    return (
        <div className={cn("relative inline-block rounded-lg border p-3 shadow-sm min-w-64", colorClass)}>
            <div className="flex items-center gap-3">
                <User className="h-6 w-6 flex-shrink-0" />
                <div>
                    <p className="font-bold">{node.name}</p>
                    <p className="text-xs font-medium opacity-90">{node.role}</p>
                     <div className="flex items-center gap-1.5 text-xs mt-1 opacity-70">
                        <Mail className="h-3 w-3" />
                        <span>{node.email}</span>
                    </div>
                </div>
            </div>
        </div>
    )
};

const TreeNode = ({ node }: { node: EmployeeNode }) => {
    return (
        <li>
            <EmployeeNodeCard node={node} />
            {node.children && node.children.length > 0 && (
                <ul>
                    {node.children.map((child: any) => (
                        <TreeNode key={child.id} node={child} />
                    ))}
                </ul>
            )}
        </li>
    );
};


export function EmployeeDiagram() {
    const { orgInfo } = useOrganization();
    const firestore = useFirestore();

    const regionsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'regions') : null, [firestore]);
    const { data: regions, isLoading: regionsLoading } = useCollection<Region>(regionsQuery);

    const zonesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'zones')) : null, [firestore]);
    const { data: zones, isLoading: zonesLoading } = useCollection<Zone>(zonesQuery);

    const areasQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'areas')) : null, [firestore]);
    const { data: areas, isLoading: areasLoading } = useCollection<Area>(areasQuery);

    const branchesQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'branches')) : null, [firestore]);
    const { data: branches, isLoading: branchesLoading } = useCollection<Branch>(branchesQuery);

    const employeesQuery = useMemoFirebase(() => collection(firestore, 'employees'), [firestore]);
    const { data: employees, isLoading: employeesLoading } = useCollection<Employee>(employeesQuery);

    const treeData = useMemo(() => {
        if (!regions || !zones || !areas || !branches || !employees) return [];
        
        // Create a map of all employees as nodes
        const employeeNodeMap = new Map<string, EmployeeNode>(
            employees.map(e => [e.id, { ...e, type: 'employee', children: [] }])
        );

        // Maps for quick geographic lookup
        const regionMap = new Map(regions.map(r => [r.id, r]));
        const zoneMap = new Map(zones.map(z => [z.id, z]));
        const areaMap = new Map(areas.map(a => [a.id, a]));
        const branchMap = new Map(branches.map(b => [b.id, b]));

        // Link children to parents
        for (const employeeNode of employeeNodeMap.values()) {
            let parentNode: EmployeeNode | undefined;

            if (employeeNode.role === 'Zonal User') {
                const zone = zoneMap.get(employeeNode.assignment);
                if (zone) {
                    const region = regionMap.get(zone.regionId);
                    if (region?.responsibleEmployeeId) {
                        parentNode = employeeNodeMap.get(region.responsibleEmployeeId);
                    }
                }
            } else if (employeeNode.role === 'Area User') {
                const area = areaMap.get(employeeNode.assignment);
                if (area) {
                    const zone = zoneMap.get(area.zoneId);
                    if (zone?.responsibleEmployeeId) {
                        parentNode = employeeNodeMap.get(zone.responsibleEmployeeId);
                    }
                }
            } else if (employeeNode.role === 'Branch User') {
                const branch = branchMap.get(employeeNode.assignment);
                if (branch) {
                    const area = areaMap.get(branch.areaId);
                    if (area?.responsibleEmployeeId) {
                        parentNode = employeeNodeMap.get(area.responsibleEmployeeId);
                    }
                }
            }

            if (parentNode) {
                parentNode.children.push(employeeNode);
            }
        }
        
        // The top-level nodes are the Regional Users
        return employees
            .filter(e => e.role === 'Regional User')
            .map(rm => employeeNodeMap.get(rm.id)!)
            .filter(Boolean)
            .map(rm => { // Sort children at each level
                rm.children.forEach(zm => {
                    zm.children.forEach(am => {
                        am.children.sort((a,b) => a.name.localeCompare(b.name)); // Sort Branch Users
                    });
                    zm.children.sort((a,b) => a.name.localeCompare(b.name)); // Sort Area Users
                });
                rm.children.sort((a,b) => a.name.localeCompare(b.name)); // Sort Zonal Users
                return rm;
            })
            .sort((a, b) => a.name.localeCompare(b.name));

    }, [regions, zones, areas, branches, employees]);
    
    const isLoading = regionsLoading || zonesLoading || areasLoading || branchesLoading || employeesLoading;

    if (isLoading) {
        return <EmployeeDiagramSkeleton />;
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Employee Diagram</CardTitle>
                <CardDescription>A visual representation of your employee hierarchy.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-auto p-6 min-h-[500%] text-center">
                <div className="tree inline-block">
                    <ul>
                       <li>
                           <div className="inline-block align-top text-center mb-10">
                               {orgInfo.logo ? (
                                   <Image src={orgInfo.logo} alt={orgInfo.name} width={80} height={80} className="mx-auto h-20 w-20 rounded-full object-contain border-4 border-primary p-1" />
                               ) : (
                                   <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border-4 border-primary mx-auto">
                                       <GitFork className="h-10 w-10 text-primary" />
                                   </div>
                               )}
                               <div>
                                   <h2 className="text-2xl font-bold text-primary mt-2">{orgInfo.name}</h2>
                                   <p className="text-muted-foreground">Employee Hierarchy</p>
                               </div>
                           </div>
                           {treeData.length > 0 ? (
                               <ul>
                                   {treeData.map((employee) => (
                                       <TreeNode key={employee.id} node={employee} />
                                   ))}
                               </ul>
                           ) : (
                            <p className="text-muted-foreground mt-4">No employees with assigned roles found to build the diagram.</p>
                           )}
                       </li>
                    </ul>
                </div>
            </CardContent>
        </Card>
    )
}
