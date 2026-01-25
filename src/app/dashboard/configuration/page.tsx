"use client";

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useOrganization } from '@/context/OrganizationContext';
import { useToast } from '@/hooks/use-toast';

export default function ConfigurationPage() {
  const { orgInfo, setOrgInfo } = useOrganization();
  const { toast } = useToast();

  const [name, setName] = useState(orgInfo.name);
  const [bengaliName, setBengaliName] = useState(orgInfo.bengaliName);
  const [address, setAddress] = useState(orgInfo.address);
  const [phone, setPhone] = useState(orgInfo.phone);
  const [contactPerson, setContactPerson] = useState(orgInfo.contactPerson);
  const [designation, setDesignation] = useState(orgInfo.designation);
  const [email, setEmail] = useState(orgInfo.email);
  const [logo, setLogo] = useState<string | null>(orgInfo.logo);
  const [favicon, setFavicon] = useState<string | null>(orgInfo.favicon);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string | null>>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOrgInfo({
      name,
      bengaliName,
      address,
      phone,
      contactPerson,
      designation,
      email,
      logo,
      favicon,
    });
    toast({
      title: "Configuration Saved",
      description: "Your organization's information has been updated.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Configuration</CardTitle>
        <CardDescription>Manage your organization's information.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input id="org-name" placeholder="Your organization's name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
             <div className="space-y-2">
              <Label htmlFor="org-bengali-name">Organization Name (Bengali)</Label>
              <Input id="org-bengali-name" placeholder="আপনার প্রতিষ্ঠানের নাম" value={bengaliName} onChange={(e) => setBengaliName(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" placeholder="Organization's full address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
             <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" placeholder="Contact phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
             <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="Contact email address" value={email} onChange={(e) => setEmail(e.target.value)}/>
            </div>
          </div>
          
           <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact-person">Contact Person</Label>
              <Input id="contact-person" placeholder="Name of the contact person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" placeholder="Designation of the contact person" value={designation} onChange={(e) => setDesignation(e.target.value)}/>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="logo">Logo</Label>
              <Input id="logo" type="file" className="file:text-foreground" onChange={(e) => handleFileChange(e, setLogo)} accept="image/*" />
              <p className="text-xs text-muted-foreground">Upload your organization's logo (e.g., PNG, JPG).</p>
               {logo && <Image src={logo} alt="Logo Preview" width={100} height={40} className="mt-2 rounded-md object-contain" />}
            </div>
            <div className="space-y-2">
              <Label htmlFor="favicon">Favicon</Label>
              <Input id="favicon" type="file" className="file:text-foreground" onChange={(e) => handleFileChange(e, setFavicon)} accept="image/x-icon, image/png, image/svg+xml"/>
              <p className="text-xs text-muted-foreground">Upload a favicon for the browser tab (e.g., ICO, PNG).</p>
              {favicon && <Image src={favicon} alt="Favicon Preview" width={32} height={32} className="mt-2 rounded-md object-contain" />}
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
