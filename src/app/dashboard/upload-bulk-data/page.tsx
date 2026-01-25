"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { Separator } from "@/components/ui/separator";

function UploadForm({ target, description }: { target: string, description: string }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {description}
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
      <CardContent className="flex flex-col gap-8 pt-6">
        <div>
          <h3 className="text-lg font-semibold">Organization Structure</h3>
           <Card className="mt-4">
                <CardHeader>
                    <CardTitle>Upload Structure Data</CardTitle>
                </CardHeader>
                <CardContent>
                     <UploadForm 
                        target="Organization Structure" 
                        description="Upload an Excel or CSV file for your organization's structure. Make sure the file follows the template format." 
                    />
                </CardContent>
            </Card>
        </div>

        <Separator />
        
        <div>
          <h3 className="text-lg font-semibold">Upload Microfinance Data</h3>
           <Card className="mt-4">
                <CardHeader>
                    <CardTitle>Upload Data File</CardTitle>
                </CardHeader>
                <CardContent>
                    <UploadForm 
                        target="Microfinance Data" 
                        description="Bulk upload for members, savings, and loan information. Make sure the file follows the template format."
                    />
                </CardContent>
            </Card>
        </div>
      </CardContent>
    </Card>
  );
}
