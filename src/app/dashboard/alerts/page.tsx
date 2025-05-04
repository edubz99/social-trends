
"use client";

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bell, Zap, Rocket } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

// Mock Alert data structure
interface TrendAlert {
    id: string;
    trendTitle: string;
    trendUrl: string;
    niche: string;
    reason: 'daily_summary' | 'explosive_growth'; // Type of alert
    growthRate?: number; // For explosive growth alerts
    alertedAt: Date;
    isRead?: boolean; // Optional: Track read status
}

// Mock function to fetch alerts - replace with actual backend call
async function fetchAlerts(userId: string): Promise<TrendAlert[]> {
    console.log(`Fetching alerts for user: ${userId}`);
    await new Promise(resolve => setTimeout(resolve, 1200)); // Simulate API delay

    // Example data - replace with real data fetching logic (e.g., from a 'user_alerts' collection)
    const mockAlerts: TrendAlert[] = [
        { id: 'alert1', trendTitle: 'Massive Growth in DIY Hacks', trendUrl: '#', niche: 'DIY', reason: 'explosive_growth', growthRate: 350, alertedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), isRead: false },
        { id: 'alert2', trendTitle: 'Daily Tech Trends Summary', trendUrl: '#', niche: 'Tech', reason: 'daily_summary', alertedAt: new Date(Date.now() - 8 * 60 * 60 * 1000), isRead: false },
        { id: 'alert3', trendTitle: 'Fitness Challenge Going Viral', trendUrl: '#', niche: 'Fitness', reason: 'explosive_growth', growthRate: 210, alertedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), isRead: true },
        { id: 'alert4', trendTitle: 'Daily Food Trends Summary', trendUrl: '#', niche: 'Food', reason: 'daily_summary', alertedAt: new Date(Date.now() - 1.1 * 24 * 60 * 60 * 1000), isRead: true },
    ];

    return mockAlerts; // In real app, fetch based on userId and potentially mark as read
}

// Fetch user subscription status
async function fetchUserSubscription(uid: string) {
    const userDocRef = doc(db, "users", uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        return data?.subscription as { plan: string; status: string } | undefined;
    } else {
        return undefined;
    }
}


export default function AlertsPage() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<{ plan: string; status: string } | null | undefined>(undefined); // undefined: loading, null: not found/error
  const [alerts, setAlerts] = useState<TrendAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
          const sub = await fetchUserSubscription(user.uid);
          setSubscription(sub);

          if (sub?.plan !== 'paid') {
             setError("Access denied. Real-time alerts are a premium feature.");
             setLoading(false);
             return;
          }

          const fetchedAlerts = await fetchAlerts(user.uid);
          // Sort alerts by date, newest first
          fetchedAlerts.sort((a, b) => b.alertedAt.getTime() - a.alertedAt.getTime());
          setAlerts(fetchedAlerts);

        } catch (err) {
          console.error("Error loading alerts:", err);
          setError("Could not load your alerts. Please try again later.");
        } finally {
          setLoading(false);
        }
      };
      loadData();
    } else {
      // Handle case where user is not logged in
      setLoading(false);
      setError("Please log in to view your alerts.");
    }
  }, [user]);


   // Placeholder for marking alerts as read
   const handleMarkAsRead = (alertId: string) => {
      console.log("Marking alert as read:", alertId);
      // TODO: Implement backend update to mark alert as read
      setAlerts(prevAlerts =>
          prevAlerts.map(a => a.id === alertId ? { ...a, isRead: true } : a)
      );
   }


  // Render based on state
  if (loading && subscription === undefined) {
    return (
       <div className="space-y-6">
         <Card>
           <CardHeader>
             <Skeleton className="h-6 w-1/3" />
             <Skeleton className="h-4 w-2/3 mt-1" />
           </CardHeader>
           <CardContent className="space-y-4">
             {[...Array(3)].map((_, i) => (
                 <Skeleton key={i} className="h-16 w-full rounded-lg" />
             ))}
           </CardContent>
         </Card>
       </div>
    );
  }

  if (subscription?.plan !== 'paid') {
     return (
        <Alert variant="destructive" className="mt-4">
            <Rocket className="h-4 w-4" />
            <AlertTitle>Premium Feature</AlertTitle>
            <AlertDescription>
                {error || "Real-time alerts and Slack integration are available on the paid plan."} <Link href="/dashboard/billing" className="font-semibold underline">Upgrade your plan</Link> to get notified instantly.
            </AlertDescription>
        </Alert>
     )
  }

  if (error) {
      return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notifications & Alerts</CardTitle>
          <CardDescription>Catch explosive growth trends and daily summaries here.</CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length > 0 ? (
            <ul className="space-y-3">
              {alerts.map((alert) => (
                <li key={alert.id} className={`flex items-start gap-4 p-4 border rounded-lg ${alert.isRead ? 'bg-muted/50 opacity-70' : 'bg-background'} transition-opacity`}>
                   <div className={`mt-1 p-1.5 rounded-full ${alert.reason === 'explosive_growth' ? 'bg-destructive/10 text-destructive' : 'bg-accent/10 text-accent'}`}>
                     {alert.reason === 'explosive_growth' ? <Zap className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                   </div>
                   <div className="flex-grow">
                       <p className={`font-medium ${alert.isRead ? 'font-normal' : 'font-semibold'}`}>
                           {alert.reason === 'explosive_growth'
                              ? `Explosive Growth (${alert.growthRate}%+) in ${alert.niche}: `
                              : `Daily Summary for ${alert.niche}: `
                           }
                           <a href={alert.trendUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {alert.trendTitle}
                           </a>
                       </p>
                       <p className="text-sm text-muted-foreground">
                           {formatDistanceToNow(alert.alertedAt, { addSuffix: true })}
                       </p>
                   </div>
                   {!alert.isRead && (
                      <Button variant="ghost" size="sm" onClick={() => handleMarkAsRead(alert.id)} className="text-xs text-muted-foreground">
                         Mark as read
                      </Button>
                   )}
                </li>
              ))}
            </ul>
          ) : (
             <div className="text-center py-12">
                <Bell className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-2 text-lg font-medium">No Alerts Yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    We'll notify you here when trends match your niches or show explosive growth.
                </p>
                <Link href="/dashboard/settings" className="mt-4 inline-block">
                    <Button variant="outline">Check Notification Settings</Button>
                </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
