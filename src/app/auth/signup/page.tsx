
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from '@/hooks/use-toast';
import { Chrome } from 'lucide-react'; // Using Chrome icon for Google

// Example niches, replace with actual list maybe fetched from config/db
const NICHES = [
    "Fashion", "Beauty", "Fitness", "Food", "Travel", "Tech", "Gaming", "Finance", "Education", "DIY", "Comedy", "Dance", "Music", "Art"
];

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [primaryNiche, setPrimaryNiche] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Signup Failed", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    if (!primaryNiche) {
        toast({ title: "Signup Failed", description: "Please select your primary niche.", variant: "destructive" });
        return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update profile
      await updateProfile(user, { displayName });

      // Store user data in Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: displayName,
        primaryNiche: primaryNiche,
        selectedNiches: [primaryNiche], // Start with primary niche
        subscription: {
            plan: "free", // Default to free plan
            status: "active",
        },
        createdAt: new Date(),
      });

      toast({ title: "Signup Successful", description: "Account created. Redirecting..." });
      router.push('/dashboard'); // Redirect to dashboard after signup
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "Signup Failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

   const handleGoogleSignup = async () => {
    if (!primaryNiche) {
        toast({ title: "Signup Failed", description: "Please select your primary niche before signing up with Google.", variant: "destructive" });
        return;
    }
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Store user data in Firestore (or update if exists)
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '',
        primaryNiche: primaryNiche,
        selectedNiches: [primaryNiche],
        subscription: {
            plan: "free",
            status: "active",
        },
        createdAt: new Date(),
      }, { merge: true }); // Use merge to avoid overwriting existing data if user logged in before

      toast({ title: "Google Signup Successful", description: "Account linked. Redirecting..." });
      router.push('/dashboard');
    } catch (error: any) {
      console.error("Google signup error:", error);
      toast({
        title: "Google Signup Failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-secondary/50 py-12">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Create an Account</CardTitle>
          <CardDescription>Join SocialTrendRadar and start catching trends!</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="space-y-4 mb-6">
             <Label htmlFor="primaryNiche">Select Your Primary Niche</Label>
              <Select value={primaryNiche} onValueChange={setPrimaryNiche} disabled={loading}>
                <SelectTrigger id="primaryNiche">
                  <SelectValue placeholder="Select your main content niche" />
                </SelectTrigger>
                <SelectContent>
                  {NICHES.map((niche) => (
                    <SelectItem key={niche} value={niche}>
                      {niche}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
           </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Your Name"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
             <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={loading || !primaryNiche}>
              {loading ? 'Creating Account...' : 'Sign Up with Email'}
            </Button>
          </form>

          <div className="relative my-4">
             <div className="absolute inset-0 flex items-center">
               <span className="w-full border-t" />
             </div>
             <div className="relative flex justify-center text-xs uppercase">
               <span className="bg-background px-2 text-muted-foreground">
                 Or sign up with
               </span>
             </div>
           </div>

           <Button variant="outline" className="w-full" onClick={handleGoogleSignup} disabled={loading || !primaryNiche}>
             <Chrome className="mr-2 h-4 w-4" /> Sign Up with Google
           </Button>

          <div className="mt-4 text-center text-sm">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-accent hover:underline">
              Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
