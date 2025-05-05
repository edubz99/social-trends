
"use client";

import { useEffect, useState } from 'react';
import {
    doc, getDoc, updateDoc, arrayRemove,
    collection, query, where, getDocs, documentId,
    Timestamp, FirestoreError, enableNetwork
} from 'firebase/firestore';
import { db, firebaseInitialized } from '@/lib/firebase'; // Import firebaseInitialized
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bookmark, Trash2, WifiOff, BrainCircuit } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns'; // For formatting dates
import { useToast } from '@/hooks/use-toast'; // Import useToast

// --- Data Structures ---

// Represents a single forecast item (simplified for display)
interface SavedForecastItem {
    id: string; // Item ID
    title: string;
    description: string;
    niche: string; // Niche of the original forecast
    weekStartDate: Date; // Week start date of the original forecast
    // Add other fields like confidence, hashtags if needed
}

// User data needed for this page
interface UserData {
    uid: string;
    subscription: { plan: 'free' | 'paid'; status: string; };
    savedForecastItemIds: string[];
    isOffline?: boolean;
}

// --- Firestore Fetching ---

// Fetch user data including saved item IDs
async function fetchUserDataWithSavedItems(uid: string): Promise<UserData | null> {
    console.log("SavedForecastsPage: Fetching user data...");
    if (!firebaseInitialized || !db) {
        console.error("SavedForecastsPage: Firebase not initialized.");
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
                subscription: data.subscription || { plan: 'free', status: 'active' },
                savedForecastItemIds: data.savedForecastItemIds || [],
            };
        } else { return null; }
    } catch (error) {
        console.error("SavedForecastsPage: Error fetching user data:", error);
        if (error instanceof FirestoreError && (error.code === 'unavailable' || error.message.includes('offline'))) {
            try { // Try cache
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    console.log("SavedForecastsPage: Fetched user data from cache (offline).");
                    return { ...userDocSnap.data(), isOffline: true } as UserData;
                }
                else {
                     console.error("SavedForecastsPage: User data not in cache (offline).");
                     throw new Error("Could not load user data (offline).");
                }
            } catch (cacheError) {
                 console.error("SavedForecastsPage: Error fetching user data from cache:", cacheError);
                 throw new Error("Could not load user data (offline).");
            }
        }
        throw new Error(`Failed to fetch user data: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Fetch details for saved forecast items
async function fetchSavedItemDetails(itemIds: string[]): Promise<SavedForecastItem[]> {
    console.log(`SavedForecastsPage: Fetching details for ${itemIds.length} saved items...`);
    if (!firebaseInitialized || !db) {
        console.error("SavedForecastsPage: Firebase not initialized.");
        throw new Error("Application not properly configured.");
    }
    if (itemIds.length === 0) return [];

    const forecastsCollection = collection(db, 'forecasts');
    const savedItems: SavedForecastItem[] = [];

    // Fetch ALL forecasts and filter client-side (inefficient, needs optimization for scale)
    console.warn("SavedForecastsPage: Fetching potentially many forecasts to find saved items - this can be inefficient. Consider data restructuring for optimization.");
    const allForecastsQuery = query(forecastsCollection, orderBy('weekStartDate', 'desc'), limit(100)); // Increase limit slightly

    try {
         try { await enableNetwork(db); } catch(e) { console.warn("[Firebase] Network enable failed (might be ok):", e) }
        const querySnapshot = await getDocs(allForecastsQuery);

        querySnapshot.forEach((docSnap) => {
            const forecastData = docSnap.data();
            if (forecastData.forecastItems && Array.isArray(forecastData.forecastItems)) {
                forecastData.forecastItems.forEach((item: any) => {
                    if (itemIds.includes(item.id)) {
                         if (!item.title || !item.description || !forecastData.niche || !forecastData.weekStartDate) {
                             console.warn(`SavedForecastsPage: Skipping saved item ${item.id} due to missing data in forecast ${docSnap.id}`);
                             return;
                         }
                        savedItems.push({
                            id: item.id,
                            title: item.title,
                            description: item.description,
                            niche: forecastData.niche,
                            weekStartDate: (forecastData.weekStartDate as Timestamp)?.toDate() || new Date(0),
                        });
                    }
                });
            }
        });

        const uniqueSavedItems = Array.from(new Map(savedItems.map(item => [item.id, item])).values());
        console.log(`SavedForecastsPage: Found details for ${uniqueSavedItems.length} saved items.`);
        return uniqueSavedItems;

    } catch (error) {
        console.error("SavedForecastsPage: Error fetching forecast details:", error);
         if (error instanceof FirestoreError && (error.code === 'unavailable' || error.message.includes('offline'))) {
            console.warn("SavedForecastsPage: Cannot fetch item details while offline.");
            // Attempt cache fetch - might not work well with this broad query
             try {
                 const querySnapshot = await getDocs(allForecastsQuery); // Try cache
                 querySnapshot.forEach((docSnap) => {
                     const forecastData = docSnap.data();
                     if (forecastData.forecastItems && Array.isArray(forecastData.forecastItems)) {
                         forecastData.forecastItems.forEach((item: any) => {
                              if (itemIds.includes(item.id)) {
                                 if (!item.title || !item.description || !forecastData.niche || !forecastData.weekStartDate) return;
                                savedItems.push({ /* ... item data ... */ } as SavedForecastItem);
                              }
                         });
                     }
                 });
                  const uniqueSavedItems = Array.from(new Map(savedItems.map(item => [item.id, item])).values());
                 console.log(`SavedForecastsPage: Found ${uniqueSavedItems.length} item details in cache (offline).`);
                 // Throw specific offline error AFTER processing cache
                 throw new Error("Could not load all saved item details (offline).");
             } catch(cacheError) {
                  console.error("SavedForecastsPage: Error fetching forecast details from cache:", cacheError);
                  throw new Error("Could not load saved item details (offline).");
             }
         } else if (error instanceof FirestoreError && error.code === 'failed-precondition') {
             throw new Error("Database query error fetching forecasts: Index missing.");
         }
         // Rethrow other errors
        throw new Error(`Failed to fetch saved item details: ${error instanceof Error ? error.message : String(error)}`);
    }
}


// --- Component Logic ---

export default function SavedForecastsPage() {
  const { user } = useAuth();
  const { toast } = useToast(); // Use toast hook inside the component
  const [userData, setUserData] = useState<UserData | null>(null);
  const [savedItems, setSavedItems] = useState<SavedForecastItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineError, setIsOfflineError] = useState(false);

  // Fetch User Data and Saved Items Effect
  useEffect(() => {
    if (user) {
      const loadSavedData = async () => {
        setLoading(true);
        setError(null);
        setIsOfflineError(false);
        let fetchedUserData: UserData | null = null;

        try {
          // 1. Fetch User Data
          fetchedUserData = await fetchUserDataWithSavedItems(user.uid);
          setUserData(fetchedUserData);
          // Set offline status based on user data fetch result
          setIsOfflineError(!!fetchedUserData?.isOffline);
          if (fetchedUserData?.isOffline) setError("Could not load data (offline).");

          if (!fetchedUserData) {
            setError("User profile not found."); setLoading(false); return;
          }
          if (fetchedUserData.subscription?.plan !== 'paid') {
             setError("Access denied. Saving forecasts is a premium feature."); setLoading(false); return;
          }

          // 2. Fetch Item Details
          const savedIds = fetchedUserData.savedForecastItemIds || [];
          if (savedIds.length > 0) {
             const fetchedItems = await fetchSavedItemDetails(savedIds);
             fetchedItems.sort((a, b) => b.weekStartDate.getTime() - a.weekStartDate.getTime());
             setSavedItems(fetchedItems);
             // If item fetch succeeded AND user data was online, clear errors
             if (!fetchedUserData.isOffline) { setError(null); setIsOfflineError(false); }
          } else {
             setSavedItems([]); // No items saved
             if (!fetchedUserData.isOffline) { setError(null); setIsOfflineError(false); }
          }

        } catch (err: any) {
           const errorMessage = err.message || "Could not load saved forecasts.";
           setError(errorMessage);
           // Explicitly check for offline error message
           if (errorMessage.includes("offline")) setIsOfflineError(true);
           else setIsOfflineError(false);
           setSavedItems([]); // Clear items on error
        } finally {
          setLoading(false);
        }
      };
      loadSavedData();
    } else {
        setLoading(false);
        setError("Please log in to view saved forecasts.");
    }
  }, [user]);

  // Action to Unsave an Item
  const handleUnsaveItem = async (itemId: string) => {
     if (!user || !userData) return; // Basic check
     if (isOfflineError) {
         toast({ title: "Offline", description: "Cannot unsave items while offline.", variant: "destructive" });
         return;
     }

     // Optimistic UI Update
     const originalItems = [...savedItems];
     setSavedItems(prevItems => prevItems.filter(item => item.id !== itemId));
     setUserData(prev => prev ? { ...prev, savedForecastItemIds: (prev.savedForecastItemIds || []).filter(id => id !== itemId) } : null);

     // Firestore Update
     try {
        if (!firebaseInitialized || !db) throw new Error("Firebase not initialized");
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, { savedForecastItemIds: arrayRemove(itemId) });
        console.log(`SavedForecastsPage: Item ${itemId} unsaved successfully.`);
         toast({ title: "Success", description: "Item removed from saved list." });
     } catch (error: any) {
        console.error("SavedForecastsPage: Failed to unsave item:", error);
        // Revert Optimistic Update
        setSavedItems(originalItems);
         setUserData(prev => prev ? { ...prev, savedForecastItemIds: [...(prev.savedForecastItemIds || []), itemId] } : null);
        toast({ title: "Error", description: `Failed to unsave item. ${error.message}`, variant: "destructive"});
     }
  };

  // --- Render Logic ---

   const isPaidUser = userData?.subscription?.plan === 'paid';

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
                 <Skeleton className="h-10 w-10 rounded-md" />
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
  if (!isPaidUser && user && !loading) { // Show upgrade prompt if user loaded but not paid
     return (
        <Alert variant="destructive" className="mt-4">
            <Bookmark className="h-4 w-4" />
            <AlertTitle>Premium Feature</AlertTitle>
            <AlertDescription>
                Saving and managing forecasts requires a Premium plan. <Link href="/dashboard/billing" className="font-semibold underline">Upgrade your plan</Link>.
            </AlertDescription>
        </Alert>
     );
  }

  if (error && !loading) { // Show general or offline error AFTER loading finished
      const variant = isOfflineError ? "default" : "destructive";
      const title = isOfflineError ? "Offline" : "Error";
      return (
           <Alert variant={variant} className={isOfflineError ? "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10" : ""}>
              {isOfflineError && <WifiOff className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />}
              <AlertTitle>{title}</AlertTitle>
              <AlertDescription>
                {error}
                {isOfflineError && <span className="block mt-1 text-xs">Cached data may be limited. Check connection.</span>}
              </AlertDescription>
           </Alert>
      );
  }

  // --- Main Content: Display Saved Items ---
  // Show content if loading is done AND (no error OR (offline error AND potentially cached items))
  if (!loading && (!error || isOfflineError)) {
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Saved Forecast Items</CardTitle>
              <CardDescription>
                  Revisit your bookmarked trend predictions and ideas.
                  {isOfflineError && <span className="text-yellow-600 dark:text-yellow-400 font-semibold"> (Offline - List may be incomplete)</span>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {savedItems.length > 0 ? (
                <ul className="space-y-4">
                  {savedItems.map((item) => (
                    <li key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      {/* Item Info */}
                      <div className="flex items-start gap-4 mb-2 sm:mb-0 flex-grow min-w-0">
                          <div className="p-2 bg-secondary rounded-md mt-1 shrink-0">
                             <BrainCircuit className="h-6 w-6 text-accent" />
                          </div>
                        <div className="flex-grow min-w-0">
                          <h3 className="font-semibold">{item.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{item.description}</p>
                          <p className="text-xs text-muted-foreground/80 mt-1">
                            From: {item.niche} forecast (Week of {format(item.weekStartDate, 'MMM d, yyyy')})
                          </p>
                        </div>
                      </div>
                      {/* Unsave Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mt-2 sm:mt-0 sm:ml-4 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleUnsaveItem(item.id)}
                        aria-label="Unsave forecast item"
                        disabled={isOfflineError} // Disable unsave button when offline
                        title={isOfflineError ? "Cannot unsave while offline" : "Unsave item"}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : ( // --- No Saved Items Message ---
                <div className="text-center py-12">
                    <Bookmark className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-2 text-lg font-medium">No Saved Items Yet</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {isOfflineError ? "Cannot load saved items while offline." : "Explore forecasts and click the bookmark icon to save items here."}
                    </p>
                    {!isOfflineError && ( // Only show link if online
                        <Link href="/dashboard/forecasts" className="mt-4 inline-block">
                            <Button variant="outline">Explore Forecasts</Button>
                        </Link>
                    )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
  }

  // Fallback for any unexpected state (should normally be loading or error)
  return null;
}
