
"use client";

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bell, Mail, Settings } from 'lucide-react'; // Use different icons
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

// Structure for user's notification settings from Firestore
interface UserNotificationSettings {
    emailDailySummary: boolean; // Keep this for potential future use or rename
    // Renamed based on new spec:
    emailWeeklyForecast: boolean;
    slackEnabled: boolean; // Paid only
    slackWebhookUrl?: string; // Paid only
    // Potentially add: slackChannel?: string;
}

// Structure for user subscription data
interface UserSubscription {
    plan: 'free' | 'paid';
    status: string;
}

// Mock Notification Log Entry (optional, if logging is implemented)
interface NotificationLog {
    id: string;
    type: 'email_weekly' | 'slack_weekly';
    status: 'sent' | 'failed' | 'pending';
    sentAt: Date;
    details?: string; // e.g., niche sent for, or error message
}


// --- Mock/Placeholder Functions ---

// Fetch user subscription and notification settings
async function fetchUserSettings(uid: string): Promise<{ subscription: UserSubscription | null, notifications: UserNotificationSettings | null }> {
    console.log(`NotificationsPage: Fetching settings for user: ${uid}`);
    const userDocRef = doc(db, "users", uid);
    try {
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            return {
                subscription: data.subscription || { plan: 'free', status: 'inactive' },
                notifications: data.notifications || { emailWeeklyForecast: true, slackEnabled: false }, // Default settings
            };
        } else {
            console.warn(`NotificationsPage: User doc not found for ${uid}`);
            return { subscription: null, notifications: null };
        }
    } catch (error) {
        console.error("Error fetching user settings:", error);
        // Handle offline/errors appropriately
        if (error instanceof FirestoreError && (error.code === 'unavailable' || error.message.includes('offline'))) {
            throw new Error("Could not load settings (offline).");
        }
        throw new Error("Failed to load notification settings.");
    }
}

// Mock function to fetch notification logs (if implemented)
async function fetchNotificationLogs(userId: string, limit = 10): Promise<NotificationLog[]> {
    console.log(`Fetching last ${limit} notification logs for user: ${userId}`);
    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate delay

    // Example data - replace with real data fetching logic (e.g., from a 'user_notifications_log' collection)
    const mockLogs: NotificationLog[] = [
        { id: 'log1', type: 'email_weekly', status: 'sent', sentAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), details: 'Sent for Fitness' },
        { id: 'log2', type: 'slack_weekly', status: 'sent', sentAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), details: 'Sent for Fitness, Tech' },
        { id: 'log3', type: 'email_weekly', status: 'sent', sentAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), details: 'Sent for Fitness' },
    ];
    return mockLogs.slice(0, limit);
}

// --- Component ---

export default function NotificationsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserNotificationSettings | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [logs, setLogs] = useState<NotificationLog[]>([]); // Optional log state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isPaidUser = subscription?.plan === 'paid';

  useEffect(() => {
    if (user) {
      const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
          const { subscription: subData, notifications: notifyData } = await fetchUserSettings(user.uid);
          setSubscription(subData);
          setSettings(notifyData);

          // Optionally load logs if needed
          // const fetchedLogs = await fetchNotificationLogs(user.uid);
          // setLogs(fetchedLogs);

        } catch (err: any) {
          console.error("Error loading notification settings/logs:", err);
          setError(err.message || "Could not load your notification settings.");
        } finally {
          setLoading(false);
        }
      };
      loadData();
    } else {
      setLoading(false);
      setError("Please log in to view notification settings.");
    }
  }, [user]);


  // --- Render Logic ---

  if (loading) {
    return (
       <div className="space-y-6">
         <Card>
           <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
           <CardContent className="space-y-4">
             <Skeleton className="h-10 w-full" />
             <Skeleton className="h-10 w-full" />
           </CardContent>
         </Card>
         {/* Optional Log Skeleton */}
         {/* <Card>...</Card> */}
       </div>
    );
  }

  if (error) {
      return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
  }

  if (!settings || !subscription) {
       return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>Could not load necessary user data.</AlertDescription></Alert>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>Manage how you receive your weekly forecast updates.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            {/* Email Notifications */}
             <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">Weekly Forecast Email</span>
                </div>
                <Badge variant={settings.emailWeeklyForecast ? 'default' : 'secondary'} className={settings.emailWeeklyForecast ? 'bg-green-100 text-green-800 dark:bg-green-900/10 dark:text-green-200' : ''}>
                   {settings.emailWeeklyForecast ? 'Enabled' : 'Disabled'}
                </Badge>
             </div>

             {/* Slack Notifications */}
              <div className={`flex items-center justify-between p-4 border rounded-lg ${!isPaidUser ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-3">
                    {/* Simple Slack Icon Placeholder */}
                    <svg className="h-5 w-5 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.527 2.527 0 0 1 2.523 2.522A2.527 2.527 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.528 2.528 0 0 1 2.52-2.52h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" /></svg>
                    <span className="font-medium">Weekly Forecast Slack</span>
                     {!isPaidUser && <Badge variant="outline" className="text-xs ml-2">Premium</Badge>}
                </div>
                <Badge variant={settings.slackEnabled && isPaidUser ? 'default' : 'secondary'} className={settings.slackEnabled && isPaidUser ? 'bg-green-100 text-green-800 dark:bg-green-900/10 dark:text-green-200' : ''}>
                   {settings.slackEnabled && isPaidUser ? 'Enabled' : 'Disabled'}
                </Badge>
             </div>

            {/* Link to Settings */}
             <div className="mt-6 text-center">
                <Link href="/dashboard/settings">
                    <Button variant="outline">
                       <Settings className="mr-2 h-4 w-4" />
                       Modify Notification Settings
                    </Button>
                </Link>
             </div>
        </CardContent>
      </Card>

       {/* Optional: Notification Log Section */}
       {/*
       <Card>
         <CardHeader>
           <CardTitle>Recent Notifications</CardTitle>
           <CardDescription>A log of the last few notifications sent.</CardDescription>
         </CardHeader>
         <CardContent>
           {logs.length > 0 ? (
             <ul className="space-y-2 text-sm">
               {logs.map(log => (
                 <li key={log.id} className="flex justify-between border-b pb-1">
                   <span>{log.type === 'email_weekly' ? 'Email' : 'Slack'} - {format(log.sentAt, 'MMM d, h:mm a')}</span>
                   <Badge variant={log.status === 'sent' ? 'default' : 'destructive'} className={log.status === 'sent' ? 'bg-green-100...' : ''}>
                     {log.status}
                   </Badge>
                 </li>
               ))}
             </ul>
           ) : (
             <p className="text-center text-muted-foreground py-4">No recent notification logs found.</p>
           )}
         </CardContent>
       </Card>
       */}
    </div>
  );
}
