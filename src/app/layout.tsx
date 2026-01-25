import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { OrganizationProvider } from '@/context/OrganizationContext';
import { AppMetadataUpdater } from '@/components/AppMetadataUpdater';
import { AuthProvider } from '@/context/AuthContext';
import { MemberProvider } from '@/context/MemberContext';
import { SavingsProvider } from '@/context/SavingsContext';

export const metadata: Metadata = {
  title: 'ArthoTech',
  description: 'Microfinance management software',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <OrganizationProvider>
          <AuthProvider>
            <MemberProvider>
              <SavingsProvider>
                <AppMetadataUpdater />
                {children}
                <Toaster />
              </SavingsProvider>
            </MemberProvider>
          </AuthProvider>
        </OrganizationProvider>
      </body>
    </html>
  );
}
