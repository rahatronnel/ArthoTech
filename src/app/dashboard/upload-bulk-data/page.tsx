"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

const uploadTargets = ["Regions", "Zones", "Areas", "Branches", "Employees", "Groups"];

function UploadForm({ target }: { target: string }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload an Excel or CSV file to bulk-add {target.toLowerCase()}.
        Make sure the file follows the template format.
      </p>
      <div className="flex w-full max-w-sm items-center space-x-2">
        <Input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" />
        <Button type="submit" className="gap-2">
          <Upload className="h-4 w-4" />
          Upload
        </Button>
      </div>
       <Button variant="link" className="p-0 h-auto">Download {target} Template</Button>
    </div>
  );
}


export default function UploadBulkDataPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Bulk Data</CardTitle>
        <CardDescription>
          Upload data for various parts of your organization in bulk.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={uploadTargets[0]} className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
            {uploadTargets.map((target) => (
              <TabsTrigger key={target} value={target}>{target}</TabsTrigger>
            ))}
          </TabsList>
          {uploadTargets.map((target) => (
            <TabsContent key={target} value={target}>
                <Card className="mt-4">
                    <CardHeader>
                        <CardTitle>Upload {target}</CardTitle>
                    </CardHeader>
                    <CardContent>
                         <UploadForm target={target} />
                    </CardContent>
                </Card>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
