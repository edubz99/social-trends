"use client";

import { useEffect, useState } from 'react';
// Updated Firestore imports for v9+ client SDK
import {
    doc, getDoc, updateDoc, arrayUnion, arrayRemove,
    collection, query, where, orderBy, limit, getDocs,
    Timestamp, FirestoreError, enableNetwork // Import enableNetwork
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Star, Filter, Calendar, WifiOff, HelpCircle } from 'lucide-react'; // Added HelpCircle
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDistanceToNow } from 'date-fns'; // For showing relative time
import { Label } from '@/components/ui/label';

// Unified trend data structure (Matches Firestore structure)
interface Trend {
    id: string; // Firestore document ID
    title: string;
    platform: 'TikTok' | 'Instagram' | 'YouTube';
    views?: number;
    likes?: number;
    category?: string;
    url: string;
    saved?: boolean; // Derived client-side
    description?: string;
    discoveredAt: Date; // Converted from Firestore Timestamp
    processedAt?: Date; // Converted from Firestore Timestamp
    categoryConfidence?: number;
}


// Fetch user data including saved trends and niches
async function fetchUserDataWithDetails(uid: string) {
    console.log(`TrendsPage: Fetching user data for UID: ${uid}`);
    const userDocRef = doc(db, "users", uid);
    try {
        // Explicitly try to enable network before fetching user data
        await enableNetwork(db);
        console.log("TrendsPage: Network enabled for fetching user data.");
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            console.log(`TrendsPage: User data found for ${uid}:`, data);
            return {
                uid: data.uid,
                email: data.email,
                displayName: data.displayName,
                primaryNiche: data.primaryNiche,
                selectedNiches: data.selectedNiches || [],
                savedTrendIds: data.savedTrendIds || [],
                subscription: data.subscription || { plan: 'free', status: 'active' },
            };
        } else {
            console.warn(`TrendsPage: No user document found for UID: ${uid}`);
            return null;
        }
    } catch (error) {
         console.error(`TrendsPage: Error fetching user data for ${uid}:`, error);
          if (error instanceof FirestoreError && (error.code === 'unavailable' || error.message.includes('offline'))) {
             console.warn("TrendsPage: Firestore appears to be offline trying to fetch user data.");
              // Attempt to get from cache
             try {
                 const userDocSnap = await getDoc(userDocRef); // Try again, might get from cache
                  if (userDocSnap.exists()) {
                     console.log("TrendsPage: User document found in cache (offline).", userDocSnap.data());
                     return { ...userDocSnap.data(), isOffline: true }; // Add flag
                 } else {
                      console.error("TrendsPage: User document not found, even in cache (offline).");
                      throw new Error("Could not load user data. You appear to be offline and no cached data is available.");
                  }
             } catch (cacheError) {
                  console.error("TrendsPage: Error fetching user data from cache:", cacheError);
                  throw new Error("Could not load user data. You appear to be offline.");
             }
         }
         throw error; // Rethrow other errors
    }
}


// Fetch trends from Firestore based on filters
async function fetchTrendsWithFilters(
    filters: { niche?: string; platform?: string; dateRange?: string },
    count: number = 20 // Fetch more for the trends page
): Promise<Trend[]> {
    console.log(`TrendsPage: Fetching trends from Firestore with filters:`, filters);
    const trendsCollection = collection(db, 'trends');
    const queryConstraints = [];

    // Filter by Niche (Category)
    if (filters.niche && filters.niche.toLowerCase() !== 'all') {
        queryConstraints.push(where('category', '==', filters.niche));
    }

    // Filter by Platform
    if (filters.platform && filters.platform.toLowerCase() !== 'all') {
        queryConstraints.push(where('platform', '==', filters.platform));
    }

    // Filter by Date Range (using processedAt)
    let dateFilterApplied = false;
    if (filters.dateRange) {
        const now = new Date();
        let cutoffDate: Date | null = null;
        if (filters.dateRange === 'today') {
            cutoffDate = new Date(now.setHours(0, 0, 0, 0));
        } else if (filters.dateRange === 'last_3_days') {
            cutoffDate = new Date(new Date().setDate(now.getDate() - 3)); // Use new Date() to avoid mutating 'now'
            cutoffDate.setHours(0, 0, 0, 0);
        } else if (filters.dateRange === 'last_7_days') {
             cutoffDate = new Date(new Date().setDate(now.getDate() - 7));
             cutoffDate.setHours(0, 0, 0, 0);
        }
        // Add other ranges like 'last_30_days' if needed

        if (cutoffDate) {
            console.log(`Applying date filter: processedAt >= ${cutoffDate.toISOString()}`);
            queryConstraints.push(where('processedAt', '>=', Timestamp.fromDate(cutoffDate)));
            dateFilterApplied = true;
        } else {
             console.log("No valid cutoff date derived from dateRange:", filters.dateRange);
        }
    }

    // Order by processing time (most recent first)
    // If filtering by date, Firestore might require the first orderBy to match the range filter field
    if (dateFilterApplied) {
        queryConstraints.push(orderBy('processedAt', 'desc'));
    } else if (filters.niche && filters.niche.toLowerCase() !== 'all') {
        // If filtering by category but not date, we might need an index on category+processedAt
        queryConstraints.push(orderBy('processedAt', 'desc'));
    } else if (filters.platform && filters.platform.toLowerCase() !== 'all') {
         // If filtering by platform but not date, we might need an index on platform+processedAt
        queryConstraints.push(orderBy('processedAt', 'desc'));
    }
    else {
        // Default ordering if no other specific filters require it first
        queryConstraints.push(orderBy('processedAt', 'desc'));
    }


    // Limit the results
    queryConstraints.push(limit(count));

    // Log the final query constraints (excluding the collection itself)
    console.log("TrendsPage: Firestore query constraints:", queryConstraints.map(c => c.type + ': ' + JSON.stringify(c._queryOptions || c)));

    const trendsQuery = query(trendsCollection, ...queryConstraints);

    try {
        // Explicitly try to enable network before fetching trends
        await enableNetwork(db);
        console.log("TrendsPage: Network enabled for fetching trends.");
        const querySnapshot = await getDocs(trendsQuery);
        const trends: Trend[] = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            // Basic validation: ensure essential fields exist
            if (!data.title || !data.url || !data.platform || !data.discoveredAt) {
                 console.warn(`TrendsPage: Skipping trend with missing essential data (ID: ${docSnap.id}):`, data);
                 return;
            }
            trends.push({
                id: docSnap.id,
                title: data.title,
                platform: data.platform,
                views: data.views,
                likes: data.likes,
                category: data.category || 'Uncategorized', // Default if missing
                url: data.url,
                description: data.description,
                discoveredAt: (data.discoveredAt as Timestamp)?.toDate() || new Date(0), // Handle potential null/undefined
                processedAt: (data.processedAt as Timestamp)?.toDate(), // Handle potential null/undefined
                categoryConfidence: data.categoryConfidence,
                // saved status added later
            });
        });
        console.log(`TrendsPage: Fetched ${trends.length} trends from Firestore based on filters.`);
        if (trends.length === 0) {
            console.log("TrendsPage: No trends found matching the current filters.");
        }
        return trends;
    } catch (error) {
        console.error(`TrendsPage: Error fetching trends with filters from Firestore:`, error);
         if (error instanceof FirestoreError && error.code === 'failed-precondition') {
             console.error(
                "Firestore query failed: This usually indicates a missing Firestore index. " +
                `Please check the Firestore console (Database > Indexes) for an automatic index creation link, or manually create a composite index matching the query filters: ` +
                `Collection: 'trends', Fields: ${JSON.stringify(filters)}, Order: processedAt DESC. ` +
                "The exact index depends on the filters applied. See Firebase documentation for index requirements."
             );
             throw new Error("Database query error: A required index is missing. Please check Firestore indexes or contact support.");
        } else if (error instanceof FirestoreError && (error.code === 'unavailable' || error.message.includes('offline'))) {
             console.warn("TrendsPage: Firestore query failed for trends: Client appears to be offline.");
             // Attempt to get from cache
            try {
                const querySnapshot = await getDocs(trendsQuery); // Try again, might get from cache
                const trends: Trend[] = [];
                 querySnapshot.forEach((docSnap) => {
                     const data = docSnap.data();
                     if (!data.title || !data.url || !data.platform || !data.discoveredAt) {
                        console.warn(`TrendsPage: Skipping trend (from cache) with missing essential data (ID: ${docSnap.id}):`, data);
                        return;
                     }
                     trends.push({
                        id: docSnap.id, title: data.title, platform: data.platform, views: data.views, likes: data.likes,
                        category: data.category || 'Uncategorized', url: data.url, description: data.description,
                        discoveredAt: (data.discoveredAt as Timestamp)?.toDate() || new Date(0),
                        processedAt: (data.processedAt as Timestamp)?.toDate(), categoryConfidence: data.categoryConfidence,
                    });
                 });
                 console.log(`TrendsPage: Fetched ${trends.length} trends from Firestore cache (offline).`);
                 return trends; // Return cached trends if available
            } catch (cacheError) {
                 console.error("TrendsPage: Error fetching trends from cache:", cacheError);
                 throw new Error("Could not load trends. You appear to be offline.");
            }
        }
        throw error; // Re-throw other errors
    }
}


// Available niches for filtering (should align with settings/signup)
// Fetch user's selected niches instead of a static list
const PLATFORMS = ["all", "TikTok", "Instagram", "YouTube"];
const DATE_RANGES = [
    { value: 'today', label: 'Today' },
    { value: 'last_3_days', label: 'Last 3 Days' },
    { value: 'last_7_days', label: 'Last 7 Days' },
    // { value: 'last_30_days', label: 'Last 30 Days' }, // Add if needed
];

export default function TrendsPage() {
  const { user } = useAuth();
  const [userData, setUserData] = useState<Awaited<ReturnType<typeof fetchUserDataWithDetails>> | null>(null);
  const [displayedTrends, setDisplayedTrends] = useState<Trend[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineError, setIsOfflineError] = useState(false);
  const [isIndexError, setIsIndexError] = useState(false); // State for index-specific error

  // Filters State
  const [selectedNiche, setSelectedNiche] = useState<string>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('last_7_days'); // Default to last 7 days

  // Dynamic niche options based on user's settings
  const nicheOptions = ['all', ...(userData?.selectedNiches || [])].sort((a, b) => a === 'all' ? -1 : b === 'all' ? 1 : a.localeCompare(b));

  useEffect(() => {
    if (user) {
        setLoadingUser(true);
        setError(null); // Clear previous errors
        setIsOfflineError(false);
        setIsIndexError(false);
        fetchUserDataWithDetails(user.uid)
            .then(data => {
                setUserData(data);
                 if (data?.isOffline) { // Check the offline flag added in fetchUserDataWithDetails
                    setIsOfflineError(true);
                    setError("Could not load user information. You appear to be offline."); // Set user-specific offline error
                }
                // Set initial niche filter to user's primary niche or 'all' if available
                setSelectedNiche(data?.primaryNiche && data?.selectedNiches?.includes(data.primaryNiche) ? data.primaryNiche : 'all');
            })
            .catch(err => {
                console.error("TrendsPage: Error fetching user data:", err);
                const errorMessage = err.message || "Could not load user information. Please try logging in again.";
                 setError(errorMessage);
                 if (errorMessage.includes("offline")) {
                    setIsOfflineError(true);
                }
            })
            .finally(() => setLoadingUser(false));
    } else {
        setLoadingUser(false);
        setLoadingTrends(false); // No user, no trends to load
    }
  }, [user]);

  // Effect to fetch/re-fetch trends when filters or user data changes
  useEffect(() => {
    // Don't fetch if user isn't loaded or essential data is missing
    if (!user || loadingUser || !userData) {
        // If user loading finished but userData is null, and it's not an offline error, it indicates another problem
        if (!loadingUser && !userData && !error && !isOfflineError) {
            console.log("TrendsPage: User data not ready (or errored), skipping trend fetch.");
            setLoadingTrends(false);
        } else if (isOfflineError) {
             // If user data fetch resulted in offline error, try fetching trends (might come from cache)
             console.log("TrendsPage: User data indicates offline, attempting trend fetch from cache if possible.");
        }
         else {
            // User loading or other error state
             setLoadingTrends(false); // Ensure loading stops if no fetch is attempted
             return;
         }

    }

    // Ensure user has selected niches if not filtering by 'all' - Skip if offline
     if (!isOfflineError && selectedNiche !== 'all' && (!userData.selectedNiches || userData.selectedNiches.length === 0)) {
         console.log("TrendsPage: No niches selected by user, defaulting to 'all' filter.");
         setSelectedNiche('all'); // Reset filter if needed
         // Optionally show a message to the user to select niches in settings
         return; // Prevent fetch if niche selection is invalid (and online)
    }


    const loadTrends = async () => {
        setLoadingTrends(true);
        // Only clear errors if we are not currently marked as offline
        if (!isOfflineError) {
            setError(null);
            setIsIndexError(false);
        }


        try {
            const currentFilters = {
                niche: selectedNiche,
                platform: selectedPlatform,
                dateRange: selectedDateRange
            };
            const fetchedTrends = await fetchTrendsWithFilters(currentFilters);

             // Apply saved status
             const savedIds = userData?.savedTrendIds || [];
             const trendsWithSaveStatus = fetchedTrends.map(trend => ({
                 ...trend,
                 saved: savedIds.includes(trend.id),
             }));

            setDisplayedTrends(trendsWithSaveStatus);
             // If fetch succeeds, clear offline error state if it was previously set
            setIsOfflineError(false);
             setError(null);

        } catch (err: any) {
             console.error("TrendsPage: Error fetching filtered trends:", err);
             const errorMessage = err.message || "Could not load trends. Please try again later.";
             setError(errorMessage); // Set or update error state

             if (errorMessage.includes("offline")) {
                 setIsOfflineError(true); // Ensure offline state is set/remains true
             } else if (errorMessage.includes("index required") || errorMessage.includes("index is missing")) {
                 setIsIndexError(true);
                 setIsOfflineError(false); // Ensure offline is false if it's an index error
             }
             setDisplayedTrends([]); // Clear trends on error
        } finally {
            setLoadingTrends(false);
        }
    };

    loadTrends();
  }, [user, loadingUser, userData, selectedNiche, selectedPlatform, selectedDateRange, isOfflineError]); // Added isOfflineError dependency


  const handleSaveTrend = async (trendId: string, currentlySaved: boolean) => {
     if (!user || !userData || isOfflineError) { // Prevent saving if offline
        if(isOfflineError) alert("Cannot save trends while offline.");
        return;
     }

     const isPaid = userData.subscription?.plan === 'paid';
     if (!isPaid) {
         alert("Saving trends is a premium feature. Please upgrade your plan.");
         return;
     }
     const newSavedState = !currentlySaved;

     // Optimistic UI update
     setDisplayedTrends(prevTrends =>
         prevTrends.map(t => t.id === trendId ? { ...t, saved: newSavedState } : t)
     );
     setUserData(prevUserData => ({ // Update local user data optimistically
        ...prevUserData!,
        savedTrendIds: newSavedState
            ? [...(prevUserData?.savedTrendIds || []), trendId]
            : (prevUserData?.savedTrendIds || []).filter(id => id !== trendId),
     }));

     // Firestore update
     try {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
            savedTrendIds: newSavedState ? arrayUnion(trendId) : arrayRemove(trendId)
        });
        console.log(`Trend ${trendId} ${newSavedState ? 'saved' : 'unsaved'} successfully.`);
     } catch (error) {
        console.error("Failed to update saved trend in Firestore:", error);
         // Revert optimistic updates
        setDisplayedTrends(prevTrends =>
            prevTrends.map(t => t.id === trendId ? { ...t, saved: currentlySaved } : t)
        );
         setUserData(prevUserData => ({
            ...prevUserData!,
            savedTrendIds: currentlySaved
                ? [...(prevUserData?.savedTrendIds || []), trendId] // Add back if it was originally saved
                : (prevUserData?.savedTrendIds || []).filter(id => id !== trendId), // Remove if it was originally unsaved
         }));
        alert(`Failed to ${newSavedState ? 'save' : 'unsave'} trend. Please try again.`);
     }
  };

  const isLoading = loadingUser || loadingTrends;
  const isPaidUser = userData?.subscription?.plan === 'paid';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Explore Trends</CardTitle>
          <CardDescription>Discover the latest viral content across platforms, filtered for you.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters Section */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 border rounded-lg bg-muted/50">
             {/* Niche Filter */}
             <div className="flex-1 space-y-2">
                <Label htmlFor="niche-filter">Niche</Label>
                <Select
                    value={selectedNiche}
                    onValueChange={(value) => { console.log("Niche filter changed:", value); setSelectedNiche(value); }}
                    disabled={isLoading || isOfflineError || nicheOptions.length <= 1} // Disable if loading, offline, or only 'all' available
                >
                    <SelectTrigger id="niche-filter">
                        <SelectValue placeholder="Filter by niche" />
                    </SelectTrigger>
                    <SelectContent>
                        {nicheOptions.map((niche) => (
                            <SelectItem key={niche} value={niche}>
                                {niche === 'all' ? 'All Your Niches' : niche}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {!isPaidUser && nicheOptions.length > 2 && <p className="text-xs text-muted-foreground pt-1">Upgrade to track more niches.</p>}
                 {userData && userData.selectedNiches?.length === 0 && !isOfflineError && <p className="text-xs text-amber-600 dark:text-amber-400 pt-1">Go to settings to select niches!</p>}
             </div>
             {/* Platform Filter */}
             <div className="flex-1 space-y-2">
                <Label htmlFor="platform-filter">Platform</Label>
                <Select
                    value={selectedPlatform}
                    onValueChange={(value) => { console.log("Platform filter changed:", value); setSelectedPlatform(value); }}
                    disabled={isLoading || isOfflineError}
                >
                    <SelectTrigger id="platform-filter">
                        <SelectValue placeholder="Filter by platform" />
                    </SelectTrigger>
                    <SelectContent>
                        {PLATFORMS.map((platform) => (
                            <SelectItem key={platform} value={platform}>
                                {platform === 'all' ? 'All Platforms' : platform}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
             </div>
             {/* Date Range Filter */}
             <div className="flex-1 space-y-2">
                <Label htmlFor="date-filter">Date Range</Label>
                 <Select
                    value={selectedDateRange}
                    onValueChange={(value) => { console.log("Date range filter changed:", value); setSelectedDateRange(value); }}
                    disabled={isLoading || isOfflineError}
                 >
                    <SelectTrigger id="date-filter">
                        <SelectValue placeholder="Filter by date" />
                    </SelectTrigger>
                    <SelectContent>
                        {DATE_RANGES.map((range) => (
                            <SelectItem key={range.value} value={range.value}>
                                {range.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
             </div>
          </div>

          {/* Trends List or Loading/Error State */}
          {error && ( // Display errors prominently
              <Alert variant={isOfflineError ? "default" : "destructive"} className={isOfflineError ? "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10" : ""}>
                 {isOfflineError ? <WifiOff className="h-4 w-4 text-yellow-600 dark:text-yellow-400" /> : (isIndexError ? <HelpCircle className="h-4 w-4" /> : null)}
                 <AlertTitle>{isOfflineError ? "Offline" : (isIndexError ? "Database Query Error" : "Error")}</AlertTitle>
                 <AlertDescription>
                    {error}
                    {isIndexError && (
                        <span className="block mt-1 text-xs">This often means a required Firestore index is missing for your filter combination. Check the browser console logs for a link to create it, or contact support.</span>
                    )}
                    {isOfflineError && (
                        <span className="block mt-1 text-xs">Displaying cached data where possible. Real-time updates are unavailable. Check your connection.</span>
                    )}
                 </AlertDescription>
              </Alert>
          )}

          {isLoading ? ( // Skeleton Loading State
            <div className="space-y-4 mt-4">
              {[...Array(5)].map((_, i) => (
                 <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                    <Skeleton className="h-12 w-12 rounded-md shrink-0" />
                    <div className="space-y-2 flex-grow">
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-3 w-3/5" />
                        <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                 </div>
              ))}
            </div>
          ) : !error || (isOfflineError && displayedTrends.length > 0) ? ( // Display Trends List (show cached trends if offline)
            displayedTrends.length > 0 ? (
                <ul className="space-y-4 mt-4">
                {displayedTrends.map((trend) => (
                    <li key={trend.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-start gap-4 mb-2 sm:mb-0 flex-grow min-w-0"> {/* Added min-w-0 */}
                        {/* Platform Icon */}
                            <div className="p-2 bg-secondary rounded-md mt-1 shrink-0">
                            {trend.platform === 'TikTok' && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 16 16"><path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3z"/></svg>}
                            {trend.platform === 'Instagram' && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 16 16"><path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 0 0-1.417.923A3.917 3.917 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.85.175 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.916 3.916 0 0 0-.923-1.417A3.916 3.916 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0h.003zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.389-.009-3.232-.047c-.78-.036-1.203-.166-1.485-.276a2.478 2.478 0 0 1-.92-.598 2.48 2.48 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.231 0-2.136.008-2.388.046-3.231.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045v.002zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217zm0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334z"/></svg>}
                            {trend.platform === 'YouTube' && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="currentColor" viewBox="0 0 16 16"><path d="M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 0 1 1.415 1.42c.101.38.172.883.22 1.402l.01.104.022.26.008.104c.065.914.073 1.77.074 1.957v.075c-.001.194-.01 1.102-.074 2.016l-.008.105-.022.259-.01.104c-.048.519-.119 1.023-.22 1.402a2.007 2.007 0 0 1-1.415 1.42c-1.16.312-5.569.334-6.18.335h-.142c-.309 0-1.587-.006-2.927-.052l-.17-.006-.087-.004-.171-.007-.171-.007c-1.11-.049-2.167-.128-2.654-.26a2.007 2.007 0 0 1-1.415-1.419c-.111-.417-.185-.986-.235-1.558L.09 9.82l-.008-.104A31.4 31.4 0 0 1 0 7.68v-.123c.002-.215.01-.958.064-1.778l.007-.103.003-.052.008-.104.022-.26.01-.104c.048-.519.119-1.023.22-1.402a2.007 2.007 0 0 1 1.415-1.42c.487-.13 1.544-.21 2.654-.26l.17-.007.171-.006.087-.004.171-.007.17-.006c1.34-.046 2.617-.052 2.927-.052H8.05zm-1.631 5.53l3.243 1.858-3.243 1.858V7.53z"/></svg>}
                            </div>
                        {/* Trend Details */}
                        <div className="flex-grow min-w-0"> {/* Added min-w-0 */}
                            <a
                                href={trend.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold hover:underline hover:text-accent block truncate" // Added block and truncate
                                title={trend.title} // Add title attribute for full text on hover
                            >
                                {trend.title}
                            </a>
                            <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                                {trend.category && <span className="inline-flex items-center"><Filter className="h-3 w-3 mr-1" /> {trend.category}</span> }
                                {trend.views != null && <span className="whitespace-nowrap"> • {(trend.views / 1000000).toFixed(1)}M views</span>} {/* Added whitespace-nowrap */}
                                {trend.likes != null && <span className="whitespace-nowrap"> • {(trend.likes / 1000).toFixed(1)}K likes</span>} {/* Added whitespace-nowrap */}
                                {trend.processedAt && <span className="inline-flex items-center whitespace-nowrap"><Calendar className="h-3 w-3 mr-1" /> {formatDistanceToNow(trend.processedAt, { addSuffix: true })}</span>} {/* Added whitespace-nowrap */}
                            </p>
                            {trend.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{trend.description}</p>}
                        </div>
                    </div>
                    {/* Save Button */}
                        <Button
                            variant={trend.saved ? "secondary" : "ghost"}
                            size="icon"
                            className={`mt-2 sm:mt-0 sm:ml-4 shrink-0 ${trend.saved ? 'text-accent' : ''}`}
                            onClick={() => handleSaveTrend(trend.id, !!trend.saved)}
                            aria-label={trend.saved ? "Unsave trend" : "Save trend"}
                            disabled={isLoading || isOfflineError || !isPaidUser} // Disable if loading, offline, or not paid
                            title={isOfflineError ? "Cannot save while offline" : (isPaidUser ? (trend.saved ? "Unsave trend" : "Save trend") : "Upgrade to save trends")}
                        >
                            <Star className={`h-5 w-5 ${trend.saved ? 'fill-current' : ''}`} />
                        </Button>
                    </li>
                ))}
                </ul>
            ) : ( // No Trends Found Message (even if offline)
                <p className="text-center text-muted-foreground py-8 mt-4">
                    {isOfflineError ? "Cannot load trends while offline." : "No trends match your current filters. Try broadening your search or check back later!"}
                </p>
            )
          ) : ( // Fallback for when there's an error but not offline with cached data
             !isLoading && error && !isOfflineError && <p className="text-center text-muted-foreground py-8 mt-4">Could not load trends due to an error.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
