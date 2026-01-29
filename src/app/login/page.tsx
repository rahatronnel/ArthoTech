"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PiggyBank } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { getAuth as getFirebaseAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp as initializeTempApp, deleteApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { Skeleton } from '@/components/ui/skeleton';

// The regular login form
function LoginForm() {
  const router = useRouter();
  const { login, loading } = useAuth();
  const { toast } = useToast();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(loginId, password);
      toast({ title: "Login Successful", description: "Welcome back!" });
      router.push('/dashboard');
    } catch (err: any) {
      let message = 'An unexpected error occurred.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = 'Invalid login ID or password.';
      } else {
        console.error(err);
        message = err.message;
      }
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: message,
      });
    }
  };

  return (
    <Card className="w-full max-w-sm bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl">
      <CardHeader className="text-center">
        <div className="flex justify-center items-center mb-4">
            <PiggyBank className="h-10 w-10 text-white" />
        </div>
        <CardTitle className="text-2xl font-bold text-white">Login</CardTitle>
        <CardDescription className="text-white/80">Enter your credentials to access your account</CardDescription>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="loginId" className="text-white/80">Login ID</Label>
            <Input
              id="loginId"
              type="text"
              placeholder="e.g., admin"
              required
              value={loginId}
              onChange={(e) => setLoginId(e.target.value.toLowerCase())}
              disabled={loading}
              className="bg-transparent border-white/30 text-white placeholder:text-white/60 focus:ring-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-white/80">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="bg-transparent border-white/30 text-white placeholder:text-white/60 focus:ring-white"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

// Form to create the first super admin
function CreateSuperAdminForm({ onAdminCreated }: { onAdminCreated: () => void }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [name, setName] = useState('');
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleCreateAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !loginId || !password) {
            toast({ variant: 'destructive', title: 'Missing fields', description: 'Please fill out all fields.' });
            return;
        }
        if (password.length < 6) {
            toast({ variant: 'destructive', title: 'Password too short', description: 'Password must be at least 6 characters.' });
            return;
        }

        setIsLoading(true);

        const tempApp = initializeTempApp(firebaseConfig, `super-admin-creator-${Date.now()}`);
        try {
            const tempAuth = getFirebaseAuth(tempApp);
            const authDomain = tempAuth.app.options.authDomain;

            if (!authDomain) {
                throw new Error("Firebase Auth Domain is not configured.");
            }

            const email = `${loginId.toLowerCase().trim()}@${authDomain}`;
            
            const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
            const uid = userCredential.user.uid;

            const newEmployee = {
                id: uid,
                name: name,
                bengaliName: '', // Not critical for super admin
                code: 'SUPERADMIN',
                role: 'Super Admin',
                assignment: 'Head Office',
                loginId: loginId.toLowerCase().trim(),
            };

            await setDoc(doc(firestore, "employees", uid), newEmployee);

            toast({ title: 'Admin Account Created', description: 'You can now log in with your new credentials.' });
            onAdminCreated();
        } catch (error: any) {
            console.error(error);
            let message = error.message;
            if (error.code === 'auth/email-already-in-use') {
                message = 'This Login ID is already registered. Please choose a different Login ID or clear the user from the Firebase Console.';
            }
            toast({ variant: 'destructive', title: 'Creation Failed', description: message });
        } finally {
            await deleteApp(tempApp);
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-sm">
            <CardHeader>
                <CardTitle>Create Super Admin</CardTitle>
                <CardDescription>No Super Admin account was found. Please create one to get started.</CardDescription>
            </CardHeader>
            <form onSubmit={handleCreateAdmin}>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="loginId">Login ID</Label>
                        <Input id="loginId" required value={loginId} onChange={(e) => setLoginId(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? 'Creating Account...' : 'Create Admin Account'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}

// Loading component for the check
function LoadingState() {
    return (
        <Card className="w-full max-w-sm">
            <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-10 w-full" />
                </div>
                 <div className="space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </CardContent>
            <CardFooter>
                <Skeleton className="h-10 w-full" />
            </CardFooter>
        </Card>
    )
}

export default function LoginPage() {
    const [needsSetup, setNeedsSetup] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const firestore = useFirestore();

    useEffect(() => {
        const checkSuperAdmin = async () => {
            if (!firestore) return;

            try {
                const q = query(collection(firestore, 'employees'), where('role', '==', 'Super Admin'));
                const querySnapshot = await getDocs(q);
                if (querySnapshot.empty) {
                    setNeedsSetup(true);
                } else {
                    setNeedsSetup(false);
                }
            } catch (error) {
                console.error("Error checking for Super Admin:", error);
                setNeedsSetup(false);
            } finally {
                setIsChecking(false);
            }
        };

        checkSuperAdmin();
    }, [firestore]);


    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-slate-900 to-purple-900">
            {isChecking ? (
                <LoadingState />
            ) : needsSetup ? (
                <CreateSuperAdminForm onAdminCreated={() => {
                    setNeedsSetup(false);
                    setIsChecking(false);
                }} />
            ) : (
                <LoginForm />
            )}
        </div>
    );
}
