
"use client";

import { useEffect, useState } from 'react';
import {
    doc, getDoc, updateDoc, arrayUnion, arrayRemove,
    collection, query, where, orderBy, limit, getDocs,
    Timestamp, FirestoreError, enableNetwork
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Rocket, Bookmark, Settings, WifiOff, HelpCircle, BarChart, BrainCircuit } from 'lucide-react'; // Updated icons
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns'; // Import date formatting

// --- Data Structures ---

// Represents a single forecast item within a weekly forecast document
interface ForecastItem {
    id: string; // Unique ID for the item (e.g., generated UUID)
    title: string; // Catchy title for the predicted trend/format
    description: string; // Detailed explanation and actionable advice
    confidence?: number; // Optional: AI's confidence score (0-1)
    hashtags?: string[]; // Optional: Suggested hashtags
    // Add other relevant fields like 'example_prompt', 'visual_style', etc.
}

// Represents the weekly forecast document stored in Firestore
interface WeeklyForecast {
    id: string; // Firestore document ID (e.g., 'niche_YYYY-WW')
    niche: string; // The niche this forecast is for
    weekStartDate: Date; // Start date of the forecast week (e.g., Monday)
    generatedAt: Date; // Timestamp when the forecast was generated
    forecastItems: ForecastItem[];
    // Optional: Add overall summary or revival suggestion here
    revivalSuggestion?: {
        title: string;
        description: string;
    };
    saved?: boolean; // Derived client-side based on userData
}

// Represents the user's data in Firestore
interface UserData {
    uid: string;
    displayName: string | null;
    email: string | null;
    selectedNiches: string[];
    primaryNiche?: string; // Optional, but useful
    subscription: {
        plan: 'free' | 'paid';
        status: string; // e.g., 'active', 'trialing', 'canceled'
    };
    savedForecastItemIds?: string[]; // Store IDs of saved individual forecast items
    // Add other fields like slackWebhookUrl if needed
    isOffline?: boolean; // Flag added by fetch function
}


// --- Firestore Fetching Functions ---

// Fetch user data from Firestore
async function fetchUserData(uid: string): Promise<UserData | null> {
    console.log(`DashboardPage: Fetching user data for UID: ${uid}`);
    const userDocRef = doc(db, "users", uid);
    let isOffline = false;
    try {
        await enableNetwork(db);
        console.log("DashboardPage: Network enabled for fetching user data.");
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            console.log("DashboardPage: User document found:", userDocSnap.data());
            return userDocSnap.data() as UserData; // Assume data matches UserData interface
        } else {
            console.warn(`DashboardPage: No user document found for UID: ${uid}`);
            return null;
        }
    } catch (error) {
        console.error(`DashboardPage: Error fetching user data for ${uid}:`, error);
        if (error instanceof FirestoreError && (error.code === 'unavailable' || error.message.includes('offline'))) {
            isOffline = true;
            console.warn("DashboardPage: Firestore appears to be offline trying to fetch user data.");
            try {
                const userDocSnap = await getDoc(userDocRef); // Try getting from cache
                 if (userDocSnap.exists()) {
                    console.log("DashboardPage: User document found in cache (offline).", userDocSnap.data());
                    return { ...userDocSnap.data(), isOffline: true } as UserData; // Add offline flag
                } else {
                     console.error("DashboardPage: User document not found, even in cache (offline).");
                     throw new Error("Could not load user data. You appear to be offline and no cached data is available.");
                 }
            } catch (cacheError) {
                 console.error("DashboardPage: Error fetching user data from cache:", cacheError);
                 throw new Error("Could not load user data. You appear to be offline.");
            }
        }
        throw error; // Rethrow other errors
    }
}

// Fetch the latest weekly forecast for a specific niche
async function fetchLatestForecastForNiche(niche: string): Promise<WeeklyForecast | null> {
    console.log(`DashboardPage: Fetching latest forecast for niche "${niche}" from Firestore...`);
    if (!niche || niche.toLowerCase() === 'all') {
        console.log("DashboardPage: Cannot fetch forecast for 'all' niches directly. Requires a specific niche.");
        return null; // Or fetch the primary niche's forecast if logic requires
    }

    const forecastsCollection = collection(db, 'forecasts'); // Assuming 'forecasts' collection
    // Query for the specific niche, ordered by week start date descending, limit 1
    const forecastQuery = query(
        forecastsCollection,
        where('niche', '==', niche),
        orderBy('weekStartDate', 'desc'),
        limit(1)
    );

    console.log("DashboardPage: Firestore query constraints:", [
        where('niche', '==', niche),
        orderBy('weekStartDate', 'desc'),
        limit(1)
    ].map(c => c.type + ': ' + JSON.stringify(c._queryOptions || c)));

    try {
        await enableNetwork(db);
        console.log("DashboardPage: Network enabled for fetching forecast.");
        const querySnapshot = await getDocs(forecastQuery);

        if (querySnapshot.empty) {
            console.log(`DashboardPage: No forecast found for niche "${niche}".`);
            return null;
        }

        const docSnap = querySnapshot.docs[0];
        const data = docSnap.data();
        console.log(`DashboardPage: Found forecast (ID: ${docSnap.id}) for niche "${niche}":`, data);

         if (!data.niche || !data.weekStartDate || !data.generatedAt || !Array.isArray(data.forecastItems)) {
             console.warn(`DashboardPage: Skipping forecast with missing essential data (ID: ${docSnap.id}):`, data);
             return null;
         }


        const forecast: WeeklyForecast = {
            id: docSnap.id,
            niche: data.niche,
            weekStartDate: (data.weekStartDate as Timestamp)?.toDate() || new Date(0),
            generatedAt: (data.generatedAt as Timestamp)?.toDate() || new Date(0),
            forecastItems: data.forecastItems as ForecastItem[], // Assuming items are stored correctly
            revivalSuggestion: data.revivalSuggestion,
            // 'saved' status will be applied later
        };
        return forecast;

    } catch (error) {
        console.error(`DashboardPage: Error fetching forecast for niche "${niche}" from Firestore:`, error);
        if (error instanceof FirestoreError && error.code === 'failed-precondition') {
             console.error(
                "Firestore query failed: This usually indicates a missing Firestore index. " +
                `Please create an index on the 'forecasts' collection with fields: 'niche' (Ascending/Descending) and 'weekStartDate' (Descending). ` +
                "Check the Firestore console (Database > Indexes) for an automatic index creation link."
             );
             throw new Error("Database query error: A required index is missing. Please check Firestore indexes or contact support.");
        } else if (error instanceof FirestoreError && (error.code === 'unavailable' || error.message.includes('offline'))) {
            console.warn("DashboardPage: Firestore query failed for forecast: Client appears to be offline.");
             // Attempt to get from cache
            try {
                const querySnapshot = await getDocs(forecastQuery);
                if (!querySnapshot.empty) {
                    const docSnap = querySnapshot.docs[0];
                    const data = docSnap.data();
                     if (!data.niche || !data.weekStartDate || !data.generatedAt || !Array.isArray(data.forecastItems)) {
                        console.warn(`DashboardPage: Skipping forecast (from cache) with missing essential data (ID: ${docSnap.id}):`, data);
                        return null;
                     }
                    console.log(`DashboardPage: Fetched forecast from Firestore cache (offline).`);
                    return {
                        id: docSnap.id,
                        niche: data.niche,
                        weekStartDate: (data.weekStartDate as Timestamp)?.toDate() || new Date(0),
                        generatedAt: (data.generatedAt as Timestamp)?.toDate() || new Date(0),
                        forecastItems: data.forecastItems as ForecastItem[],
                        revivalSuggestion: data.revivalSuggestion,
                         // isOffline: true, // Maybe add flag to forecast itself? Or rely on userData.isOffline
                    } as WeeklyForecast;
                }
                 console.log(`DashboardPage: No forecast found in cache (offline).`);
                return null;
            } catch (cacheError) {
                 console.error("DashboardPage: Error fetching forecast from cache:", cacheError);
                 throw new Error("Could not load forecast. You appear to be offline.");
            }
        }
        throw error; // Re-throw other errors
    }
}


// --- Component Logic ---

export default function DashboardPage() {
  const { user } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [latestForecast, setLatestForecast] = useState<WeeklyForecast | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingForecast, setLoadingForecast] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineError, setIsOfflineError] = useState(false);
  const [isIndexError, setIsIndexError] = useState(false);

  // Fetch User Data Effect
  useEffect(() => {
    if (user) {
      console.log("DashboardPage: Auth state changed, user found. Fetching user data...");
      const loadUserData = async () => {
        setLoadingUser(true);
        setError(null);
        setIsOfflineError(false);
        setIsIndexError(false);
        try {
          const data = await fetchUserData(user.uid);
          if (data) {
             setUserData(data);
             setIsOfflineError(!!data.isOffline); // Set offline status from fetched data
             if (data.isOffline) {
                setError("Could not load fresh data. You appear to be offline.");
             } else {
                setError(null); // Clear error if fetch succeeded online
             }
             console.log("DashboardPage: User data loaded.", data.isOffline ? "(Offline)" : "(Online)");
          } else {
             console.error("DashboardPage: User document missing or not synced for UID:", user.uid);
             setError("User profile not found or couldn't be loaded. Ensure you are online and refresh. If the problem persists, contact support.");
          }
        } catch (err: any) {
          console.error("DashboardPage: Error fetching user data in useEffect:", err);
          const errorMessage = err.message || "Could not load user information.";
          setError(errorMessage);
          if (errorMessage.includes("offline")) setIsOfflineError(true);
        } finally {
          setLoadingUser(false);
          console.log("DashboardPage: Finished loading user data attempt.");
        }
      };
      loadUserData();
    } else if (!loadingUser && !user) {
        console.log("DashboardPage: No user logged in.");
        setLoadingUser(false);
        setLoadingForecast(false);
    }
  }, [user]); // Re-run only when user object changes

  // Fetch Forecast Data Effect (Depends on User Data)
 useEffect(() => {
    if (userData && !loadingUser) {
      console.log("DashboardPage: User data available, proceeding to load forecast.");
      let nicheToFetch: string | undefined = 'all'; // Default or placeholder

      if (userData.selectedNiches && userData.selectedNiches.length > 0) {
          nicheToFetch = userData.primaryNiche && userData.selectedNiches.includes(userData.primaryNiche)
              ? userData.primaryNiche
              : userData.selectedNiches[0];
          console.log(`DashboardPage: User has selected niches. Fetching forecast for: "${nicheToFetch}"`);
      } else {
          console.log("DashboardPage: User has no selected niches. Cannot fetch specific forecast.");
          // Display a message prompting user to select niches
          setError(prevError => prevError || "Please select at least one niche in settings to view forecasts.");
          setLoadingForecast(false);
          setLatestForecast(null); // Clear any previous forecast
          return; // Stop if no niche is selected
      }

      if (!nicheToFetch) {
          console.error("DashboardPage: nicheToFetch is unexpectedly undefined.");
          setError("Could not determine which niche to fetch forecast for.");
          setLoadingForecast(false);
          return;
      }

      const loadForecast = async () => {
            setLoadingForecast(true);
            if (!isOfflineError) { // Don't clear offline errors
                setError(null);
                setIsIndexError(false);
            }

            try {
              const forecastData = await fetchLatestForecastForNiche(nicheToFetch!); // Fetch for the determined niche

              if (forecastData) {
                  // Apply saved status to each forecast item
                  const savedIds = userData?.savedForecastItemIds || [];
                  const itemsWithSaveStatus = forecastData.forecastItems.map(item => ({
                     ...item,
                     saved: savedIds.includes(item.id),
                  }));
                  setLatestForecast({ ...forecastData, forecastItems: itemsWithSaveStatus });
                  console.log("DashboardPage: Forecast loaded and processed successfully.");
                  // If forecast fetch succeeds, potentially clear offline error IF user data also succeeded online
                  if (!userData.isOffline) {
                      setIsOfflineError(false);
                      setError(null);
                  }
              } else {
                  console.log("DashboardPage: No forecast available for the selected niche currently.");
                  setLatestForecast(null);
                  setError(prev => prev || `No forecast found for "${nicheToFetch}". Check back next week or select a different niche.`);
                   if (!userData.isOffline) { // Clear offline error if no forecast found but online
                       setIsOfflineError(false);
                   }
              }

            } catch (err: any) {
              console.error("DashboardPage: Error fetching or processing forecast:", err);
              const errorMessage = err.message || "Could not load the latest forecast.";
              setError(errorMessage);
              if (errorMessage.includes("offline")) {
                  setIsOfflineError(true);
              } else if (errorMessage.includes("index is missing")) {
                  setIsIndexError(true);
                  setIsOfflineError(false); // Ensure offline is false if it's an index error
              }
              setLatestForecast(null); // Clear forecast on error
            } finally {
              setLoadingForecast(false);
               console.log("DashboardPage: Finished loading forecast attempt.");
            }
      };
      loadForecast();

    } else if (!loadingUser && !userData && user && !isOfflineError) {
        console.log("DashboardPage: User data failed to load, skipping forecast fetch.");
        setLoadingForecast(false);
    } else if (!user) {
        console.log("DashboardPage: No user, skipping forecast fetch.");
        setLoadingForecast(false);
    }
 }, [userData, loadingUser]); // Rerun when userData or loadingUser changes


 // --- Actions ---

 const handleSaveForecastItem = async (itemId: string) => {
    if (!user || !userData || !latestForecast) return;

    const isPaid = userData.subscription?.plan === 'paid';
    if (!isPaid) {
        alert("Saving forecast items is a premium feature. Please upgrade your plan.");
        return;
    }
     if (isOfflineError) {
        alert("Cannot save items while offline.");
        return;
     }


    const currentlySaved = (userData.savedForecastItemIds || []).includes(itemId);
    const newSavedState = !currentlySaved;

    // Optimistic UI update for the specific item
    setLatestForecast(prevForecast => {
        if (!prevForecast) return null;
        return {
            ...prevForecast,
            forecastItems: prevForecast.forecastItems.map(item =>
                item.id === itemId ? { ...item, saved: newSavedState } : item
            )
        };
    });
    // Also update userData state optimistically
    setUserData((prev: UserData | null) => {
        if (!prev) return null;
        const currentSavedIds = prev.savedForecastItemIds || [];
        return {
            ...prev,
            savedForecastItemIds: newSavedState
                ? [...currentSavedIds, itemId]
                : currentSavedIds.filter((id: string) => id !== itemId),
        };
    });


    // Firestore update
    try {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
            savedForecastItemIds: newSavedState ? arrayUnion(itemId) : arrayRemove(itemId)
        });
         console.log(`Forecast item ${itemId} ${newSavedState ? 'saved' : 'unsaved'} successfully.`);
    } catch (firestoreError) {
        console.error("Failed to update saved forecast item in Firestore:", firestoreError);
        // Revert optimistic UI update on error
         setLatestForecast(prevForecast => {
             if (!prevForecast) return null;
             return {
                ...prevForecast,
                forecastItems: prevForecast.forecastItems.map(item =>
                    item.id === itemId ? { ...item, saved: currentlySaved } : item // Revert item state
                )
             };
         });
         setUserData((prev: UserData | null) => { // Revert user data state
            if (!prev) return null;
            const currentSavedIds = prev.savedForecastItemIds || [];
             return {
                 ...prev,
                 savedForecastItemIds: currentlySaved
                     ? [...currentSavedIds, itemId] // Add back if removal failed
                     : currentSavedIds.filter((id: string) => id !== itemId), // Remove if addition failed
             };
         });
        alert(`Failed to ${newSavedState ? 'save' : 'unsave'} forecast item. Please try again.`);
    }
  };

  // --- Render Logic ---

  const isLoading = loadingUser || loadingForecast;
  const isPaidUser = userData?.subscription?.plan === 'paid';

   if (loadingUser) {
     return ( // --- Skeleton Loading State for User Data ---
        <div className="space-y-6">
            <Card><CardHeader><Skeleton className="h-8 w-48" /></CardHeader><CardContent><Skeleton className="h-16 w-full" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-6 w-40" /></CardHeader><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>
        </div>
     );
   }

    // --- Error State ---
    // Display primary error if exists (user or forecast related)
    if (error && !loadingUser) { // Show error once user loading is done
        const title = isOfflineError ? "Offline Notice" : (isIndexError ? "Database Query Error" : "Error Loading Dashboard");
        return (
             <div className="space-y-6">
                 <Alert variant={isOfflineError ? "default" : "destructive"} className={isOfflineError ? "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10" : ""}>
                      {isOfflineError ? <WifiOff className="h-4 w-4 text-yellow-600 dark:text-yellow-400" /> : (isIndexError ? <HelpCircle className="h-4 w-4"/> : null)}
                     <AlertTitle>{title}</AlertTitle>
                     <AlertDescription>
                         {error}
                         {error.includes("User profile not found") && !isOfflineError && (
                            <div className="mt-4">
                                <p className="text-xs">If you just signed up, wait a moment and refresh. Otherwise, contact support.</p>
                                <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-2">Refresh Page</Button>
                            </div>
                         )}
                         {isIndexError && (
                           <span className="block mt-1 text-xs">This often means a required Firestore index is missing. Check console logs or contact support.</span>
                         )}
                         {isOfflineError && (
                            <span className="block mt-1 text-xs">Some data might be cached. Real-time updates unavailable. Check connection.</span>
                         )}
                     </AlertDescription>
                 </Alert>
                  {/* Optionally show basic welcome if offline but have user data */}
                  {userData && isOfflineError && (
                     <div className="opacity-70 pointer-events-none">
                         <Card>
                            <CardHeader><CardTitle>Welcome, {userData.displayName || 'User'}! (Offline)</CardTitle></CardHeader>
                         </Card>
                     </div>
                  )}
            </div>
        );
    }

     // --- Loading State for Forecast ---
     if (isLoading && userData) { // Show forecast loading only after user data is potentially ready
         return (
            <div className="space-y-6">
                 <Card>
                    <CardHeader>
                        <CardTitle>Welcome, {userData?.displayName || 'User'}!</CardTitle>
                         <CardDescription>
                             Here's your dashboard. {isOfflineError && <span className="text-yellow-600 dark:text-yellow-400 font-semibold">(Offline - Cached Data)</span>}
                         </CardDescription>
                    </CardHeader>
                     <CardContent>
                         {!isPaidUser && !isOfflineError && ( /* Upgrade Prompt */ <Alert className="mt-4 bg-accent/10 border-accent/30 text-accent-foreground"><Rocket className="h-4 w-4 !text-accent" /><AlertTitle className="text-accent">Go Premium!</AlertTitle><AlertDescription className="text-muted-foreground">Unlock multiple niches, saved forecasts, and Slack integration.<Link href="/dashboard/billing" className="ml-2 font-semibold underline">Upgrade</Link></AlertDescription></Alert> )}
                         {userData?.selectedNiches?.length === 0 && !isOfflineError && ( /* Niche Prompt */ <Alert variant="destructive" className="mt-4"><Settings className="h-4 w-4" /><AlertTitle>Select Your Niches</AlertTitle><AlertDescription>Go to <Link href="/dashboard/settings" className="font-semibold underline">Settings</Link> to choose the niches you want forecasts for.</AlertDescription></Alert> )}
                    </CardContent>
                 </Card>
                <Card>
                    <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
                    <CardContent className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                             <div key={i} className="flex items-start space-x-4 p-4 border rounded-lg">
                                <Skeleton className="h-10 w-10 rounded-md shrink-0 mt-1" />
                                <div className="space-y-2 flex-grow">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-full" />
                                     <Skeleton className="h-3 w-1/2" />
                                </div>
                                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
         );
     }

  // --- Main Dashboard Content ---
  if (userData) { // Render main content if user data exists (even if offline/cached)
      return (
        <div className="space-y-6">
          {/* Welcome Card & Prompts */}
          <Card>
            <CardHeader>
              <CardTitle>Welcome, {userData?.displayName || 'User'}!</CardTitle>
              <CardDescription>
                Your AI-powered social media forecast for the week.
                 {isOfflineError && <span className="text-yellow-600 dark:text-yellow-400 font-semibold"> (Offline - Data may be outdated)</span>}
              </CardDescription>
            </CardHeader>
            <CardContent>
               {!isPaidUser && !isOfflineError && ( // Upgrade prompt - Hide if offline
                  <Alert className="mt-4 bg-accent/10 border-accent/30 text-accent-foreground">
                     <Rocket className="h-4 w-4 !text-accent" />
                     <AlertTitle className="text-accent">Go Premium!</AlertTitle>
                     <AlertDescription className="text-muted-foreground">
                       Unlock multiple niches, saved forecasts, and Slack integration.
                       <Link href="/dashboard/billing" className="ml-2 font-semibold underline">Upgrade Now</Link>
                     </AlertDescription>
                   </Alert>
               )}
               {userData?.selectedNiches?.length === 0 && !isOfflineError && ( // Prompt to select niches
                   <Alert variant="destructive" className="mt-4">
                     <Settings className="h-4 w-4" />
                     <AlertTitle>Select Your Niches</AlertTitle>
                     <AlertDescription>
                       Go to <Link href="/dashboard/settings" className="font-semibold underline">Settings</Link> to choose the niches you want forecasts for.
                     </AlertDescription>
                   </Alert>
               )}
               {userData?.selectedNiches && userData.selectedNiches.length > 0 && (
                   <p className="mt-4 text-sm text-muted-foreground">
                     Currently viewing forecast for: <span className="font-semibold">{latestForecast?.niche || userData.primaryNiche || userData.selectedNiches[0]}</span>
                   </p>
               )}
            </CardContent>
          </Card>

          {/* Latest Forecast Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                   <BarChart className="h-5 w-5" /> Weekly Forecast
                </CardTitle>
                <CardDescription>
                   {latestForecast
                      ? `Predictions for ${latestForecast.niche} (Week of ${latestForecast.weekStartDate.toLocaleDateString()})`
                      : (userData?.selectedNiches?.length > 0 ? "Loading forecast..." : "Select a niche in settings")
                   }
                </CardDescription>
              </div>
               <Link href="/dashboard/forecasts">
                 <Button variant="outline" size="sm" disabled={isOfflineError}>View Past Forecasts</Button>
               </Link>
            </CardHeader>
            <CardContent>
              {latestForecast ? (
                <ul className="space-y-4">
                  {latestForecast.forecastItems.map((item) => (
                    <li key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                       <div className="flex items-start gap-4 mb-2 sm:mb-0 flex-grow min-w-0">
                            <div className="p-2 bg-secondary rounded-md mt-1 shrink-0">
                               <BrainCircuit className="h-6 w-6 text-accent" /> {/* Icon for forecast item */}
                            </div>
                           <div className="flex-grow min-w-0">
                              <h3 className="font-semibold">{item.title}</h3>
                               <p className="text-sm text-muted-foreground mt-1">
                                 {item.description}
                               </p>
                               {item.confidence && (
                                 <p className="text-xs text-muted-foreground/80 mt-1">
                                     Confidence: {Math.round(item.confidence * 100)}%
                                </p>
                               )}
                                {item.hashtags && item.hashtags.length > 0 && (
                                    <p className="text-xs text-blue-500 dark:text-blue-400 mt-1 truncate">
                                        Suggested: {item.hashtags.join(' ')}
                                    </p>
                                )}
                           </div>
                       </div>
                      {/* Save Button */}
                      <Button
                          variant={item.saved ? "secondary" : "ghost"}
                          size="icon"
                          className={`mt-2 sm:mt-0 sm:ml-4 shrink-0 ${item.saved ? 'text-accent' : ''}`}
                          onClick={() => handleSaveForecastItem(item.id)}
                          aria-label={item.saved ? "Unsave forecast item" : "Save forecast item"}
                          disabled={isLoading || isOfflineError || !isPaidUser}
                          title={isOfflineError ? "Cannot save while offline" : (isPaidUser ? (item.saved ? "Unsave item" : "Save item") : "Upgrade to save items")}
                        >
                          <Bookmark className={`h-5 w-5 ${item.saved ? 'fill-current' : ''}`} />
                      </Button>
                    </li>
                  ))}
                   {/* Optional Revival Suggestion */}
                   {latestForecast.revivalSuggestion && (
                        <li className="p-4 border border-dashed rounded-lg bg-blue-50 dark:bg-blue-900/20">
                             <h4 className="font-semibold text-blue-700 dark:text-blue-300">Past Trend Revival</h4>
                             <p className="text-sm text-muted-foreground mt-1">{latestForecast.revivalSuggestion.title}: {latestForecast.revivalSuggestion.description}</p>
                        </li>
                   )}
                </ul>
              ) : ( // No Forecast Data (and not loading, not error)
                <p className="text-center text-muted-foreground py-8">
                    {isOfflineError
                        ? "Cannot load forecast while offline."
                        : (isLoading ? "Loading..." : `No forecast available for this niche yet. Check back next Monday!`)
                    }
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      );
  } else {
      // Fallback Render: Should ideally be covered by loading or error states above
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Loading dashboard...</p>
            </div>
        );
  }
}
