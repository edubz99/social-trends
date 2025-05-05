
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react'; // Added useEffect and useState
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { LayoutDashboard, Settings, CreditCard, LogOut, Menu, BarChart, Bookmark, Bell } from 'lucide-react'; // Updated icons: Home -> LayoutDashboard, TrendingUp -> BarChart, Heart -> Bookmark
import { Button } from '@/components/ui/button';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { useAuth } from '@/components/providers/auth-provider';
import { auth, db } from '@/lib/firebase'; // Added db
import { signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore'; // Added Firestore imports
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from '@/components/ui/separator'; // Import Separator
import { cn } from "@/lib/utils"; // Ensure cn utility exists

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [subscriptionStatus, setSubscriptionStatus] = useState<'free' | 'paid' | 'loading'>('loading');

  useEffect(() => {
    if (user) {
      const userDocRef = doc(db, "users", user.uid);
      const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const plan = data.subscription?.plan;
          const status = data.subscription?.status;
          // Consider 'active' or 'trialing' as paid for feature access
          setSubscriptionStatus((plan === 'paid' && (status === 'active' || status === 'trialing')) ? 'paid' : 'free');
        } else {
          // User doc doesn't exist, treat as free
          console.warn("User document not found in Firestore for subscription check.");
          setSubscriptionStatus('free');
        }
      }, (error) => {
        console.error("Error fetching subscription status:", error);
        setSubscriptionStatus('free'); // Default to free on error
      });

      return () => unsubscribe(); // Cleanup listener
    } else if (!authLoading) {
        // No user and auth check finished, default to free
        setSubscriptionStatus('free');
    }
  }, [user, authLoading]);


  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/'); // Redirect to home page after logout
    } catch (error) {
      console.error("Logout failed:", error);
      // Handle logout error (e.g., show toast)
    }
  };

  // Redirect to login if not authenticated and not loading
  if (authLoading) {
     return ( // Show loading state while auth check is in progress
       <div className="flex items-center justify-center h-screen">
          <Skeleton className="h-10 w-10 rounded-full mr-4" />
          <Skeleton className="h-6 w-32" />
       </div>
     );
  }

  if (!user) {
    router.replace('/auth/login');
    return (
       <div className="flex items-center justify-center h-screen">
         <p>Redirecting to login...</p> {/* Or a spinner */}
       </div>
    );
  }


  const getInitials = (name: string | null | undefined): string => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length === 1) return names[0][0].toUpperCase();
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
  };

  const menuItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }, // Changed Icon
    { href: '/dashboard/forecasts', label: 'Forecasts', icon: BarChart }, // Renamed, Changed Icon
    { href: '/dashboard/saved', label: 'Saved Forecasts', icon: Bookmark, paidOnly: true }, // Renamed, Changed Icon
    { href: '/dashboard/notifications', label: 'Notifications', icon: Bell, paidOnly: true }, // Renamed
    { href: '/dashboard/settings', label: 'Settings', icon: Settings },
    { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
  ];

  const isPaidUser = subscriptionStatus === 'paid';


  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 p-2">
            <Link href="/dashboard" className="font-bold text-lg text-primary flex items-center gap-2">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-accent">
                {/* Re-using the old logo SVG */}
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-8c0-1.1.9-2 2-2h2v6H9v-4H7v4c0 1.1-.9 2-2 2s-2-.9-2-2v-4c0-1.1.9-2 2-2s2 .9 2 2v1zm10 0c0-1.1.9-2 2-2s2 .9 2 2v4c0 1.1-.9 2-2 2s-2-.9-2-2v-4h-2v4h2c1.1 0 2-.9 2-2v-1c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v4h-2v-6h4v-1z"/>
             </svg>
              SocialTrendRadar
            </Link>
             <SidebarTrigger className="ml-auto md:hidden" />
          </div>
        </SidebarHeader>
        <SidebarContent>
          {subscriptionStatus === 'loading' ? (
            // Skeleton for menu items while subscription loads
             <div className="p-2 space-y-1">
               {[...Array(menuItems.length)].map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-md" />)}
             </div>
          ) : (
             <SidebarMenu>
                {menuItems.map((item) => {
                   if (item.paidOnly && !isPaidUser) return null; // Hide paid features for free users
                   return (
                    <SidebarMenuItem key={item.href}>
                      <Link href={item.href} legacyBehavior passHref>
                        <SidebarMenuButton
                          isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))} // Highlight parent routes too
                          tooltip={item.label}
                        >
                          <item.icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                   );
                })}
             </SidebarMenu>
          )}

        </SidebarContent>
        <SidebarFooter>
           <Separator className="my-2 border-sidebar-border" /> {/* Ensure Separator uses sidebar color */}
           <div className="flex items-center gap-3 p-2">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user?.photoURL ?? undefined} alt={user?.displayName ?? 'User'} />
              <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
               <span className="text-sm font-medium truncate">{user?.displayName || 'User'}</span>
               <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
            </div>

             <Button variant="ghost" size="icon" className="ml-auto group-data-[collapsible=icon]:hidden text-sidebar-foreground hover:bg-sidebar-accent" onClick={handleLogout}>
               <LogOut className="h-4 w-4" />
             </Button>
           </div>
            <div className="group-data-[collapsible=icon]:block hidden p-2">
                <SidebarMenuButton tooltip="Logout" onClick={handleLogout} variant="ghost" className="hover:bg-sidebar-accent">
                    <LogOut />
                </SidebarMenuButton>
            </div>

        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-4 md:hidden">
           {/* Mobile Header Content - Trigger moved to SidebarHeader */}
           <span className="font-semibold">SocialTrendRadar</span>
        </header>
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

// Note: Removed the local Separator definition, assuming it's correctly imported from '@/components/ui/separator'
