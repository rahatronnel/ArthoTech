'use client';

import { useMemo, useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, collectionGroup, query } from 'firebase/firestore';
import type { Region, Zone, Area, Branch, Employee } from '@/lib/data';
import { useOrganization } from '@/context/OrganizationContext';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building, GitFork, Map as RegionIcon, Network, User, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

// Data structure for the tree
interface BranchNode extends Branch { type: 'branch'; children?: undefined; }
interface AreaNode extends Area { type: 'area'; children: BranchNode[]; }
interface ZoneNode extends Zone { type: 'zone'; children: AreaNode[]; }
interface RegionNode extends Region { type: 'region'; children: ZoneNode[]; }

// Helper function to chunk an array
function chunk<T>(array: T[], size: number): T[][] {
  const chunked_arr: T[][] = [];
  let index = 0;
  while (index < array.length) {
    chunked_arr.push(array.slice(index, size + index));
    index += size;
  }
  return chunked_arr;
}

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

const NodeCard = ({ node, employeeMap, language }: { node: any; employeeMap: Map<string, string>, language: 'english' | 'bengali' }) => {
    const icons: { [key: string]: React.ElementType } = {
        region: RegionIcon,
        zone: MapPin,
        area: Network,
        branch: Building,
    };
    const colors: { [key: string]: string } = {
        region: 'bg-red-100 border-red-300 text-red-800',
        zone: 'bg-blue-100 border-blue-300 text-blue-800',
        area: 'bg-green-100 border-green-300 text-green-800',
        branch: 'bg-yellow-100 border-yellow-300 text-yellow-800',
    };
    const Icon = icons[node.type];
    const responsibleEmployee = 'responsibleEmployeeId' in node && node.responsibleEmployeeId ? employeeMap.get(node.responsibleEmployeeId) : null;
    const displayName = language === 'bengali' && node.bengaliName ? node.bengaliName : node.name;
    
    return (
        <div className={cn("relative inline-block rounded-lg border p-3 shadow-sm min-w-56", colors[node.type])}>
            <div className="flex items-center gap-3">
                {Icon && <Icon className="h-6 w-6 flex-shrink-0" />}
                <div>
                    <p className="font-bold">{displayName}</p>
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

const TreeNode = ({ node, employeeMap, language }: { node: any; employeeMap: Map<string, string>, language: 'english' | 'bengali' }) => {
    if ((node.type === 'zone' || node.type === 'area') && node.children && node.children.length > 0) {
        const chunks = chunk(node.children, 2);
        return (
             <li>
                <NodeCard node={node} employeeMap={employeeMap} language={language} />
                {chunks.map((chunk, index) => (
                     <ul key={index}>
                        {chunk.map((child: any) => (
                            <TreeNode key={child.id} node={child} employeeMap={employeeMap} language={language} />
                        ))}
                    </ul>
                ))}
            </li>
        );
    }
    return (
        <li>
            <NodeCard node={node} employeeMap={employeeMap} language={language} />
            {node.children && node.children.length > 0 && (
                <ul>
                    {node.children.map((child: any) => (
                        <TreeNode key={child.id} node={child} employeeMap={employeeMap} language={language} />
                    ))}
                </ul>
            )}
        </li>
    );
};


export function Organogram() {
    const { orgInfo } = useOrganization();
    const firestore = useFirestore();
    const [language, setLanguage] = useState<'english' | 'bengali'>('english');

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
    
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                 <div>
                    <CardTitle>Organization Chart</CardTitle>
                    <CardDescription>A visual representation of your organization's hierarchy.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" variant={language === 'english' ? 'default' : 'outline'} onClick={() => setLanguage('english')}>English</Button>
                    <Button size="sm" variant={language === 'bengali' ? 'default' : 'outline'} onClick={() => setLanguage('bengali')}>বাংলা</Button>
                </div>
            </CardHeader>
            <CardContent className="overflow-auto p-6">
                <div className="tree text-center">
                    <ul className="inline-block">
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
                                   <h2 className="text-2xl font-bold text-primary mt-2">{language === 'bengali' && orgInfo.bengaliName ? orgInfo.bengaliName : orgInfo.name}</h2>
                                   <p className="text-muted-foreground">{language === 'bengali' ? orgInfo.name : orgInfo.bengaliName}</p>
                               </div>
                           </div>
                           {treeData.length > 0 ? (
                               <ul>
                                   {treeData.map((region) => (
                                       <TreeNode key={region.id} node={region} employeeMap={employeeMap} language={language} />
                                   ))}
                               </ul>
                           ) : (
                                <p className="text-muted-foreground mt-4">No regions found to build the diagram.</p>
                           )}
                       </li>
                    </ul>
                </div>
            </CardContent>
        </Card>
    )
}
