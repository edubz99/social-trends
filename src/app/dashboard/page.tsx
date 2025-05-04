
"use client";

import { useEffect, useState } from 'react';
// Updated Firestore imports for v9+ client SDK
import {
    doc, getDoc, updateDoc, arrayUnion, arrayRemove,
    collection, query, where, orderBy, limit, getDocs,
    Timestamp, FirestoreError
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Rocket, Star, Settings, WifiOff, HelpCircle } from 'lucide-react'; // Add WifiOff, HelpCircle
import Link from 'next/link';

// Unified trend data structure used in the UI (Matches Firestore structure)
interface Trend {
    id: string; // Firestore document ID (likely sanitized URL)
    title: string;
    platform: 'TikTok' | 'Instagram' | 'YouTube';
    views?: number;
    likes?: number;
    category?: string; // AI-assigned category
    url: string;
    saved?: boolean; // Derived client-side based on userData
    description?: string;
    discoveredAt: Date; // Converted from Firestore Timestamp
    processedAt?: Date; // Converted from Firestore Timestamp
    categoryConfidence?: number;
}

// Fetch user data from Firestore
async function fetchUserData(uid: string) {
    console.log(`DashboardPage: Fetching user data for UID: ${uid}`);
    const userDocRef = doc(db, "users", uid);
    try {
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            console.log("DashboardPage: User document found:", userDocSnap.data());
            return userDocSnap.data();
        } else {
            console.warn(`DashboardPage: No user document found for UID: ${uid}`);
            return null;
        }
    } catch (error) {
        console.error(`DashboardPage: Error fetching user data for ${uid}:`, error);
        throw error; // Rethrow to be handled by the caller
    }
}

// Fetch trends from Firestore based on niche
async function fetchTrendsFromFirestore(niche: string, count: number = 5): Promise<Trend[]> {
    console.log(`DashboardPage: Fetching top ${count} trends for niche "${niche}" from Firestore...`);
    const trendsCollection = collection(db, 'trends');
    let trendsQuery;
    const queryConstraints = [];

    if (niche && niche.toLowerCase() !== 'all') {
        // Query by category, order by processing time (descending)
        console.log(`Applying filter: category == ${niche}`);
        queryConstraints.push(where('category', '==', niche));
        queryConstraints.push(orderBy('processedAt', 'desc')); // Requires index on category + processedAt
    } else {
        // Fetch latest trends across all niches if 'all' or no niche specified
        console.log("Applying filter: None (fetching latest overall)");
        queryConstraints.push(orderBy('processedAt', 'desc')); // Requires index on processedAt
    }

    queryConstraints.push(limit(count));

    console.log("DashboardPage: Firestore query constraints:", queryConstraints.map(c => c.type + ': ' + JSON.stringify(c._queryOptions || c)));
    trendsQuery = query(trendsCollection, ...queryConstraints);


    try {
        const querySnapshot = await getDocs(trendsQuery);
        const trends: Trend[] = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
             if (!data.title || !data.url || !data.platform || !data.discoveredAt) {
                 console.warn(`DashboardPage: Skipping trend with missing essential data (ID: ${docSnap.id}):`, data);
                 return;
            }
            trends.push({
                id: docSnap.id,
                title: data.title,
                platform: data.platform,
                views: data.views,
                likes: data.likes,
                category: data.category || 'Uncategorized',
                url: data.url,
                description: data.description,
                discoveredAt: (data.discoveredAt as Timestamp)?.toDate() || new Date(0),
                processedAt: (data.processedAt as Timestamp)?.toDate(),
                categoryConfidence: data.categoryConfidence,
                // 'saved' status will be added later based on user data
            });
        });
        console.log(`DashboardPage: Fetched ${trends.length} trends from Firestore for niche "${niche}".`);
        if (trends.length === 0) {
             console.log(`DashboardPage: No trends found for niche "${niche}".`);
        }
        return trends;
    } catch (error) {
        console.error(`DashboardPage: Error fetching trends for niche "${niche}" from Firestore:`, error);
        if (error instanceof FirestoreError && error.code === 'failed-precondition') {
             console.error(
                "Firestore query failed: This usually indicates a missing Firestore index. " +
                `Please check the Firestore console (Database > Indexes) for an automatic index creation link, or manually create a composite index. ` +
                `For niche filtering, you likely need an index on 'category' (Ascending/Descending) and 'processedAt' (Descending). For 'all' niches, ensure an index exists on 'processedAt' (Descending). ` +
                "See Firebase documentation for index requirements."
             );
             throw new Error("Database query error: A required index is missing. Please check Firestore indexes or contact support.");
        } else if (error instanceof FirestoreError && (error.code === 'unavailable' || error.message.includes('offline'))) {
            console.warn("DashboardPage: Firestore query failed: Client appears to be offline.");
            throw new Error("Could not load trends. You appear to be offline.");
        }
        throw error; // Re-throw other errors
    }
}


export default function DashboardPage() {
  const { user } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineError, setIsOfflineError] = useState(false);
  const [isIndexError, setIsIndexError] = useState(false); // Specific state for index errors

  useEffect(() => {
    if (user) {
      console.log("DashboardPage: Auth state changed, user found. Fetching user data...");
      const loadUserData = async () => {
        setLoadingUser(true);
        setError(null); // Clear previous errors
        setIsOfflineError(false);
        setIsIndexError(false);
        try {
          const data = await fetchUserData(user.uid);
          if (data) {
             setUserData(data);
             setError(null); // Clear any previous error state if successful
             console.log("DashboardPage: User data loaded successfully.");
          } else {
             // This case indicates the user is authenticated but their Firestore document is missing.
             console.error("DashboardPage: User document missing or not synced for UID:", user.uid);
             setError("User profile not found or couldn't be loaded. It might not have been created correctly during signup, or there might be a temporary sync issue. Please ensure you are online and try refreshing. If the problem persists, contact support.");
          }
        } catch (err: any) {
          console.error("DashboardPage: Error fetching user data in useEffect:", err);
          const errorMessage = err.message || "Could not load user information due to an unexpected error.";
          setError(errorMessage);
          if (errorMessage.includes("offline")) {
              setIsOfflineError(true);
              console.warn("DashboardPage: Attempting to rely on cached user data due to offline status.");
              // Attempt to fetch from cache - Firestore handles this automatically with persistence enabled.
              // If persistence fails or cache is empty, the error state remains.
          }
        } finally {
          setLoadingUser(false);
          console.log("DashboardPage: Finished loading user data.");
        }
      };
      loadUserData();
    } else if (!loadingUser && !user) {
        // This case means auth check finished and there's no user logged in.
        console.log("DashboardPage: No user logged in.");
        setLoadingUser(false); // Ensure loading is false
        setLoadingTrends(false); // No user, no trends
    }
  }, [user, loadingUser]); // Re-run when user object changes OR when loadingUser becomes false

 useEffect(() => {
    // Load trends after user data is available and not loading
    if (userData && !loadingUser) {
      console.log("DashboardPage: User data available, proceeding to load trends.");
      // Determine the niche to fetch trends for
      let nicheToFetch = 'all'; // Default to 'all'
      if (userData.selectedNiches && userData.selectedNiches.length > 0) {
          nicheToFetch = userData.primaryNiche && userData.selectedNiches.includes(userData.primaryNiche)
              ? userData.primaryNiche
              : userData.selectedNiches[0]; // Use primary if valid, else first selected
          console.log(`DashboardPage: User has selected niches. Fetching for primary/first: "${nicheToFetch}"`);
      } else {
          console.log("DashboardPage: User has no selected niches. Fetching for 'all'.");
          // Optional: Set an error/warning if niches are expected but missing
          // setError("Please select at least one niche in your settings to see relevant trends.");
      }

      const loadTrends = async () => {
            setLoadingTrends(true);
            setError(null); // Clear previous trend-specific errors
            setIsOfflineError(false);
            setIsIndexError(false);
            try {
              const nicheTrends = await fetchTrendsFromFirestore(nicheToFetch, 5); // Fetch top 5

              // Apply saved status
              const savedIds = userData?.savedTrendIds || [];
              const trendsWithSaveStatus = nicheTrends.map(trend => ({
                 ...trend,
                 saved: savedIds.includes(trend.id),
              }));

              setTrends(trendsWithSaveStatus);
              console.log("DashboardPage: Trends loaded and processed successfully.");
              // Clear general error if trends load successfully, but keep offline notice if present
              // if (!isOfflineError) setError(null); // This might clear user data load errors, be cautious

            } catch (err: any) {
              console.error("DashboardPage: Error fetching or processing trends:", err);
              const errorMessage = err.message || "Could not load trends. Please try again later.";
              setError(errorMessage);
              if (errorMessage.includes("offline")) {
                  setIsOfflineError(true);
              } else if (errorMessage.includes("index required") || errorMessage.includes("index is missing")) {
                  setIsIndexError(true);
              }
               setTrends([]); // Clear trends on error
            } finally {
              setLoadingTrends(false);
               console.log("DashboardPage: Finished loading trends.");
            }
      };
      loadTrends();

    } else if (!loadingUser && !userData && user && !isOfflineError) {
        // This case means user is logged in, but their data failed to load (error set previously)
        console.log("DashboardPage: User data failed to load, skipping trend fetch.");
        setLoadingTrends(false);
    } else if (!user) {
        // No user logged in, should not attempt to load trends
        console.log("DashboardPage: No user, skipping trend fetch.");
        setLoadingTrends(false);
    }
 }, [userData, loadingUser, user]); // Rerun when userData or loadingUser changes


 const handleSaveTrend = async (trendId: string) => {
    if (!user || !userData) return;

    const isPaid = userData.subscription?.plan === 'paid';
    if (!isPaid) {
        alert("Saving trends is a premium feature. Please upgrade your plan.");
        return;
    }

    const currentlySaved = (userData.savedTrendIds || []).includes(trendId);
    const newSavedState = !currentlySaved;

    // Optimistic UI update
    setTrends(prevTrends =>
        prevTrends.map(t => (t.id === trendId ? { ...t, saved: newSavedState } : t))
    );
    // Also update userData state optimistically for consistency
    setUserData((prev: any) => ({
        ...prev,
        savedTrendIds: newSavedState
            ? [...(prev?.savedTrendIds || []), trendId]
            : (prev?.savedTrendIds || []).filter((id: string) => id !== trendId),
    }));


    // Firestore update
    try {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
            savedTrendIds: newSavedState ? arrayUnion(trendId) : arrayRemove(trendId)
        });
         console.log(`Trend ${trendId} ${newSavedState ? 'saved' : 'unsaved'} successfully.`);
    } catch (firestoreError) {
        console.error("Failed to update saved trend in Firestore:", firestoreError);
        // Revert optimistic UI update on error
         setTrends(prevTrends =>
            prevTrends.map(t => (t.id === trendId ? { ...t, saved: currentlySaved } : t)) // Revert to original saved state
        );
         setUserData((prev: any) => ({
             ...prev,
             savedTrendIds: currentlySaved
                 ? [...(prev?.savedTrendIds || []), trendId] // Add back if removal failed
                 : (prev?.savedTrendIds || []).filter((id: string) => id !== trendId), // Remove if addition failed
         }));
        alert(`Failed to ${newSavedState ? 'save' : 'unsave'} trend. Please try again.`);
    }
  };

  const isPaidUser = userData?.subscription?.plan === 'paid';

   if (loadingUser) {
     return ( // --- Skeleton Loading State ---
        <div className="space-y-6">
            {/* Welcome Card Skeleton */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64 mt-1" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-5 w-48 mb-4" />
                     {/* Upgrade Alert Skeleton */}
                    <Skeleton className="h-16 w-full" />
                </CardContent>
            </Card>
            {/* Trends Card Skeleton */}
             <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <Skeleton className="h-6 w-40" />
                         <Skeleton className="h-4 w-56 mt-1" />
                    </div>
                    <Skeleton className="h-9 w-28" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                                <Skeleton className="h-10 w-10 rounded-md shrink-0" />
                                <div className="space-y-2 flex-grow">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
     );
   }

    // Display error if exists (including offline error or index error)
    if (error && !loadingTrends) { // Show error predominantly if exists after loading attempts
        return ( // --- Error State ---
             <div className="space-y-6">
                 <Alert variant={isOfflineError ? "default" : "destructive"} className={isOfflineError ? "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10" : ""}>
                      {isOfflineError ? <WifiOff className="h-4 w-4 text-yellow-600 dark:text-yellow-400" /> : (isIndexError ? <HelpCircle className="h-4 w-4"/> : null)}
                     <AlertTitle>{isOfflineError ? "Offline Notice" : (isIndexError ? "Database Query Error" : "Error Loading Dashboard")}</AlertTitle>
                     <AlertDescription>
                         {error}
                         {error.includes("User profile not found") && !isOfflineError && (
                            <div className="mt-4">
                                <p className="text-xs">If you just signed up, please wait a moment and refresh. Otherwise, contact support.</p>
                                <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-2">Refresh Page</Button>
                            </div>
                         )}
                         {isIndexError && (
                           <span className="block mt-1 text-xs">This often means a required Firestore index is missing. Check the browser console logs for details or a link to create it, or contact support.</span>
                         )}
                     </AlertDescription>
                 </Alert>
                  {userData && isOfflineError && ( // Render basic structure if offline but have cached user data
                     <div className="opacity-70 pointer-events-none">
                         <Card>
                            <CardHeader>
                                <CardTitle>Welcome, {userData.displayName || 'User'}! (Offline Mode)</CardTitle>
                                <CardDescription>
                                    Displaying cached data. Trend information may be outdated.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p>Selected niche(s): <span className="font-semibold">{userData.selectedNiches?.join(', ') || 'N/A'}</span></p>
                            </CardContent>
                        </Card>
                     </div>
                  )}
            </div>
        );
    }

     // Ensure userData is available before rendering main content (unless it's just an offline error with cached data)
     // Check specifically for the user data loading case vs. trend loading case
     if (!userData && !loadingUser && user && !isOfflineError) {
        console.warn("DashboardPage: Reached render stage without userData, potentially due to a loading error shown above.");
         return (
             <div className="flex items-center justify-center h-64">
                {/* Error message is already displayed above */}
                 <p className="text-muted-foreground">User data could not be loaded.</p>
            </div>
         );
     }


  // --- Main Dashboard Content ---
  // Only render if userData is available OR if it's an offline error (where cached data might be used implicitly)
  if (userData || isOfflineError) {
      return (
        <div className="space-y-6">
          {/* Welcome Card */}
          <Card>
            <CardHeader>
              <CardTitle>Welcome, {userData?.displayName || 'User'}!</CardTitle>
              <CardDescription>
                Here's a quick look at your dashboard and the latest trends for your niche{userData?.selectedNiches?.length > 1 ? 's' : ''}.
                 {isOfflineError && <span className="text-yellow-600 dark:text-yellow-400 font-semibold"> (Offline - Data may be outdated)</span>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userData?.selectedNiches && userData.selectedNiches.length > 0 ? (
                <p>Your selected niche{userData.selectedNiches.length > 1 ? 's' : ''}: <span className="font-semibold">{userData.selectedNiches.join(', ')}</span></p>
              ) : (
                 <p className="text-muted-foreground">No niche selected. <Link href="/dashboard/settings" className="text-accent hover:underline">Go to settings to add one.</Link></p>
              )}
               {!isPaidUser && !isOfflineError && ( // Upgrade prompt
                  <Alert className="mt-4 bg-accent/10 border-accent/30 text-accent-foreground">
                     <Rocket className="h-4 w-4 !text-accent" />
                     <AlertTitle className="text-accent">Go Premium!</AlertTitle>
                     <AlertDescription className="text-muted-foreground">
                       Unlock multiple niches, real-time alerts, saved trends, and Slack integration.
                       <Link href="/dashboard/billing" className="ml-2 font-semibold underline">Upgrade Now</Link>
                     </AlertDescription>
                   </Alert>
               )}
            </CardContent>
          </Card>

          {/* Trends Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Latest Trend Alerts</CardTitle>
                <CardDescription>Top trends based on your primary niche.</CardDescription>
              </div>
               <Link href="/dashboard/trends">
                 <Button variant="outline" size="sm" disabled={isOfflineError}>View All Trends</Button>
               </Link>
            </CardHeader>
            <CardContent>
              {loadingTrends ? ( // Trends Loading Skeleton
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                        <Skeleton className="h-10 w-10 rounded-md shrink-0" />
                        <div className="space-y-2 flex-grow">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    </div>
                  ))}
                </div>
              ) : trends.length > 0 ? ( // Display Trends List
                <ul className="space-y-4">
                  {trends.map((trend) => (
                    <li key={trend.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                       <div className="flex items-start gap-4 mb-2 sm:mb-0 flex-grow min-w-0"> {/* Added min-w-0 */}
                            {/* Platform Icon */}
                            <div className="p-2 bg-secondary rounded-md mt-1 shrink-0">
                               {trend.platform === 'TikTok' && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 16 16"><path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3z"/></svg>}
                               {trend.platform === 'Instagram' && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 16 16"><path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 0 0-1.417.923A3.917 3.917 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.85.175 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.916 3.916 0 0 0-.923-1.417A3.916 3.916 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0h.003zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.389-.009-3.232-.047c-.78-.036-1.203-.166-1.485-.276a2.478 2.478 0 0 1-.92-.598 2.48 2.48 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.231 0-2.136.008-2.388.046-3.231.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045v.002zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217zm0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334z"/></svg>}
                               {trend.platform === 'YouTube' && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="currentColor" viewBox="0 0 16 16"><path d="M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 0 1 1.415 1.42c.101.38.172.883.22 1.402l.01.104.022.26.008.104c.065.914.073 1.77.074 1.957v.075c-.001.194-.01 1.102-.074 2.016l-.008.105-.022.259-.01.104c-.048.519-.119 1.023-.22 1.402a2.007 2.007 0 0 1-1.415 1.42c-1.16.312-5.569.334-6.18.335h-.142c-.309 0-1.587-.006-2.927-.052l-.17-.006-.087-.004-.171-.007-.171-.007c-1.11-.049-2.167-.128-2.654-.26a2.007 2.007 0 0 1-1.415-1.419c-.111-.417-.185-.986-.235-1.558L.09 9.82l-.008-.104A31.4 31.4 0 0 1 0 7.68v-.123c.002-.215.01-.958.064-1.778l.007-.103.003-.052.008-.104.022-.26.01-.104c.048-.519.119-1.023.22-1.402a2.007 2.007 0 0 1 1.415-1.42c.487-.13 1.544-.21 2.654-.26l.17-.007.171-.006.087-.004.171-.007.17-.006c1.34-.046 2.617-.052 2.927-.052H8.05zm-1.631 5.53l3.243 1.858-3.243 1.858V7.53z"/></svg>}
                            </div>
                           <div className="flex-grow min-w-0"> {/* Added min-w-0 */}
                              <a
                                href={trend.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold hover:underline hover:text-accent block truncate" // Added block and truncate
                                title={trend.title} // Add title for full text on hover
                              >
                                {trend.title}
                              </a>
                               <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                                    <span>{trend.platform}</span>
                                    {trend.category && <span className="hidden sm:inline">• {trend.category}</span>} {/* Hide category on smallest screens */}
                                    {trend.views != null && <span className="whitespace-nowrap"> • {(trend.views / 1000000).toFixed(1)}M views</span>} {/* Added whitespace-nowrap */}
                                    {trend.likes != null && <span className="whitespace-nowrap"> • {(trend.likes / 1000).toFixed(1)}K likes</span>} {/* Added whitespace-nowrap */}
                                </p>
                                {trend.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{trend.description}</p>}
                           </div>
                       </div>
                      {/* Save Button */}
                      <Button
                          variant={trend.saved ? "secondary" : "ghost"}
                          size="icon"
                          className={`mt-2 sm:mt-0 sm:ml-4 shrink-0 ${trend.saved ? 'text-accent' : ''}`}
                          onClick={() => handleSaveTrend(trend.id)}
                          aria-label={trend.saved ? "Unsave trend" : "Save trend"}
                          disabled={isOfflineError || !isPaidUser} // Disable if offline or not paid
                          title={isPaidUser ? (trend.saved ? "Unsave trend" : "Save trend") : "Upgrade to save trends"}
                        >
                          <Star className={`h-5 w-5 ${trend.saved ? 'fill-current' : ''}`} />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : ( // No Trends Found
                <p className="text-center text-muted-foreground py-8">
                    {isOfflineError
                        ? "Cannot load trends while offline."
                        : (loadingTrends ? "Loading trends..." : "No trends found for your niche today. Check back later or adjust settings!")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      );
  } else {
      // Render loading or empty state if userData isn't ready and not offline
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Loading dashboard...</p>
            </div>
        );
  }
}
