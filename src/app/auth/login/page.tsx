
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Chrome } from 'lucide-react'; // Using Chrome icon for Google

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      console.log("Attempting email/password sign in. Auth instance:", auth); // Log auth instance before call
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "Login Successful", description: "Redirecting to dashboard..." });
      router.push('/dashboard');
    } catch (error: any) {
      console.error("Login error:", error);
      // Specifically log if it's the reCAPTCHA error
      if (error.message?.includes('_getRecaptchaConfig is not a function')) {
          console.error(
              "Login Failed: Encountered 'authInstance._getRecaptchaConfig is not a function'. " +
              "This strongly indicates an issue with Firebase App Check / reCAPTCHA configuration in the Firebase/Google Cloud Console. " +
              "Please review the detailed warnings in the browser console during Firebase initialization (check src/lib/firebase.ts logs)."
          );
      }
      toast({
        title: "Login Failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
       console.log("Attempting Google sign in. Auth instance:", auth); // Log auth instance before call
      await signInWithPopup(auth, provider);
      toast({ title: "Google Login Successful", description: "Redirecting to dashboard..." });
      router.push('/dashboard'); // Redirect to dashboard or onboarding if needed
    } catch (error: any) {
      console.error("Google login error:", error);
       // Specifically log if it's the reCAPTCHA error
      if (error.message?.includes('_getRecaptchaConfig is not a function')) {
          console.error(
              "Google Login Failed: Encountered 'authInstance._getRecaptchaConfig is not a function'. " +
              "This strongly indicates an issue with Firebase App Check / reCAPTCHA configuration in the Firebase/Google Cloud Console. " +
              "Please review the detailed warnings in the browser console during Firebase initialization (check src/lib/firebase.ts logs)."
          );
      }
      toast({
        title: "Google Login Failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-secondary/50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Login to SocialTrendRadar</CardTitle>
          <CardDescription>Enter your email below to login to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/auth/forgot-password" className="text-sm text-accent hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
           <div className="relative my-4">
             <div className="absolute inset-0 flex items-center">
               <span className="w-full border-t" />
             </div>
             <div className="relative flex justify-center text-xs uppercase">
               <span className="bg-background px-2 text-muted-foreground">
                 Or continue with
               </span>
             </div>
           </div>
           <Button variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={loading}>
             <Chrome className="mr-2 h-4 w-4" /> Continue with Google
           </Button>
          <div className="mt-4 text-center text-sm">
            Don't have an account?{' '}
            <Link href="/auth/signup" className="text-accent hover:underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
