
"use client";

import { useEffect, useState } from 'react';
import {
    doc, getDoc, updateDoc, arrayUnion, arrayRemove,
    collection, query, where, orderBy, limit, getDocs,
    Timestamp, FirestoreError, enableNetwork
} from 'firebase/firestore';
import { db, firebaseInitialized } from '@/lib/firebase'; // Import firebaseInitialized
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bookmark, Filter, Calendar, WifiOff, HelpCircle, BrainCircuit } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format, startOfWeek, subWeeks, formatDistanceToNow } from 'date-fns'; // Added formatDistanceToNow
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast'; // Import useToast

// --- Data Structures (Mirror dashboard page for consistency) ---

interface ForecastItem {
    id: string;
    title: string;
    description: string;
    confidence?: number;
    hashtags?: string[];
    saved?: boolean; // Added for client-side state
}

interface WeeklyForecast {
    id: string; // Firestore document ID (e.g., 'niche_YYYY-WW')
    niche: string;
    weekStartDate: Date;
    generatedAt: Date;
    forecastItems: ForecastItem[];
    revivalSuggestion?: {
        title: string;
        description: string;
    };
}

interface UserData {
    uid: string;
    selectedNiches: string[];
    primaryNiche?: string;
    subscription: {
        plan: 'free' | 'paid';
        status: string;
    };
    savedForecastItemIds?: string[];
    isOffline?: boolean;
}

// --- Firestore Fetching Functions ---

// Fetch user data (simplified for this page's needs)
async function fetchUserDataForFilters(uid: string): Promise<UserData | null> {
    console.log(`ForecastsPage: Fetching user data for filters for UID: ${uid}`);
    if (!firebaseInitialized || !db) {
         console.error("ForecastsPage: Firebase not initialized. Cannot fetch user data.");
         throw new Error("Application not properly configured.");
    }
    const userDocRef = doc(db, "users", uid);
    try {
        try { await enableNetwork(db); } catch(e) { console.warn("[Firebase] Network enable failed (might be ok):", e) }
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            return {
                uid: data.uid,
                selectedNiches: data.selectedNiches || [],
                primaryNiche: data.primaryNiche,
                subscription: data.subscription || { plan: 'free', status: 'active' },
                savedForecastItemIds: data.savedForecastItemIds || [],
            };
        } else { return null; }
    } catch (error) {
        console.error(`ForecastsPage: Error fetching user data:`, error);
         if (error instanceof FirestoreError && (error.code === 'unavailable' || error.message.includes('offline'))) {
             try {
                 const userDocSnap = await getDoc(userDocRef); // Try cache
                 if (userDocSnap.exists()) {
                     return { ...userDocSnap.data(), isOffline: true } as UserData;
                 } else { throw new Error("Offline and no cached user data."); }
             } catch (cacheError) {
                  console.error("ForecastsPage: Error fetching user data from cache:", cacheError);
                  throw new Error("Could not load user data (offline).");
             }
         }
        throw new Error(`Failed to fetch user data: ${error instanceof Error ? error.message : String(error)}`);
    }
}


// Fetch forecasts based on filters (niche, date range)
async function fetchForecastsWithFilters(
    filters: { niche?: string; startDate?: Date },
    count: number = 10 // Fetch more for history, adjust as needed
): Promise<WeeklyForecast[]> {
    console.log(`ForecastsPage: Fetching forecasts with filters:`, filters);
     if (!firebaseInitialized || !db) {
         console.error("ForecastsPage: Firebase not initialized. Cannot fetch forecasts.");
         throw new Error("Application not properly configured.");
    }
    const forecastsCollection = collection(db, 'forecasts');
    const queryConstraints = [];

    // Filter by Niche
    if (filters.niche && filters.niche.toLowerCase() !== 'all') {
        queryConstraints.push(where('niche', '==', filters.niche));
    } else {
        // For 'all' or no niche filter, requires indexing or multiple queries.
        // Assuming 'all' means no niche filter, requiring index on 'weekStartDate' only.
        console.log("Fetching for 'all' niches (requires appropriate indexes)");
    }

    // Filter by Start Date
    if (filters.startDate) {
        console.log(`Applying date filter: weekStartDate >= ${filters.startDate.toISOString()}`);
        queryConstraints.push(where('weekStartDate', '>=', Timestamp.fromDate(filters.startDate)));
    }

    // Order by week start date (most recent first)
    queryConstraints.push(orderBy('weekStartDate', 'desc'));

    // Limit results
    queryConstraints.push(limit(count));

    console.log("ForecastsPage: Firestore query constraints:", queryConstraints.map(c => c.type + ': ' + JSON.stringify(c._queryOptions || c)));
    const forecastsQuery = query(forecastsCollection, ...queryConstraints);

    try {
         try { await enableNetwork(db); } catch(e) { console.warn("[Firebase] Network enable failed (might be ok):", e) }
        console.log("ForecastsPage: Attempting to fetch forecasts from Firestore...");
        const querySnapshot = await getDocs(forecastsQuery);
        const forecasts: WeeklyForecast[] = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
             if (!data.niche || !data.weekStartDate || !data.generatedAt || !Array.isArray(data.forecastItems)) {
                 console.warn(`ForecastsPage: Skipping forecast with missing data (ID: ${docSnap.id}):`, data);
                 return;
             }
            forecasts.push({
                id: docSnap.id,
                niche: data.niche,
                weekStartDate: (data.weekStartDate as Timestamp).toDate(),
                generatedAt: (data.generatedAt as Timestamp).toDate(),
                forecastItems: data.forecastItems as ForecastItem[], // Type assertion
                revivalSuggestion: data.revivalSuggestion,
            });
        });
        console.log(`ForecastsPage: Fetched ${forecasts.length} forecasts.`);
        return forecasts;
    } catch (error) {
        console.error(`ForecastsPage: Error fetching forecasts:`, error);
        if (error instanceof FirestoreError && error.code === 'failed-precondition') {
             console.error(
                "Firestore query failed: Missing index. " +
                `Index likely needed on 'forecasts' collection: ${filters.niche && filters.niche !== 'all' ? `'niche' (ASC/DESC), ` : ''}'weekStartDate' (DESC). ` +
                "Check Firestore console."
             );
             throw new Error("Database query error: A required index is missing.");
        } else if (error instanceof FirestoreError && (error.code === 'unavailable' || error.message.includes('offline'))) {
             console.warn("ForecastsPage: Firestore query failed: Client offline. Attempting cache...");
             try {
                 const querySnapshot = await getDocs(forecastsQuery);
                 const forecasts: WeeklyForecast[] = [];
                 querySnapshot.forEach((docSnap) => {
                     const data = docSnap.data();
                     if (!data.niche || !data.weekStartDate || !data.generatedAt || !Array.isArray(data.forecastItems)) return;
                     forecasts.push({
                         id: docSnap.id, niche: data.niche,
                         weekStartDate: (data.weekStartDate as Timestamp).toDate(),
                         generatedAt: (data.generatedAt as Timestamp).toDate(),
                         forecastItems: data.forecastItems as ForecastItem[],
                         revivalSuggestion: data.revivalSuggestion,
                     });
                 });
                 console.log(`ForecastsPage: Fetched ${forecasts.length} forecasts from cache (offline).`);
                 // Throw specific offline error to be handled by caller
                 throw new Error("Could not load forecasts (offline).");
             } catch (cacheError) {
                 console.error("ForecastsPage: Error fetching forecasts from cache:", cacheError);
                 throw new Error("Could not load forecasts (offline).");
             }
        }
        // Rethrow other errors or a generic one
        throw new Error(`Failed to fetch forecasts: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// --- Component Logic ---

const DATE_RANGE_OPTIONS = [
    { value: 'last_week', label: 'Last Week', weeksAgo: 1 },
    { value: 'last_4_weeks', label: 'Last 4 Weeks', weeksAgo: 4 },
    { value: 'last_12_weeks', label: 'Last 12 Weeks', weeksAgo: 12 },
    // Add more options if needed
];

export default function ForecastsPage() {
  const { user } = useAuth();
  const { toast } = useToast(); // Use the toast hook
  const [userData, setUserData] = useState<UserData | null>(null);
  const [displayedForecasts, setDisplayedForecasts] = useState<WeeklyForecast[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingForecasts, setLoadingForecasts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineError, setIsOfflineError] = useState(false);
  const [isIndexError, setIsIndexError] = useState(false);

  // Filters State
  const [selectedNiche, setSelectedNiche] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('last_4_weeks'); // Default

  // Dynamic niche options based on user's settings
  const nicheOptions = ['all', ...(userData?.selectedNiches || [])].sort((a, b) => a === 'all' ? -1 : b === 'all' ? 1 : a.localeCompare(b));

  // Fetch User Data Effect
  useEffect(() => {
    if (user) {
        setLoadingUser(true);
        setError(null); setIsOfflineError(false); setIsIndexError(false);
        fetchUserDataForFilters(user.uid)
            .then(data => {
                setUserData(data);
                setIsOfflineError(!!data?.isOffline);
                if (data?.isOffline) {
                    setError("Could not load user data (offline)."); // Set error if offline
                } else {
                    setError(null); // Clear error if online
                }
                // Set initial niche based on primary or first selected
                const initialNiche = data?.primaryNiche && data?.selectedNiches?.includes(data.primaryNiche) ? data.primaryNiche : (data?.selectedNiches?.[0] || 'all');
                const plan = data?.subscription?.plan || 'free';
                 // Free user forced to their single niche, Paid user defaults to 'all' or their primary
                const nicheForPlan = plan === 'free'
                    ? (data?.selectedNiches?.[0] || 'all')
                    : (initialNiche || 'all');
                setSelectedNiche(nicheForPlan);
            })
            .catch(err => {
                setError(err.message || "Could not load user information.");
                if (err.message.includes("offline")) setIsOfflineError(true);
                else setIsOfflineError(false);
            })
            .finally(() => setLoadingUser(false));
    } else { setLoadingUser(false); setLoadingForecasts(false); }
  }, [user]);

  // Fetch Forecasts Effect (Depends on Filters & User)
  useEffect(() => {
    if (!user || loadingUser || !userData) {
        if (!loadingUser && !userData && !isOfflineError && user) {
            console.log("ForecastsPage: User data not ready or failed, skipping forecast fetch.");
        }
        // Don't clear error here, let user fetch error persist if it exists
        setLoadingForecasts(false);
        return;
    }

    // For free users, force filter to their single niche
    let nicheToFetch = selectedNiche;
    if (userData.subscription?.plan === 'free') {
        nicheToFetch = userData.selectedNiches?.[0] || 'all';
        if (selectedNiche !== nicheToFetch) {
            // If state is inconsistent, update it and wait for re-run
            setSelectedNiche(nicheToFetch);
            return;
        }
    }


    const loadForecasts = async () => {
        setLoadingForecasts(true);
        // Don't clear offline/index error if it's already set
        if (!isOfflineError && !isIndexError) { setError(null); }

        const selectedRangeOption = DATE_RANGE_OPTIONS.find(o => o.value === selectedDateRange);
        const weeksToSubtract = selectedRangeOption?.weeksAgo || 4;
        const cutoffDate = startOfWeek(subWeeks(new Date(), weeksToSubtract), { weekStartsOn: 1 });

        try {
            const currentFilters = {
                niche: nicheToFetch === 'all' ? undefined : nicheToFetch, // Pass undefined if 'all'
                startDate: cutoffDate
            };
            const fetchedForecasts = await fetchForecastsWithFilters(currentFilters);

             const savedIds = userData?.savedForecastItemIds || [];
             const forecastsWithSaveStatus = fetchedForecasts.map(forecast => ({
                 ...forecast,
                 forecastItems: forecast.forecastItems.map(item => ({
                     ...item,
                     saved: savedIds.includes(item.id),
                 }))
             }));

            setDisplayedForecasts(forecastsWithSaveStatus);
            // Clear errors ONLY if this fetch succeeded AND user data was also fetched online
            if (!userData.isOffline) {
                setIsOfflineError(false);
                setIsIndexError(false);
                setError(null);
            }

        } catch (err: any) {
             const errorMessage = err.message || "Could not load forecasts.";
             setError(errorMessage);
             if (errorMessage.includes("offline")) { setIsOfflineError(true); setIsIndexError(false); }
             else if (errorMessage.includes("index is missing")) { setIsIndexError(true); setIsOfflineError(false); }
             else { setIsOfflineError(false); setIsIndexError(false); } // Other errors
             setDisplayedForecasts([]);
        } finally {
            setLoadingForecasts(false);
        }
    };

    loadForecasts();
  }, [user, loadingUser, userData, selectedNiche, selectedDateRange]); // Dependencies


  // Save/Unsave Action (identical to dashboard page)
 const handleSaveForecastItem = async (itemId: string, forecastId: string) => {
    if (!user || !userData) return; // Basic checks

    const isPaid = userData.subscription?.plan === 'paid';
    if (!isPaid) {
        toast({ title: "Upgrade Required", description: "Saving forecasts is a premium feature.", variant: "destructive" });
        return;
    }
    if (isOfflineError) {
        toast({ title: "Offline", description: "Cannot save items while offline.", variant: "destructive" });
        return;
    }

    const currentlySaved = (userData.savedForecastItemIds || []).includes(itemId);
    const newSavedState = !currentlySaved;

    // Optimistic UI Update
    setDisplayedForecasts(prevForecasts =>
        prevForecasts.map(forecast =>
            forecast.id === forecastId
            ? { ...forecast, forecastItems: forecast.forecastItems.map(item => item.id === itemId ? { ...item, saved: newSavedState } : item) }
            : forecast
        )
    );
    setUserData(prev => prev ? { ...prev, savedForecastItemIds: newSavedState ? [...(prev.savedForecastItemIds || []), itemId] : (prev.savedForecastItemIds || []).filter(id => id !== itemId) } : null);

    // Firestore Update
    try {
        if (!firebaseInitialized || !db) throw new Error("Firebase not initialized");
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, { savedForecastItemIds: newSavedState ? arrayUnion(itemId) : arrayRemove(itemId) });
        console.log(`Forecast item ${itemId} ${newSavedState ? 'saved' : 'unsaved'}.`);
         toast({ title: "Success", description: `Item ${newSavedState ? 'saved' : 'unsaved'}.` });
    } catch (error: any) {
        console.error("Failed to update saved forecast item:", error);
        // Revert Optimistic Update
        setDisplayedForecasts(prevForecasts =>
            prevForecasts.map(forecast =>
                forecast.id === forecastId
                ? { ...forecast, forecastItems: forecast.forecastItems.map(item => item.id === itemId ? { ...item, saved: currentlySaved } : item) }
                : forecast
            )
        );
         setUserData(prev => prev ? { ...prev, savedForecastItemIds: currentlySaved ? [...(prev.savedForecastItemIds || []), itemId] : (prev.savedForecastItemIds || []).filter(id => id !== itemId) } : null);
        toast({ title: "Error", description: `Failed to ${newSavedState ? 'save' : 'unsave'} item. ${error.message}`, variant: "destructive"});
    }
 };


  // --- Render Logic ---

  const isLoading = loadingUser || loadingForecasts;
  const isPaidUser = userData?.subscription?.plan === 'paid';
  const showFilters = !loadingUser && userData; // Show filters only if user data loaded

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Past Forecasts</CardTitle>
          <CardDescription>Review previous weekly trend predictions.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters Section */}
          {showFilters && (
             <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 border rounded-lg bg-muted/50">
                 {/* Niche Filter */}
                 <div className="flex-1 space-y-2">
                    <Label htmlFor="niche-filter">Niche</Label>
                    <Select
                        value={selectedNiche}
                        onValueChange={setSelectedNiche}
                        disabled={isLoading || isOfflineError || !isPaidUser || nicheOptions.length <= 1}
                    >
                        <SelectTrigger id="niche-filter">
                            <SelectValue placeholder="Filter by niche" />
                        </SelectTrigger>
                        <SelectContent>
                            {nicheOptions.map((niche) => (
                                <SelectItem key={niche} value={niche} disabled={!isPaidUser && niche !== 'all' && niche !== userData?.selectedNiches?.[0]}>
                                    {niche === 'all' ? 'All Your Niches' : niche}
                                    {!isPaidUser && niche !== 'all' && niche !== userData?.selectedNiches?.[0] && " (Premium required)"}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     {!isPaidUser && <p className="text-xs text-muted-foreground pt-1">Upgrade to filter by multiple niches.</p>}
                 </div>

                 {/* Date Range Filter */}
                 <div className="flex-1 space-y-2">
                    <Label htmlFor="date-filter">Date Range</Label>
                     <Select
                        value={selectedDateRange}
                        onValueChange={setSelectedDateRange}
                        disabled={isLoading || isOfflineError}
                     >
                        <SelectTrigger id="date-filter">
                            <SelectValue placeholder="Filter by date" />
                        </SelectTrigger>
                        <SelectContent>
                            {DATE_RANGE_OPTIONS.map((range) => (
                                <SelectItem key={range.value} value={range.value}>
                                    {range.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                 </div>
              </div>
          )}

          {/* Error Display */}
          {error && !loadingUser && (
              <Alert variant={isOfflineError ? "default" : "destructive"} className={isOfflineError ? "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10" : ""}>
                 {isOfflineError ? <WifiOff className="h-4 w-4 text-yellow-600 dark:text-yellow-400" /> : (isIndexError ? <HelpCircle className="h-4 w-4" /> : null)}
                 <AlertTitle>{isOfflineError ? "Offline" : (isIndexError ? "Database Query Error" : "Error")}</AlertTitle>
                 <AlertDescription>
                    {error}
                    {isIndexError && <span className="block mt-1 text-xs">Required Firestore index missing. Check console.</span>}
                    {isOfflineError && <span className="block mt-1 text-xs">Cached data may be shown. Check connection.</span>}
                 </AlertDescription>
              </Alert>
          )}

          {/* Loading or Content Display */}
          {isLoading ? ( // --- Skeleton Loading ---
            <div className="space-y-6 mt-4">
              {[...Array(2)].map((_, forecastIndex) => (
                 <Card key={forecastIndex}>
                   <CardHeader><Skeleton className="h-5 w-1/3" /></CardHeader>
                   <CardContent className="space-y-4">
                     {[...Array(3)].map((_, itemIndex) => (
                        <div key={itemIndex} className="flex items-start space-x-4 p-3 border rounded-lg">
                           <Skeleton className="h-8 w-8 rounded-md shrink-0 mt-1" />
                           <div className="space-y-2 flex-grow">
                              <Skeleton className="h-4 w-3/4" />
                              <Skeleton className="h-3 w-full" />
                           </div>
                           <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                        </div>
                     ))}
                   </CardContent>
                 </Card>
              ))}
            </div>
          ) : (!error || (isOfflineError && displayedForecasts.length > 0)) ? ( // --- Display Forecasts List (Show if no error OR if offline but have cached data) ---
            displayedForecasts.length > 0 ? (
                <div className="space-y-6 mt-4">
                {displayedForecasts.map((forecast) => (
                    <Card key={forecast.id}>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center justify-between">
                                <span>Forecast for {forecast.niche}</span>
                                <span className="text-sm font-normal text-muted-foreground">
                                    Week of {format(forecast.weekStartDate, 'MMM d, yyyy')}
                                </span>
                            </CardTitle>
                             <CardDescription>
                                Generated {formatDistanceToNow(forecast.generatedAt, { addSuffix: true })}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-3">
                               {forecast.forecastItems.map((item) => (
                                <li key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                    <div className="flex items-start gap-3 mb-2 sm:mb-0 flex-grow min-w-0">
                                         <div className="p-1.5 bg-secondary rounded-md mt-1 shrink-0">
                                            <BrainCircuit className="h-5 w-5 text-accent" />
                                         </div>
                                        <div className="flex-grow min-w-0">
                                            <h4 className="font-semibold text-sm">{item.title}</h4>
                                            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                                             {item.confidence && <p className="text-xs text-muted-foreground/80 mt-0.5">Confidence: {Math.round(item.confidence * 100)}%</p>}
                                             {item.hashtags && item.hashtags.length > 0 && <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5 truncate">Suggested: {item.hashtags.join(' ')}</p>}
                                        </div>
                                    </div>
                                    <Button
                                        variant={item.saved ? "secondary" : "ghost"}
                                        size="icon"
                                        className={`mt-2 sm:mt-0 sm:ml-3 shrink-0 h-8 w-8 ${item.saved ? 'text-accent' : ''}`}
                                        onClick={() => handleSaveForecastItem(item.id, forecast.id)}
                                        aria-label={item.saved ? "Unsave item" : "Save item"}
                                        disabled={isLoading || isOfflineError || !isPaidUser}
                                        title={isOfflineError ? "Cannot save offline" : (isPaidUser ? (item.saved ? "Unsave" : "Save") : "Upgrade to save")}
                                    >
                                        <Bookmark className={`h-4 w-4 ${item.saved ? 'fill-current' : ''}`} />
                                    </Button>
                                </li>
                               ))}
                                {forecast.revivalSuggestion && (
                                    <li className="p-3 border border-dashed rounded-lg bg-blue-50 dark:bg-blue-900/20 text-xs">
                                        <strong className="text-blue-700 dark:text-blue-300">Revival:</strong> {forecast.revivalSuggestion.title} - {forecast.revivalSuggestion.description}
                                    </li>
                                )}
                            </ul>
                        </CardContent>
                    </Card>
                ))}
                </div>
            ) : ( // --- No Forecasts Found (and not loading/error) ---
                <p className="text-center text-muted-foreground py-8 mt-4">
                    {isOfflineError ? "Cannot load forecasts while offline." : "No forecasts match your filters for this period."}
                </p>
            )
          ) : ( // --- Final Fallback (Error state without offline cache, or other unexpected state) ---
             !isLoading && <p className="text-center text-muted-foreground py-8 mt-4">Could not load forecasts due to an error.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
