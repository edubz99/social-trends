
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
import { Rocket, Star, Settings, WifiOff } from 'lucide-react'; // Add WifiOff icon
import Link from 'next/link';
// Remove mock service imports as we fetch from Firestore now
// import { getTikTokTrends, type TikTokTrend } from '@/services/tiktok';
// import { getInstagramReelTrends, type InstagramReelTrend } from '@/services/instagram';
// import { getYoutubeTrends, type YoutubeTrend } from '@/services/youtube';

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
    const userDocRef = doc(db, "users", uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
        console.log("User document found:", userDocSnap.data());
        return userDocSnap.data();
    } else {
        console.warn(`No user document found for UID: ${uid}`);
        return null;
    }
}

// Fetch trends from Firestore based on niche
async function fetchTrendsFromFirestore(niche: string, count: number = 5): Promise<Trend[]> {
    console.log(`Fetching top ${count} trends for niche "${niche}" from Firestore...`);
    const trendsCollection = collection(db, 'trends');
    let trendsQuery;

    if (niche && niche.toLowerCase() !== 'all') {
        // Query by category, order by discovery/processing time (descending)
        trendsQuery = query(
            trendsCollection,
            where('category', '==', niche),
            orderBy('processedAt', 'desc'), // Order by when they were processed
            limit(count)
        );
    } else {
        // Fetch latest trends across all niches if 'all' or no niche specified
        trendsQuery = query(
            trendsCollection,
            orderBy('processedAt', 'desc'),
            limit(count)
        );
    }

    try {
        const querySnapshot = await getDocs(trendsQuery);
        const trends: Trend[] = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            trends.push({
                id: docSnap.id,
                title: data.title,
                platform: data.platform,
                views: data.views,
                likes: data.likes,
                category: data.category,
                url: data.url,
                description: data.description,
                // Convert Firestore Timestamps to JS Dates
                discoveredAt: (data.discoveredAt as Timestamp)?.toDate() || new Date(0), // Default if missing
                processedAt: (data.processedAt as Timestamp)?.toDate(),
                categoryConfidence: data.categoryConfidence,
                // 'saved' status will be added later based on user data
            });
        });
        console.log(`Fetched ${trends.length} trends from Firestore for niche "${niche}".`);
        return trends;
    } catch (error) {
        console.error(`Error fetching trends for niche "${niche}" from Firestore:`, error);
        if (error instanceof FirestoreError && error.code === 'failed-precondition') {
             console.error(
                "Firestore query failed: This often indicates a missing index. " +
                `Check your Firestore console's 'Indexes' tab. You likely need a composite index on 'category' (Ascending/Descending) and 'processedAt' (Descending). ` +
                "The error message might contain a direct link to create the index."
             );
             // Rethrow or handle appropriately, maybe show a specific error to the user
             throw new Error("Database query error: Index required. Please check logs or contact support.");
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

  useEffect(() => {
    if (user) {
      const loadUserData = async () => {
        setLoadingUser(true);
        setError(null); // Clear previous errors
        setIsOfflineError(false);
        try {
          const data = await fetchUserData(user.uid);
          if (data) {
             setUserData(data);
             setError(null); // Clear any previous error state if successful
          } else {
             console.error("DashboardPage: User document missing or not synced for UID:", user.uid);
             setError("User profile not found or couldn't be loaded. It might not have been created correctly during signup, or you might be offline. Please ensure you are online and try logging out and signing up again if the issue persists, or contact support.");
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
          if (err instanceof FirestoreError && (err.code === 'unavailable' || err.code === 'cancelled' || err.message.includes('offline'))) {
              setError("Could not load user information. You appear to be offline. Some data may be cached.");
              setIsOfflineError(true);
              console.warn("Attempting to rely on cached user data due to offline status.");
              try {
                 const userDocRef = doc(db, "users", user.uid);
                 const cachedSnap = await getDoc(userDocRef);
                 if (cachedSnap.exists()) {
                     setUserData(cachedSnap.data());
                 } else {
                     setError("Could not load user information and no cached data found. Please check your internet connection.");
                 }
              } catch (cacheError) {
                  console.error("Error attempting to fetch user data from cache:", cacheError);
                   setError("An error occurred while trying to load user data, possibly due to being offline.");
              }

          } else {
             setError("Could not load user information due to an unexpected error. Please try again later.");
          }
        } finally {
          setLoadingUser(false);
        }
      };
      loadUserData();
    } else {
        setLoadingUser(false);
        setLoadingTrends(false);
    }
  }, [user]);

 useEffect(() => {
    // Load trends after user data is available and niches are known
    if (userData && !loadingUser) {
      if (userData.selectedNiches && userData.selectedNiches.length > 0) {
          const loadTrends = async () => {
            setLoadingTrends(true);
            try {
              // Fetch trends for the user's primary niche
              const primaryNiche = userData.primaryNiche || userData.selectedNiches[0];
              const nicheTrends = await fetchTrendsFromFirestore(primaryNiche, 5); // Fetch top 5

              // Apply saved status
              const savedIds = userData?.savedTrendIds || [];
              const trendsWithSaveStatus = nicheTrends.map(trend => ({
                 ...trend,
                 saved: savedIds.includes(trend.id),
              }));

              setTrends(trendsWithSaveStatus);
              // Clear general error if trends load successfully, but keep offline notice if present
              if (!isOfflineError) setError(null);

            } catch (err: any) {
              console.error("Error fetching or processing trends:", err);
               // Don't overwrite a more specific offline error
              if (!isOfflineError) {
                  setError(err.message || "Could not load trends. Please try again later.");
              }
            } finally {
              setLoadingTrends(false);
            }
          };
          loadTrends();
      } else {
          setLoadingTrends(false);
           if (!isOfflineError) setError("Please select at least one niche in your settings to see relevant trends.");
      }
    } else if (!loadingUser && !userData && user && !isOfflineError) {
        setLoadingTrends(false);
    } else if (!user) {
        setLoadingTrends(false);
    }
 }, [userData, loadingUser, user, isOfflineError]);


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
                                <Skeleton className="h-10 w-10 rounded-md" />
                                <div className="space-y-2 flex-grow">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                                <Skeleton className="h-8 w-8 rounded-full" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
     );
   }

    // Display error if exists (including offline error)
    if (error && !loadingTrends) { // Show error predominantly if exists
        return ( // --- Error State ---
             <div className="space-y-6">
                 <Alert variant={isOfflineError ? "default" : "destructive"} className={isOfflineError ? "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10" : ""}>
                      {isOfflineError ? <WifiOff className="h-4 w-4 text-yellow-600 dark:text-yellow-400" /> : null}
                     <AlertTitle>{isOfflineError ? "Offline Notice" : "Error Loading Dashboard"}</AlertTitle>
                     <AlertDescription>
                         {error}
                         {error.includes("User profile not found") && !isOfflineError && (
                            <div className="mt-4">
                                <Link href="/auth/signup">
                                    <Button variant="outline" size="sm">Go to Signup</Button>
                                </Link>
                            </div>
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
     if (!userData && !isOfflineError) {
        console.warn("DashboardPage: Reached render stage without userData or specific error.");
         return (
             <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Loading user data or user not found...</p>
            </div>
         );
     }

  // --- Main Dashboard Content ---
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
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="space-y-2 flex-grow">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              ))}
            </div>
          ) : trends.length > 0 ? ( // Display Trends List
            <ul className="space-y-4">
              {trends.map((trend) => (
                <li key={trend.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                   <div className="flex items-start gap-4 mb-2 sm:mb-0 flex-grow">
                        {/* Platform Icon */}
                        <div className="p-2 bg-secondary rounded-md mt-1 shrink-0">
                           {trend.platform === 'TikTok' && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 16 16"><path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3z"/></svg>}
                           {trend.platform === 'Instagram' && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 16 16"><path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 0 0-1.417.923A3.917 3.917 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.85.175 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.916 3.916 0 0 0-.923-1.417A3.916 3.916 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0h.003zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.389-.009-3.232-.047c-.78-.036-1.203-.166-1.485-.276a2.478 2.478 0 0 1-.92-.598 2.48 2.48 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.231 0-2.136.008-2.388.046-3.231.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045v.002zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217zm0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334z"/></svg>}
                           {trend.platform === 'YouTube' && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="currentColor" viewBox="0 0 16 16"><path d="M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 0 1 1.415 1.42c.101.38.172.883.22 1.402l.01.104.022.26.008.104c.065.914.073 1.77.074 1.957v.075c-.001.194-.01 1.102-.074 2.016l-.008.105-.022.259-.01.104c-.048.519-.119 1.023-.22 1.402a2.007 2.007 0 0 1-1.415 1.42c-1.16.312-5.569.334-6.18.335h-.142c-.309 0-1.587-.006-2.927-.052l-.17-.006-.087-.004-.171-.007-.171-.007c-1.11-.049-2.167-.128-2.654-.26a2.007 2.007 0 0 1-1.415-1.419c-.111-.417-.185-.986-.235-1.558L.09 9.82l-.008-.104A31.4 31.4 0 0 1 0 7.68v-.123c.002-.215.01-.958.064-1.778l.007-.103.003-.052.008-.104.022-.26.01-.104c.048-.519.119-1.023.22-1.402a2.007 2.007 0 0 1 1.415-1.42c.487-.13 1.544-.21 2.654-.26l.17-.007.171-.006.087-.004.171-.007.17-.006c1.34-.046 2.617-.052 2.927-.052H8.05zm-1.631 5.53l3.243 1.858-3.243 1.858V7.53z"/></svg>}
                        </div>
                       <div className="flex-grow">
                          <a href={trend.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline hover:text-accent">
                            {trend.title}
                          </a>
                           <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                                <span>{trend.platform}</span>
                                {trend.category && <span className="hidden sm:inline">• {trend.category}</span>} {/* Hide category on smallest screens */}
                                {trend.views != null && <span>• {(trend.views / 1000000).toFixed(1)}M views</span>}
                                {trend.likes != null && <span>• {(trend.likes / 1000).toFixed(1)}K likes</span>}
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
}
