
"use client";

import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth'; // Import updateProfile
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
import { Rocket, Mail, Settings } from 'lucide-react'; // Use Mail icon
import Link from 'next/link';

// Example niches, should ideally be fetched or consistent with signup/config
const ALL_NICHES = [
    "Fashion", "Beauty", "Fitness", "Food", "Travel", "Tech", "Gaming", "Finance", "Education", "DIY", "Comedy", "Dance", "Music", "Art", "Pets", "Parenting", "Lifestyle", "Business"
].sort(); // Keep sorted for display

interface UserSettings {
    displayName: string;
    email: string; // Display only
    selectedNiches: string[];
    primaryNiche?: string; // Added primary niche field
    notifications: {
        // emailDailySummary: boolean; // Keep or remove based on future plans
        emailWeeklyForecast: boolean; // Changed from emailRealtimeGrowth
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
  const { toast } = useToast(); // Use toast hook inside the component
  const [settings, setSettings] = useState<Partial<UserSettings>>({});
  const [initialSettings, setInitialSettings] = useState<Partial<UserSettings>>({}); // To track changes
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPaidUser = settings.subscription?.plan === 'paid';
  // Deep comparison for changes, ensures nested objects are checked
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
            const currentSettings: UserSettings = { // Ensure type safety
              displayName: data.displayName || user.displayName || '',
              email: data.email || user.email || '',
              selectedNiches: data.selectedNiches || [],
              primaryNiche: data.primaryNiche, // Fetch primary niche
              notifications: { // Provide defaults robustly
                  emailWeeklyForecast: data.notifications?.emailWeeklyForecast ?? true, // Default weekly email to true
                  slackEnabled: data.notifications?.slackEnabled ?? false,
                  slackWebhookUrl: data.notifications?.slackWebhookUrl ?? '',
                  // emailDailySummary: data.notifications?.emailDailySummary ?? false, // Default daily to false if kept
              },
              subscription: data.subscription || { plan: 'free', status: 'active' },
            };
             // Ensure primaryNiche is included in selectedNiches if it exists
            if (currentSettings.primaryNiche && !currentSettings.selectedNiches.includes(currentSettings.primaryNiche)) {
                currentSettings.selectedNiches.push(currentSettings.primaryNiche);
            }
             // For free users, enforce only 1 niche (preferably primary, else first)
            if (currentSettings.subscription.plan === 'free' && currentSettings.selectedNiches.length > 1) {
                currentSettings.selectedNiches = currentSettings.primaryNiche
                    ? [currentSettings.primaryNiche]
                    : currentSettings.selectedNiches.length > 0
                        ? [currentSettings.selectedNiches[0]]
                        : [];
                console.warn("Corrected selected niches for free user.");
            }


            setSettings(currentSettings);
            setInitialSettings(JSON.parse(JSON.stringify(currentSettings))); // Deep copy
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
        setLoading(false);
        setError("Please log in to access settings.");
    }
  }, [user]);

  const handleNicheChange = (niche: string, checked: boolean | string) => {
     const currentNiches = settings.selectedNiches || [];
     let updatedNiches;

     if (checked) { // Adding a niche
         if (isPaidUser || currentNiches.length < 1) {
             updatedNiches = [...currentNiches, niche];
             // If it's the first niche being added, also make it primary
             if (currentNiches.length === 0) {
                 setSettings(prev => ({ ...prev, selectedNiches: updatedNiches, primaryNiche: niche }));
                 return; // State update includes primary niche
             }
         } else { // Free user trying to add more than one
             toast({
                title: "Upgrade Required",
                description: "Free users can only select 1 niche. Upgrade to select more.",
                variant: "destructive"
             });
             return; // Prevent adding
         }
     } else { // Removing a niche
         // Prevent removing the last niche
         if (currentNiches.length <= 1) {
             toast({ title: "Action Denied", description: "You must have at least one niche selected.", variant: "destructive" });
             return;
         }
         updatedNiches = currentNiches.filter(n => n !== niche);
         // If the primary niche is being removed, clear it or set a new one
         if (settings.primaryNiche === niche) {
             setSettings(prev => ({
                 ...prev,
                 selectedNiches: updatedNiches,
                 primaryNiche: updatedNiches[0] // Set primary to the first remaining niche
             }));
             return; // State update includes primary niche
         }
     }
     setSettings(prev => ({ ...prev, selectedNiches: updatedNiches }));
  };

   // Handle setting a niche as primary
   const handleSetPrimaryNiche = (niche: string) => {
        if (!settings.selectedNiches?.includes(niche)) {
             toast({ title: "Invalid Action", description: "Cannot set an unselected niche as primary.", variant: "destructive" });
            return;
        }
        setSettings(prev => ({ ...prev, primaryNiche: niche }));
   }


  const handleNotificationChange = (key: keyof UserSettings['notifications'], value: any) => {
     // Prevent enabling paid features for free users
     if (key === 'slackEnabled' && !isPaidUser && value) {
         toast({ title: "Upgrade Required", description: "Slack notifications require a Premium plan.", variant: "destructive" });
         return;
     }

     setSettings(prev => ({
        ...prev,
        notifications: {
            ...(prev.notifications || { emailWeeklyForecast: true, slackEnabled: false }), // Default structure
            [key]: value,
            // If Slack is disabled, clear the webhook URL
            slackWebhookUrl: key === 'slackEnabled' && !value ? '' : prev.notifications?.slackWebhookUrl,
        },
     }));
  };

 const handleSaveChanges = async () => {
    if (!user || !hasChanges) return;
    setSaving(true);
    setError(null);

    // Validate: Ensure at least one niche is selected
    if (!settings.selectedNiches || settings.selectedNiches.length === 0) {
        toast({ title: "Validation Error", description: "Please select at least one niche.", variant: "destructive" });
        setSaving(false);
        return;
    }
     // Validate: Ensure primaryNiche is set if niches exist, and is one of the selected
    if (settings.selectedNiches.length > 0 && (!settings.primaryNiche || !settings.selectedNiches.includes(settings.primaryNiche))) {
         toast({ title: "Validation Error", description: "Please select a primary niche from your selected niches.", variant: "destructive" });
         setSaving(false);
        return;
    }

    // Validate Slack URL if enabled
    if (settings.notifications?.slackEnabled && !settings.notifications?.slackWebhookUrl?.startsWith('https://hooks.slack.com/')) {
        toast({ title: "Invalid Slack URL", description: "Please enter a valid Slack Webhook URL.", variant: "destructive" });
        setSaving(false);
        return;
    }

    // Prepare data to save
    const dataToSave: Partial<UserSettings> = { // Only include fields managed here
        displayName: settings.displayName,
        selectedNiches: settings.selectedNiches,
        primaryNiche: settings.primaryNiche,
        notifications: settings.notifications,
    };


    try {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, dataToSave);

        // Update Firebase Auth profile displayName if changed
        if (settings.displayName !== initialSettings.displayName && auth.currentUser) {
             try {
                 await updateProfile(auth.currentUser, { displayName: settings.displayName }); // Use updateProfile
                 console.log("Firebase Auth profile updated.");
             } catch (authError) {
                 console.warn("Could not update auth profile display name:", authError);
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


 if (loading) { // --- Skeleton State ---
    return (
       <div className="space-y-6">
         <Card><CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader><CardContent className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent></Card>
         <Card><CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader><CardContent><Skeleton className="h-24 w-full" /></CardContent></Card>
         <Card><CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader><CardContent className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent></Card>
         <Skeleton className="h-10 w-24 ml-auto" />
       </div>
    );
 }

 if (error && !loading) { // --- Error State ---
     return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
 }

 return ( // --- Main Content ---
    <div className="space-y-6">
        {/* Account Information */}
        <Card>
            <CardHeader><CardTitle>Account Information</CardTitle><CardDescription>Manage profile details.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2"><Label htmlFor="displayName">Display Name</Label><Input id="displayName" value={settings.displayName || ''} onChange={(e) => setSettings(prev => ({ ...prev, displayName: e.target.value }))} disabled={saving}/></div>
                <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" value={settings.email || ''} disabled readOnly /><p className="text-xs text-muted-foreground">Email cannot be changed here.</p></div>
                <div className="space-y-2"><Label>Subscription Plan</Label><div><Badge variant={isPaidUser ? "default" : "secondary"} className={isPaidUser ? "bg-green-100 text-green-800 dark:bg-green-900/10 dark:text-green-200" : ""}>{settings.subscription?.plan?.toUpperCase()}</Badge>{!isPaidUser && (<Link href="/dashboard/billing" className="ml-2 text-sm text-accent hover:underline">Upgrade Plan</Link>)}</div></div>
            </CardContent>
        </Card>

        {/* Niche Selection */}
        <Card>
            <CardHeader>
                <CardTitle>Niche Selection</CardTitle>
                <CardDescription>Select niches for forecasts. {!isPaidUser && "Free users select 1."} Set one as primary.</CardDescription>
            </CardHeader>
            <CardContent>
                {!isPaidUser && (settings.selectedNiches || []).length >= 1 && (
                     <Alert className="mb-4 bg-accent/10 border-accent/30"><Rocket className="h-4 w-4 !text-accent" /><AlertTitle className="text-accent">Want More Niches?</AlertTitle><AlertDescription><Link href="/dashboard/billing" className="font-semibold underline">Upgrade to Premium</Link> to select and track multiple niches.</AlertDescription></Alert>
                 )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-6">
                    {ALL_NICHES.map(niche => {
                         const isChecked = settings.selectedNiches?.includes(niche);
                         const isPrimary = settings.primaryNiche === niche;
                         const isDisabled = saving || (!isPaidUser && !isChecked && (settings.selectedNiches || []).length >= 1);

                         return (
                            <div key={niche} className="flex items-center space-x-2 relative group">
                                <Checkbox
                                    id={`niche-${niche}`}
                                    checked={isChecked}
                                    onCheckedChange={(checked) => handleNicheChange(niche, checked)}
                                    disabled={isDisabled}
                                />
                                <Label htmlFor={`niche-${niche}`} className={`text-sm font-medium leading-none ${isDisabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'} ${isPrimary ? 'text-accent font-semibold' : ''}`}>
                                    {niche}
                                </Label>
                                {/* Button to set as primary */}
                                {isChecked && !isPrimary && (
                                    <Button
                                        variant="ghost" size="sm"
                                        className="absolute -right-1 -top-1 h-6 px-1 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => handleSetPrimaryNiche(niche)}
                                        disabled={saving}
                                        title="Set as primary"
                                    >
                                        Primary
                                    </Button>
                                )}
                                {isPrimary && <Badge variant="outline" className="absolute -right-1 -top-1 h-5 px-1.5 text-xs bg-accent/10 text-accent border-accent/50">Primary</Badge>}
                            </div>
                         );
                     })}
                </div>
                 {(settings.selectedNiches?.length ?? 0) > 0 && !settings.primaryNiche && (
                     <p className="text-sm text-destructive mt-4">Please select a primary niche from your selections above.</p>
                 )}
            </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
            <CardHeader><CardTitle>Notification Settings</CardTitle><CardDescription>Choose how to receive forecast alerts.</CardDescription></CardHeader>
            <CardContent className="space-y-6">
                 {/* Weekly Email */}
                 <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
                    <Label htmlFor="emailWeeklyForecast" className="flex flex-col space-y-1"><span className="flex items-center gap-2"><Mail className="h-4 w-4"/>Weekly Forecast Email</span><span className="font-normal leading-snug text-muted-foreground">Receive a weekly email with the latest forecast.</span></Label>
                    <Switch id="emailWeeklyForecast" checked={settings.notifications?.emailWeeklyForecast} onCheckedChange={(checked) => handleNotificationChange('emailWeeklyForecast', checked)} disabled={saving}/>
                 </div>

                 {/* Slack */}
                 <div className={`space-y-4 p-4 border rounded-lg ${!isPaidUser ? 'opacity-60 cursor-not-allowed' : ''}`}>
                     <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="slackEnabled" className={`flex flex-col space-y-1 ${!isPaidUser ? 'cursor-not-allowed' : ''}`}><span className="flex items-center gap-2"><svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.527 2.527 0 0 1 2.523 2.522A2.527 2.527 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.528 2.528 0 0 1 2.52-2.52h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" /></svg>Slack Notifications (Premium)</span><span className="font-normal leading-snug text-muted-foreground">Receive alerts directly in your Slack workspace.</span></Label>
                         <Switch id="slackEnabled" checked={settings.notifications?.slackEnabled} onCheckedChange={(checked) => handleNotificationChange('slackEnabled', checked)} disabled={saving || !isPaidUser} aria-disabled={!isPaidUser}/>
                     </div>
                     {/* Show Slack URL input only if enabled AND paid */}
                     {settings.notifications?.slackEnabled && isPaidUser && (
                         <div className="space-y-2 pl-2 pt-2 border-l-2 border-border ml-2">
                             <Label htmlFor="slackWebhookUrl">Slack Webhook URL</Label>
                             <Input id="slackWebhookUrl" type="url" placeholder="https://hooks.slack.com/services/..." value={settings.notifications?.slackWebhookUrl || ''} onChange={(e) => handleNotificationChange('slackWebhookUrl', e.target.value)} disabled={saving}/>
                             <p className="text-xs text-muted-foreground">Find this URL in your Slack app's Incoming Webhooks configuration.</p>
                         </div>
                     )}
                 </div>
            </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
            <Button onClick={handleSaveChanges} disabled={saving || !hasChanges}>
                {saving ? 'Saving...' : (hasChanges ? 'Save Changes' : 'No Changes')}
            </Button>
        </div>
    </div>
 );
}
