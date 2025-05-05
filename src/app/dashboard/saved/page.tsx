
"use client";

import { useEffect, useState } from 'react';
import {
    doc, getDoc, updateDoc, arrayRemove,
    collection, query, where, getDocs, documentId,
    Timestamp, FirestoreError, enableNetwork
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bookmark, Trash2, WifiOff, BrainCircuit } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns'; // For formatting dates

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
    const userDocRef = doc(db, "users", uid);
    try {
        await enableNetwork(db);
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
                if (userDocSnap.exists()) return { ...userDocSnap.data(), isOffline: true } as UserData;
                else throw new Error("Offline and no cached user data.");
            } catch (cacheError) { throw new Error("Could not load user data (offline)."); }
        }
        throw error;
    }
}

// Fetch details for saved forecast items from the 'forecasts' collection
// This is more complex as item details are nested within weekly forecast docs.
// Strategy: Fetch all forecasts containing any of the saved item IDs.
// This might be inefficient if a user saves many items across many weeks.
// Alternative: Store item details redundantly in a separate 'saved_items' collection (more writes, faster reads).
// Let's try the less efficient way first.

async function fetchSavedItemDetails(itemIds: string[]): Promise<SavedForecastItem[]> {
    console.log(`SavedForecastsPage: Fetching details for ${itemIds.length} saved items...`);
    if (itemIds.length === 0) return [];

    const forecastsCollection = collection(db, 'forecasts');
    const savedItems: SavedForecastItem[] = [];
    const MAX_IDS_PER_CHUNK = 10; // Fetch forecasts in smaller chunks for potentially large item arrays

    // We need to query forecasts containing ANY of the saved IDs.
    // Firestore doesn't directly support 'array-contains-any' on nested objects.
    // Workaround: Fetch forecasts potentially relevant (e.g., recent ones for user's niches)
    // OR fetch ALL forecasts and filter client-side (bad for large datasets).
    // OR restructure data (e.g., top-level 'forecastItems' collection).

    // Let's try fetching recent forecasts and filtering client-side (demonstration, may need optimization)
    // This assumes we might need to fetch ALL forecasts if items are old/across niches.
    // A more robust solution would involve better data modeling or backend assistance.

    console.warn("SavedForecastsPage: Fetching all forecasts to find saved items - this can be inefficient. Consider data restructuring for optimization.");

    const allForecastsQuery = query(forecastsCollection, orderBy('weekStartDate', 'desc'), limit(50)); // Limit fetch scope initially

    try {
        await enableNetwork(db);
        const querySnapshot = await getDocs(allForecastsQuery);

        querySnapshot.forEach((docSnap) => {
            const forecastData = docSnap.data();
            if (forecastData.forecastItems && Array.isArray(forecastData.forecastItems)) {
                forecastData.forecastItems.forEach((item: any) => {
                    if (itemIds.includes(item.id)) {
                        savedItems.push({
                            id: item.id,
                            title: item.title || 'Untitled',
                            description: item.description || '',
                            niche: forecastData.niche || 'Unknown',
                            weekStartDate: (forecastData.weekStartDate as Timestamp)?.toDate() || new Date(0),
                            // Add confidence, hashtags here if needed
                        });
                    }
                });
            }
        });

        // Filter out duplicates if an item ID somehow matched multiple forecasts (shouldn't happen with UUIDs)
        const uniqueSavedItems = Array.from(new Map(savedItems.map(item => [item.id, item])).values());
        console.log(`SavedForecastsPage: Found details for ${uniqueSavedItems.length} saved items.`);
        return uniqueSavedItems;

    } catch (error) {
        console.error("SavedForecastsPage: Error fetching forecast details:", error);
         if (error instanceof FirestoreError && (error.code === 'unavailable' || error.message.includes('offline'))) {
            console.warn("SavedForecastsPage: Cannot fetch item details while offline.");
            // Cannot reliably get details from cache this way if forecasts aren't already cached.
            throw new Error("Could not load saved item details (offline).");
         } else if (error instanceof FirestoreError && error.code === 'failed-precondition') {
             throw new Error("Database query error fetching forecasts: Index missing.");
         }
        throw error;
    }
}


// --- Component Logic ---

export default function SavedForecastsPage() {
  const { user } = useAuth();
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
          // 1. Fetch User Data (includes saved IDs)
          fetchedUserData = await fetchUserDataWithSavedItems(user.uid);
          setUserData(fetchedUserData);
          setIsOfflineError(!!fetchedUserData?.isOffline);
          if (fetchedUserData?.isOffline) setError("Could not load data (offline).");

          if (!fetchedUserData) {
            setError("User profile not found.");
            setLoading(false); return;
          }
          if (fetchedUserData.subscription?.plan !== 'paid') {
             setError("Access denied. Saving forecasts is a premium feature.");
             setLoading(false); return;
          }

          // 2. Fetch Item Details using saved IDs
          const savedIds = fetchedUserData.savedForecastItemIds || [];
          if (savedIds.length > 0) {
             const fetchedItems = await fetchSavedItemDetails(savedIds);
             // Sort items by week start date, newest first
             fetchedItems.sort((a, b) => b.weekStartDate.getTime() - a.weekStartDate.getTime());
             setSavedItems(fetchedItems);
             if (!fetchedUserData.isOffline) { setError(null); setIsOfflineError(false); } // Clear error if fetch succeeded online
          } else {
             setSavedItems([]); // No items saved
             if (!fetchedUserData.isOffline) { setError(null); setIsOfflineError(false); }
          }

        } catch (err: any) {
          setError(err.message || "Could not load saved forecasts.");
          if (err.message.includes("offline")) setIsOfflineError(true);
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
     if (!user || !userData || isOfflineError) {
         if(isOfflineError) alert("Cannot unsave items while offline.");
         return;
     }

     // Optimistic UI Update
     const originalItems = [...savedItems];
     setSavedItems(prevItems => prevItems.filter(item => item.id !== itemId));
     setUserData(prev => prev ? { ...prev, savedForecastItemIds: (prev.savedForecastItemIds || []).filter(id => id !== itemId) } : null);

     // Firestore Update
     try {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, { savedForecastItemIds: arrayRemove(itemId) });
        console.log(`SavedForecastsPage: Item ${itemId} unsaved successfully.`);
     } catch (error) {
        console.error("SavedForecastsPage: Failed to unsave item:", error);
        // Revert Optimistic Update
        setSavedItems(originalItems);
         setUserData(prev => prev ? { ...prev, savedForecastItemIds: [...(prev.savedForecastItemIds || []), itemId] } : null);
        alert(`Failed to unsave item. Please try again.`);
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
  if (!isPaidUser && user && !loading) { // Show upgrade prompt
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

  if (error && !loading) { // Show general or offline error
      return (
           <Alert variant={isOfflineError ? "default" : "destructive"} className={isOfflineError ? "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10" : ""}>
              {isOfflineError && <WifiOff className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />}
              <AlertTitle>{isOfflineError ? "Offline" : "Error"}</AlertTitle>
              <AlertDescription>
                {error}
                {isOfflineError && <span className="block mt-1 text-xs">Cached data may be limited. Check connection.</span>}
              </AlertDescription>
           </Alert>
      );
  }

  // --- Main Content: Display Saved Items ---
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your Saved Forecast Items</CardTitle>
          <CardDescription>Revisit your bookmarked trend predictions and ideas.</CardDescription>
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
                    disabled={isOfflineError}
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
                {!isOfflineError && (
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
