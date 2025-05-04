
"use client";

import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Rocket } from 'lucide-react';
import Link from 'next/link';

// Example niches, should ideally be fetched or consistent with signup
const ALL_NICHES = [
    "Fashion", "Beauty", "Fitness", "Food", "Travel", "Tech", "Gaming", "Finance", "Education", "DIY", "Comedy", "Dance", "Music", "Art", "Pets", "Parenting", "Lifestyle", "Business"
].sort(); // Keep sorted for display

interface UserSettings {
    displayName: string;
    email: string; // Display only
    selectedNiches: string[];
    notifications: {
        emailDailySummary: boolean;
        emailRealtimeGrowth: boolean; // Paid only
        slackEnabled: boolean; // Paid only
        slackWebhookUrl?: string; // Paid only
    };
    subscription: {
        plan: 'free' | 'paid';
        status: string;
    };
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Partial<UserSettings>>({});
  const [initialSettings, setInitialSettings] = useState<Partial<UserSettings>>({}); // To track changes
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPaidUser = settings.subscription?.plan === 'paid';
  const hasChanges = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  useEffect(() => {
    if (user) {
      const fetchSettings = async () => {
        setLoading(true);
        setError(null);
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            const currentSettings = {
              displayName: data.displayName || user.displayName || '',
              email: data.email || user.email || '',
              selectedNiches: data.selectedNiches || [data.primaryNiche].filter(Boolean) || [],
              notifications: data.notifications || { // Default notification settings
                  emailDailySummary: true,
                  emailRealtimeGrowth: false,
                  slackEnabled: false,
                  slackWebhookUrl: '',
              },
              subscription: data.subscription || { plan: 'free', status: 'active' },
            };
            setSettings(currentSettings);
            setInitialSettings(JSON.parse(JSON.stringify(currentSettings))); // Deep copy for comparison
          } else {
            setError("User profile not found. Please try logging in again or contact support.");
          }
        } catch (err) {
          console.error("Error fetching settings:", err);
          setError("Could not load your settings. Please try again later.");
        } finally {
          setLoading(false);
        }
      };
      fetchSettings();
    } else {
        // Should be handled by layout, but good practice
        setLoading(false);
        setError("Please log in to access settings.");
    }
  }, [user]);

  const handleNicheChange = (niche: string, checked: boolean | string) => {
     const currentNiches = settings.selectedNiches || [];
     let updatedNiches;

     if (checked) {
         if (isPaidUser || currentNiches.length < 1) { // Allow adding if paid or if it's the first one for free user
             updatedNiches = [...currentNiches, niche];
         } else {
             toast({
                title: "Upgrade Required",
                description: "Free users can only select 1 niche. Upgrade to select more.",
                variant: "destructive"
             });
             return; // Prevent adding more than 1 for free users
         }
     } else {
         // Prevent removing the last niche if it's the only one
         if (currentNiches.length <= 1) {
             toast({
                 title: "Action Denied",
                 description: "You must have at least one niche selected.",
                 variant: "destructive"
             });
             return;
         }
         updatedNiches = currentNiches.filter(n => n !== niche);
     }

     setSettings(prev => ({ ...prev, selectedNiches: updatedNiches }));
  };

  const handleNotificationChange = (key: keyof UserSettings['notifications'], value: any) => {
     // Ensure paid features are only enabled for paid users
     if (['emailRealtimeGrowth', 'slackEnabled', 'slackWebhookUrl'].includes(key as string) && !isPaidUser && value) {
         toast({
             title: "Upgrade Required",
             description: "This notification setting requires a paid plan.",
             variant: "destructive"
         });
         return;
     }

     setSettings(prev => ({
        ...prev,
        notifications: {
            ...(prev.notifications || { emailDailySummary: true, emailRealtimeGrowth: false, slackEnabled: false }), // Provide default if null
            [key]: value,
        },
     }));
  };

 const handleSaveChanges = async () => {
    if (!user || !hasChanges) return;
    setSaving(true);
    setError(null);

    // Prepare data to save (only changed fields could be sent, but sending all is simpler here)
    const dataToSave: any = {
        displayName: settings.displayName,
        selectedNiches: settings.selectedNiches,
        notifications: settings.notifications,
        // Don't save email or subscription plan from here
    };

    // Validate Slack URL if enabled
    if (dataToSave.notifications.slackEnabled && !dataToSave.notifications.slackWebhookUrl?.startsWith('https://hooks.slack.com/')) {
        toast({ title: "Invalid Slack URL", description: "Please enter a valid Slack Webhook URL.", variant: "destructive" });
        setSaving(false);
        return;
    }

    try {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, dataToSave);

        // Update Firebase Auth profile displayName if changed
        if (settings.displayName !== initialSettings.displayName && auth.currentUser) {
             try {
                await auth.currentUser.updateProfile({ displayName: settings.displayName });
             } catch (authError) {
                 console.warn("Could not update auth profile display name:", authError);
                 // Non-critical error, maybe log it
             }
        }


        setInitialSettings(JSON.parse(JSON.stringify(settings))); // Update baseline after successful save
        toast({ title: "Success", description: "Your settings have been updated." });
    } catch (err) {
        console.error("Error saving settings:", err);
        setError("Failed to save settings. Please try again.");
        toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    } finally {
        setSaving(false);
    }
 };


 if (loading) {
    return (
       <div className="space-y-6">
         <Card>
            <CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader>
            <CardContent className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </CardContent>
         </Card>
         <Card>
            <CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
            </CardContent>
         </Card>
         <Card>
            <CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader>
            <CardContent className="space-y-4">
                 <Skeleton className="h-8 w-3/4" />
                 <Skeleton className="h-8 w-3/4" />
                 <Skeleton className="h-10 w-full" />
            </CardContent>
         </Card>
         <Skeleton className="h-10 w-24 ml-auto" />
       </div>
    );
 }

 if (error && !loading) {
     return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
 }

 return (
    <div className="space-y-6">
        {/* Account Information */}
        <Card>
            <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>Manage your profile details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                        id="displayName"
                        value={settings.displayName || ''}
                        onChange={(e) => setSettings(prev => ({ ...prev, displayName: e.target.value }))}
                        disabled={saving}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={settings.email || ''} disabled readOnly />
                    <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
                </div>
                 <div className="space-y-2">
                    <Label>Subscription Plan</Label>
                    <Badge variant={isPaidUser ? "default" : "secondary"} className={isPaidUser ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : ""}>
                        {settings.subscription?.plan?.toUpperCase()}
                    </Badge>
                    {!isPaidUser && (
                         <Link href="/dashboard/billing" className="ml-2 text-sm text-accent hover:underline">Upgrade Plan</Link>
                    )}
                 </div>
            </CardContent>
        </Card>

        {/* Niche Selection */}
        <Card>
            <CardHeader>
                <CardTitle>Niche Selection</CardTitle>
                <CardDescription>
                    Select the content niches you want to track trends for.
                    {!isPaidUser && " Free users can select 1 niche."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!isPaidUser && settings.selectedNiches && settings.selectedNiches.length >= 1 && (
                     <Alert className="mb-4 bg-accent/10 border-accent/30">
                        <Rocket className="h-4 w-4 !text-accent" />
                        <AlertTitle className="text-accent">Want More Niches?</AlertTitle>
                        <AlertDescription>
                            <Link href="/dashboard/billing" className="font-semibold underline">Upgrade to Premium</Link> to select and track unlimited niches.
                        </AlertDescription>
                     </Alert>
                 )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {ALL_NICHES.map(niche => (
                        <div key={niche} className="flex items-center space-x-2">
                            <Checkbox
                                id={`niche-${niche}`}
                                checked={settings.selectedNiches?.includes(niche)}
                                onCheckedChange={(checked) => handleNicheChange(niche, checked)}
                                disabled={saving || (!isPaidUser && (settings.selectedNiches || []).length >= 1 && !(settings.selectedNiches || []).includes(niche))}
                            />
                            <Label htmlFor={`niche-${niche}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {niche}
                            </Label>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
            <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>Choose how you want to receive trend alerts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
                    <Label htmlFor="emailDailySummary" className="flex flex-col space-y-1">
                        <span>Daily Email Summary</span>
                        <span className="font-normal leading-snug text-muted-foreground">
                         Receive a daily email with the top trends for your niche(s).
                        </span>
                    </Label>
                    <Switch
                        id="emailDailySummary"
                        checked={settings.notifications?.emailDailySummary}
                        onCheckedChange={(checked) => handleNotificationChange('emailDailySummary', checked)}
                        disabled={saving}
                    />
                 </div>

                 <div className={`flex items-center justify-between space-x-2 p-4 border rounded-lg ${!isPaidUser ? 'opacity-50 cursor-not-allowed' : ''}`}>
                     <Label htmlFor="emailRealtimeGrowth" className={`flex flex-col space-y-1 ${!isPaidUser ? 'cursor-not-allowed' : ''}`}>
                         <span>Real-time Growth Alerts (Email)</span>
                         <span className="font-normal leading-snug text-muted-foreground">
                             Get an immediate email when a trend shows explosive growth. (Premium)
                         </span>
                     </Label>
                     <Switch
                         id="emailRealtimeGrowth"
                         checked={settings.notifications?.emailRealtimeGrowth}
                         onCheckedChange={(checked) => handleNotificationChange('emailRealtimeGrowth', checked)}
                         disabled={saving || !isPaidUser}
                         aria-disabled={!isPaidUser}
                     />
                 </div>

                <div className={`space-y-4 p-4 border rounded-lg ${!isPaidUser ? 'opacity-50 cursor-not-allowed' : ''}`}>
                     <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="slackEnabled" className={`flex flex-col space-y-1 ${!isPaidUser ? 'cursor-not-allowed' : ''}`}>
                             <span>Slack Notifications</span>
                             <span className="font-normal leading-snug text-muted-foreground">
                                Receive alerts directly in your Slack workspace. (Premium)
                             </span>
                         </Label>
                         <Switch
                             id="slackEnabled"
                             checked={settings.notifications?.slackEnabled}
                             onCheckedChange={(checked) => handleNotificationChange('slackEnabled', checked)}
                             disabled={saving || !isPaidUser}
                              aria-disabled={!isPaidUser}
                         />
                     </div>
                     {settings.notifications?.slackEnabled && isPaidUser && (
                         <div className="space-y-2 pl-2 pt-2 border-l-2 border-border ml-2">
                             <Label htmlFor="slackWebhookUrl">Slack Webhook URL</Label>
                             <Input
                                 id="slackWebhookUrl"
                                 type="url"
                                 placeholder="https://hooks.slack.com/services/..."
                                 value={settings.notifications?.slackWebhookUrl || ''}
                                 onChange={(e) => handleNotificationChange('slackWebhookUrl', e.target.value)}
                                 disabled={saving}
                             />
                              <p className="text-xs text-muted-foreground">
                                Find this URL in your Slack app's Incoming Webhooks configuration.
                              </p>
                         </div>
                     )}
                </div>

            </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
            <Button onClick={handleSaveChanges} disabled={saving || !hasChanges}>
                {saving ? 'Saving...' : 'Save Changes'}
            </Button>
        </div>
    </div>
 );
}
