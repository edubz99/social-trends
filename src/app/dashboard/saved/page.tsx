"use client";

import { useEffect, useState } from 'react';
// Updated Firestore imports for v9+ client SDK
import {
    doc, getDoc, updateDoc, arrayRemove,
    collection, query, where, getDocs, documentId,
    Timestamp, FirestoreError, enableNetwork // Import enableNetwork
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Star, Trash2, Filter, Calendar, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

// Unified trend data structure (Matches Firestore structure)
interface Trend {
    id: string; // Firestore document ID
    title: string;
    platform: 'TikTok' | 'Instagram' | 'YouTube';
    views?: number;
    likes?: number;
    category?: string;
    url: string;
    saved?: boolean; // Always true for this page context
    description?: string;
    discoveredAt: Date; // Converted from Firestore Timestamp
    processedAt?: Date; // Converted from Firestore Timestamp
    categoryConfidence?: number;
}

// Fetch user data including saved trend IDs
async function fetchUserDataWithSaved(uid: string) {
    console.log("SavedTrendsPage: Fetching user data...");
    const userDocRef = doc(db, "users", uid);
    try {
        // Explicitly try to enable network before fetching user data
        await enableNetwork(db);
         console.log("SavedTrendsPage: Network enabled for fetching user data.");
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            return {
                uid: data.uid,
                savedTrendIds: data.savedTrendIds || [],
                subscription: data.subscription || { plan: 'free', status: 'active' },
                 isOffline: false // Explicitly online
            };
        } else {
             console.warn(`SavedTrendsPage: No user document found for UID: ${uid}`);
            return null;
        }
    } catch (error) {
         console.error("SavedTrendsPage: Error fetching user data:", error);
         if (error instanceof FirestoreError && (error.code === 'unavailable' || error.message.includes('offline'))) {
             console.warn("SavedTrendsPage: Firestore appears to be offline trying to fetch user data.");
              // Attempt to get from cache
             try {
                 const userDocSnap = await getDoc(userDocRef); // Try again, might get from cache
                  if (userDocSnap.exists()) {
                     const data = userDocSnap.data();
                     console.log("SavedTrendsPage: User document found in cache (offline).");
                     return {
                        uid: data.uid,
                        savedTrendIds: data.savedTrendIds || [],
                        subscription: data.subscription || { plan: 'free', status: 'active' },
                        isOffline: true // Mark as offline
                    };
                 } else {
                      console.error("SavedTrendsPage: User document not found, even in cache (offline).");
                      throw new Error("Could not load user data. You appear to be offline and no cached data is available.");
                  }
             } catch (cacheError) {
                  console.error("SavedTrendsPage: Error fetching user data from cache:", cacheError);
                  throw new Error("Could not load user data. You appear to be offline.");
             }
         }
         throw error; // Rethrow other errors
    }
}

// Fetch trend details from Firestore based on a list of IDs
async function fetchTrendsByIdsFromFirestore(ids: string[]): Promise<Trend[]> {
    console.log(`SavedTrendsPage: Fetching ${ids.length} trends by IDs from Firestore...`);
    if (ids.length === 0) return [];

    const trendsCollection = collection(db, 'trends');
    const trends: Trend[] = [];
    const MAX_IDS_PER_QUERY = 30; // Firestore 'in' query limit

    // Process IDs in batches to respect Firestore limits
    for (let i = 0; i < ids.length; i += MAX_IDS_PER_QUERY) {
        const batchIds = ids.slice(i, i + MAX_IDS_PER_QUERY);
        if (batchIds.length === 0) continue;

        const trendsQuery = query(trendsCollection, where(documentId(), 'in', batchIds));

        try {
             // Explicitly try to enable network before fetching trends
            await enableNetwork(db);
             console.log("SavedTrendsPage: Network enabled for fetching trend batch.");
            const querySnapshot = await getDocs(trendsQuery);
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
                    discoveredAt: (data.discoveredAt as Timestamp)?.toDate() || new Date(0),
                    processedAt: (data.processedAt as Timestamp)?.toDate(),
                    categoryConfidence: data.categoryConfidence,
                    saved: true, // Mark as saved in this context
                });
            });
        } catch (error) {
            console.error(`SavedTrendsPage: Error fetching batch of trends (${batchIds.join(', ')}):`, error);
            if (error instanceof FirestoreError && error.code === 'failed-precondition') {
                 console.error("SavedTrendsPage: Firestore query failed: Missing index. Check Firestore console 'Indexes' tab.");
                 throw new Error("Database query error: Index required. Please check logs or contact support.");
            } else if (error instanceof FirestoreError && (error.code === 'unavailable' || error.message.includes('offline'))) {
                console.warn("SavedTrendsPage: Firestore query failed for trends batch: Client appears to be offline.");
                // Attempt to get from cache
                try {
                    const querySnapshot = await getDocs(trendsQuery); // Try again, might get from cache
                    querySnapshot.forEach((docSnap) => {
                        const data = docSnap.data();
                         trends.push({
                             id: docSnap.id, title: data.title, platform: data.platform, views: data.views, likes: data.likes,
                             category: data.category, url: data.url, description: data.description,
                             discoveredAt: (data.discoveredAt as Timestamp)?.toDate() || new Date(0),
                             processedAt: (data.processedAt as Timestamp)?.toDate(), categoryConfidence: data.categoryConfidence,
                             saved: true,
                         });
                    });
                     console.log(`SavedTrendsPage: Successfully fetched ${querySnapshot.size} trends for this batch from cache (offline).`);
                    // Continue to next batch if any
                } catch (cacheError) {
                     console.error("SavedTrendsPage: Error fetching trends batch from cache:", cacheError);
                     throw new Error("Could not load saved trends. You appear to be offline.");
                }
            }
             else {
                throw error; // Re-throw other errors
            }
        }
    }
     console.log(`SavedTrendsPage: Finished fetching details for ${trends.length} trends.`);
    return trends;
}


export default function SavedTrendsPage() {
  const { user } = useAuth();
  const [userData, setUserData] = useState<Awaited<ReturnType<typeof fetchUserDataWithSaved>> | null>(null);
  const [savedTrends, setSavedTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineError, setIsOfflineError] = useState(false);

  useEffect(() => {
    if (user) {
      const loadSavedTrends = async () => {
        setLoading(true);
        setError(null);
        setIsOfflineError(false);
        try {
          const fetchedUserData = await fetchUserDataWithSaved(user.uid);
          setUserData(fetchedUserData);

           if (fetchedUserData?.isOffline) {
                setIsOfflineError(true);
                setError("Could not load fresh data. You appear to be offline."); // Set initial error state
            }


          if (!fetchedUserData) {
              setError("User profile not found.");
              setLoading(false);
              return;
          }

          if (fetchedUserData.subscription?.plan !== 'paid') {
             setError("Access denied. Saving trends is a premium feature.");
             setLoading(false);
             return;
          }

          const savedIds = fetchedUserData.savedTrendIds || [];
          if (savedIds.length > 0) {
             const fetchedTrends = await fetchTrendsByIdsFromFirestore(savedIds);
              // Sort by processed date, newest first (optional, depends on desired order)
             fetchedTrends.sort((a, b) => (b.processedAt?.getTime() || 0) - (a.processedAt?.getTime() || 0));
             setSavedTrends(fetchedTrends);
               // If trend fetch succeeds after user fetch was offline, clear offline error
              if (isOfflineError) {
                  setIsOfflineError(false);
                  setError(null);
              }
          } else {
             setSavedTrends([]); // No trends saved
              // Also clear offline error if no trends needed fetching
              if (isOfflineError) {
                  setIsOfflineError(false);
                  setError(null);
              }
          }

        } catch (err: any) {
          console.error("SavedTrendsPage: Error loading saved trends:", err);
           const errorMessage = err.message || "Could not load saved trends. Please try again later.";
           setError(errorMessage);
           if (errorMessage.includes("offline")) {
                setIsOfflineError(true); // Ensure offline state is set
            }
        } finally {
          setLoading(false);
        }
      };
      loadSavedTrends();
    } else {
        setLoading(false);
        setError("Please log in to view your saved trends.");
    }
  }, [user]); // Removed isOfflineError from dependency array here to prevent re-fetch loop on error

  const handleUnsaveTrend = async (trendId: string) => {
     if (!user || !userData || isOfflineError) { // Prevent unsaving if offline
         if(isOfflineError) alert("Cannot unsave trends while offline.");
         return;
     }

     // Optimistic UI update
     const originalTrends = [...savedTrends];
     setSavedTrends(prevTrends => prevTrends.filter(t => t.id !== trendId));
     // Update local user data state
     setUserData(prevUserData => ({
        ...prevUserData!,
        savedTrendIds: (prevUserData?.savedTrendIds || []).filter(id => id !== trendId),
         isOffline: prevUserData?.isOffline || false // Preserve offline status
    }));


     try {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
            savedTrendIds: arrayRemove(trendId)
        });
        console.log(`SavedTrendsPage: Trend ${trendId} unsaved successfully in Firestore.`);
     } catch (error) {
        console.error("SavedTrendsPage: Failed to unsave trend in Firestore:", error);
         // Revert optimistic updates
        setSavedTrends(originalTrends);
        setUserData(prevUserData => ({
            ...prevUserData!,
            savedTrendIds: [...(prevUserData?.savedTrendIds || []), trendId], // Add back
            isOffline: prevUserData?.isOffline || false // Preserve offline status
        }));
        alert(`Failed to unsave trend. Please try again.`);
     }
  };

   const isPaidUser = userData?.subscription?.plan === 'paid';

  // Render based on state
  if (loading) { // --- Skeleton Loading ---
    return (
       <div className="space-y-6">
         <Card>
           <CardHeader>
             <Skeleton className="h-6 w-1/3" />
             <Skeleton className="h-4 w-2/3 mt-1" />
           </CardHeader>
           <CardContent className="space-y-4">
             {[...Array(3)].map((_, i) => (
               <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                 <Skeleton className="h-12 w-12 rounded-md" />
                 <div className="space-y-2 flex-grow">
                   <Skeleton className="h-4 w-4/5" />
                   <Skeleton className="h-3 w-3/5" />
                 </div>
                 <Skeleton className="h-8 w-8 rounded-full" />
               </div>
             ))}
           </CardContent>
         </Card>
       </div>
    );
  }

  // --- Error / Access Denied States ---
  if (!isPaidUser && user) { // Show upgrade prompt if user loaded but not paid
     return (
        <Alert variant="destructive" className="mt-4">
            <Star className="h-4 w-4" />
            <AlertTitle>Premium Feature</AlertTitle>
            <AlertDescription>
                Saving and managing trends requires a Premium plan. <Link href="/dashboard/billing" className="font-semibold underline">Upgrade your plan</Link>.
            </AlertDescription>
        </Alert>
     );
  }

  if (error) { // Show general or offline error
      return (
           <Alert variant={isOfflineError ? "default" : "destructive"} className={isOfflineError ? "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10" : ""}>
              {isOfflineError && <WifiOff className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />}
              <AlertTitle>{isOfflineError ? "Offline" : "Error"}</AlertTitle>
              <AlertDescription>
                {error}
                {isOfflineError && (
                   <span className="block mt-1 text-xs">Displaying cached data where possible. Real-time updates are unavailable. Check your connection.</span>
                 )}
              </AlertDescription>
           </Alert>
      );
  }

  // --- Main Content: Display Saved Trends ---
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your Saved Trends</CardTitle>
          <CardDescription>Revisit the trends you've marked for inspiration.</CardDescription>
        </CardHeader>
        <CardContent>
          {savedTrends.length > 0 ? (
            <ul className="space-y-4">
              {savedTrends.map((trend) => (
                <li key={trend.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  {/* Trend Info */}
                  <div className="flex items-start gap-4 mb-2 sm:mb-0 flex-grow">
                     {/* Icon */}
                      <div className="p-2 bg-secondary rounded-md mt-1 shrink-0">
                           {trend.platform === 'TikTok' && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 16 16"><path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3z"/></svg>}
                           {trend.platform === 'Instagram' && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 16 16"><path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 0 0-1.417.923A3.917 3.917 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.85.175 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.916 3.916 0 0 0-.923-1.417A3.916 3.916 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0h.003zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.389-.009-3.232-.047c-.78-.036-1.203-.166-1.485-.276a2.478 2.478 0 0 1-.92-.598 2.48 2.48 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.231 0-2.136.008-2.388.046-3.231.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045v.002zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217zm0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334z"/></svg>}
                           {trend.platform === 'YouTube' && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="currentColor" viewBox="0 0 16 16"><path d="M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 0 1 1.415 1.42c.101.38.172.883.22 1.402l.01.104.022.26.008.104c.065.914.073 1.77.074 1.957v.075c-.001.194-.01 1.102-.074 2.016l-.008.105-.022.259-.01.104c-.048.519-.119 1.023-.22 1.402a2.007 2.007 0 0 1-1.415 1.42c-1.16.312-5.569.334-6.18.335h-.142c-.309 0-1.587-.006-2.927-.052l-.17-.006-.087-.004-.171-.007-.171-.007c-1.11-.049-2.167-.128-2.654-.26a2.007 2.007 0 0 1-1.415-1.419c-.111-.417-.185-.986-.235-1.558L.09 9.82l-.008-.104A31.4 31.4 0 0 1 0 7.68v-.123c.002-.215.01-.958.064-1.778l.007-.103.003-.052.008-.104.022-.26.01-.104c.048-.519.119-1.023.22-1.402a2.007 2.007 0 0 1 1.415-1.42c.487-.13 1.544-.21 2.654-.26l.17-.007.171-.006.087-.004.171-.007.17-.006c1.34-.046 2.617-.052 2.927-.052H8.05zm-1.631 5.53l3.243 1.858-3.243 1.858V7.53z"/></svg>}
                      </div>
                    {/* Details */}
                    <div className="flex-grow">
                      <a href={trend.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline hover:text-accent">
                        {trend.title}
                      </a>
                      <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                         {trend.category && <span className="inline-flex items-center"><Filter className="h-3 w-3 mr-1" /> {trend.category}</span>}
                         {trend.views && <span>• {(trend.views / 1000000).toFixed(1)}M views</span>}
                         {trend.likes && <span>• {(trend.likes / 1000).toFixed(1)}K likes</span>}
                         {/* Show when it was saved (using discoveredAt as proxy, might need dedicated savedAt field) */}
                         <span className="inline-flex items-center"><Calendar className="h-3 w-3 mr-1" /> Saved {formatDistanceToNow(trend.discoveredAt, { addSuffix: true })}</span>
                      </p>
                    </div>
                  </div>
                  {/* Unsave Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mt-2 sm:mt-0 sm:ml-4 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleUnsaveTrend(trend.id)}
                    aria-label="Unsave trend"
                    disabled={isOfflineError} // Disable if offline
                     title={isOfflineError ? "Cannot unsave while offline" : "Unsave trend"}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : ( // --- No Saved Trends Message ---
            <div className="text-center py-12">
                <Star className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-2 text-lg font-medium">No Saved Trends Yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    {isOfflineError ? "Cannot load trends while offline." : "Explore trends and click the star icon to save them here."}
                </p>
                {!isOfflineError && (
                    <Link href="/dashboard/trends" className="mt-4 inline-block">
                        <Button variant="outline">Explore Trends</Button>
                    </Link>
                )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
