'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, collectionGroup, query } from 'firebase/firestore';
import type { Region, Zone, Area, Branch, Employee } from '@/lib/data';
import { useOrganization } from '@/context/OrganizationContext';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building, GitFork, Map as MapIcon, MapPin, Network, User } from 'lucide-react';
import { cn } from '@/lib/utils';

// Data structure for the tree
interface BranchNode extends Branch { type: 'branch'; }
interface AreaNode extends Area { type: 'area'; children: BranchNode[]; }
interface ZoneNode extends Zone { type: 'zone'; children: AreaNode[]; }
interface RegionNode extends Region { type: 'region'; children: ZoneNode[]; }

function OrganogramSkeleton() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Organization Chart</CardTitle>
                <CardDescription>Visualizing the structure of your organization.</CardDescription>
            </CardHeader>
            <CardContent className="pl-10">
                 <div className="flex items-center gap-4 mb-8">
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <div>
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-32 mt-2" />
                    </div>
                </div>
                <div className="space-y-4">
                    {[...Array(2)].map((_, i) => (
                        <div key={i} className="space-y-4 pl-8 border-l">
                            <Skeleton className="h-12 w-64" />
                            <div className="space-y-4 pl-8 border-l">
                                <Skeleton className="h-12 w-56" />
                                 <div className="space-y-4 pl-8 border-l">
                                    <Skeleton className="h-12 w-48" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

export function Organogram() {
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
    
    const employeeMap = useMemo(() => {
        if (!employees) return new Map();
        return new Map(employees.map(e => [e.id, e.name]));
    }, [employees]);

    const treeData = useMemo(() => {
        if (!regions || !zones || !areas || !branches) return [];

        const branchNodes: BranchNode[] = branches.map(b => ({ ...b, type: 'branch' }));
        const areaNodes: AreaNode[] = areas.map(a => ({
            ...a,
            type: 'area',
            children: branchNodes.filter(b => b.areaId === a.id).sort((x, y) => x.name.localeCompare(y.name)),
        }));
        const zoneNodes: ZoneNode[] = zones.map(z => ({
            ...z,
            type: 'zone',
            children: areaNodes.filter(a => a.zoneId === z.id).sort((x, y) => x.name.localeCompare(y.name)),
        }));
        const regionNodes: RegionNode[] = regions.map(r => ({
            ...r,
            type: 'region',
            children: zoneNodes.filter(z => z.regionId === r.id).sort((x, y) => x.name.localeCompare(y.name)),
        }));

        return regionNodes.sort((x, y) => x.name.localeCompare(y.name));
    }, [regions, zones, areas, branches]);
    
    const isLoading = regionsLoading || zonesLoading || areasLoading || branchesLoading || employeesLoading;

    if (isLoading) {
        return <OrganogramSkeleton />;
    }
    
    const NodeCard = ({ node }: { node: RegionNode | ZoneNode | AreaNode | BranchNode }) => {
        const icons = {
            region: MapIcon,
            zone: MapPin,
            area: Network,
            branch: Building,
        };
        const colors = {
            region: 'bg-red-100 border-red-300 text-red-800',
            zone: 'bg-blue-100 border-blue-300 text-blue-800',
            area: 'bg-green-100 border-green-300 text-green-800',
            branch: 'bg-yellow-100 border-yellow-300 text-yellow-800',
        };
        const Icon = icons[node.type];
        const responsibleEmployee = 'responsibleEmployeeId' in node && node.responsibleEmployeeId ? employeeMap.get(node.responsibleEmployeeId) : null;
        
        return (
            <div className={cn("relative w-64 rounded-lg border p-3 shadow-sm", colors[node.type])}>
                <div className="flex items-center gap-3">
                    <Icon className="h-6 w-6 flex-shrink-0" />
                    <div>
                        <p className="font-bold">{node.name}</p>
                        <p className="text-xs font-mono">{node.code}</p>
                        {responsibleEmployee && (
                           <div className="flex items-center gap-1 text-xs mt-1 opacity-80">
                                <User className="h-3 w-3" />
                                <span>{responsibleEmployee}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    };
    
    const TreeNode = ({ node, isLast }: { node: any; isLast: boolean }) => {
        return (
            <li className="relative">
                <div className="flex items-center">
                    {/* Horizontal connector */}
                    <div className="h-px w-8 bg-gray-400"></div>
                    {/* The node card */}
                    <NodeCard node={node} />
                </div>

                {/* Vertical connector to children */}
                {node.children && node.children.length > 0 && (
                     <div className={cn("absolute top-7 left-0 h-full w-8", !isLast && 'border-l border-gray-400')}>
                        {/* Children container */}
                        <ul className="pl-8 pt-8 space-y-8">
                            {node.children.map((child: any, index: number) => (
                                <TreeNode key={child.id} node={child} isLast={index === node.children.length - 1} />
                            ))}
                        </ul>
                    </div>
                )}
            </li>
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Organization Chart</CardTitle>
                <CardDescription>A visual representation of your organization's hierarchy.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-auto p-6" style={{ minHeight: '120vh' }}>
                <div className="flex justify-center">
                    <div className="inline-block">
                        {/* Head of organization */}
                        <div className="flex items-center gap-4 mb-8">
                            {orgInfo.logo ? (
                                <Image src={orgInfo.logo} alt={orgInfo.name} width={64} height={64} className="h-16 w-16 rounded-full object-contain border-2 border-primary p-1" />
                            ) : (
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border-2 border-primary">
                                    <GitFork className="h-8 w-8 text-primary" />
                                </div>
                            )}
                            <div>
                                <h2 className="text-xl font-bold text-primary">{orgInfo.name}</h2>
                                <p className="text-muted-foreground">{orgInfo.bengaliName}</p>
                            </div>
                        </div>
                        
                        {/* The tree starts here */}
                        <div className="relative">
                            <div className="absolute top-8 left-8 h-full w-px bg-gray-400"></div>
                             <ul className="space-y-8">
                                 {treeData.map((region, index) => (
                                     <TreeNode key={region.id} node={region} isLast={index === treeData.length - 1} />
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
