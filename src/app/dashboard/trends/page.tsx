
"use client";

import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Star, Filter, Calendar } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDistanceToNow } from 'date-fns'; // For showing relative time

// Mock trend data structure - expanded
interface Trend {
    id: string;
    title: string;
    platform: 'TikTok' | 'Instagram' | 'YouTube';
    views?: number;
    likes?: number;
    category?: string; // AI-assigned category/niche
    url: string;
    saved?: boolean;
    description?: string;
    discoveredAt: Date; // When the trend was first detected
    growthRate?: number; // Optional: growth indicator
}

// Mock function to fetch trends - enhance with filters
async function fetchAllTrends(filters: { niche?: string; platform?: string; dateRange?: string }): Promise<Trend[]> {
    console.log(`Fetching all trends with filters:`, filters);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Example data - replace with real data fetching logic from your backend/service
    const mockTrends: Trend[] = Array.from({ length: 20 }, (_, i) => {
        const platforms: ('TikTok' | 'Instagram' | 'YouTube')[] = ['TikTok', 'Instagram', 'YouTube'];
        const platform = platforms[i % 3];
        const niche = ["Fashion", "Tech", "Food", "Fitness"][i % 4];
        return {
            id: `trend-${i + 1}`,
            title: `Trending ${niche} Content ${i + 1}`,
            platform: platform,
            views: platform !== 'Instagram' ? Math.floor(Math.random() * 5000000) + 100000 : undefined,
            likes: platform === 'Instagram' ? Math.floor(Math.random() * 200000) + 5000 : undefined,
            category: niche,
            url: '#', // Replace with actual URLs
            saved: Math.random() > 0.8, // Simulate some saved trends
            description: `Description for trending ${niche} content ${i + 1}. Lorem ipsum dolor sit amet.`,
            discoveredAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Discovered within last 7 days
            growthRate: Math.random() > 0.7 ? Math.floor(Math.random() * 300) + 50 : undefined, // Simulate explosive growth
        };
    });

    // Apply filters (simple mock implementation)
    let filteredTrends = mockTrends;
    if (filters.niche && filters.niche !== 'all') {
        filteredTrends = filteredTrends.filter(t => t.category?.toLowerCase() === filters.niche?.toLowerCase());
    }
    if (filters.platform && filters.platform !== 'all') {
        filteredTrends = filteredTrends.filter(t => t.platform.toLowerCase() === filters.platform?.toLowerCase());
    }
    // Add date range filtering if needed based on `filters.dateRange`

    return filteredTrends;
}

// Fetch user data including saved trends and niches
async function fetchUserDataWithDetails(uid: string) {
    const userDocRef = doc(db, "users", uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
        return userDocSnap.data() as {
            uid: string;
            email: string;
            displayName: string;
            primaryNiche: string;
            selectedNiches: string[];
            savedTrendIds?: string[];
            subscription: { plan: string; status: string };
            // Add other fields as needed
        };
    } else {
        console.log("No such user document!");
        return null;
    }
}

// Example niches, ideally fetch from config or user settings
const NICHES = ["all", "Fashion", "Beauty", "Fitness", "Food", "Travel", "Tech", "Gaming", "Finance", "Education", "DIY", "Comedy", "Dance", "Music", "Art"];
const PLATFORMS = ["all", "TikTok", "Instagram", "YouTube"];
const DATE_RANGES = ["today", "last_3_days", "last_7_days"];

export default function TrendsPage() {
  const { user } = useAuth();
  const [userData, setUserData] = useState<Awaited<ReturnType<typeof fetchUserDataWithDetails>> | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [selectedNiche, setSelectedNiche] = useState<string>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('last_7_days');

  useEffect(() => {
    if (user) {
      const loadInitialData = async () => {
        setLoading(true);
        setError(null);
        try {
          const fetchedUserData = await fetchUserDataWithDetails(user.uid);
          setUserData(fetchedUserData);

          // Set initial niche filter based on user's primary niche if available
          const initialNiche = fetchedUserData?.primaryNiche || 'all';
          setSelectedNiche(initialNiche);

          const fetchedTrends = await fetchAllTrends({
              niche: initialNiche,
              platform: selectedPlatform,
              dateRange: selectedDateRange
          });

          // Mark trends as saved based on user data
          const savedIds = fetchedUserData?.savedTrendIds || [];
          const trendsWithSaveStatus = fetchedTrends.map(trend => ({
             ...trend,
             saved: savedIds.includes(trend.id),
          }));

          setTrends(trendsWithSaveStatus);
        } catch (err) {
          console.error("Error loading trends:", err);
          setError("Could not load trends. Please try again later.");
        } finally {
          setLoading(false);
        }
      };
      loadInitialData();
    }
  }, [user]); // Load initial data on user load

  // Effect to refetch trends when filters change
  useEffect(() => {
    // Don't run on initial mount if user isn't loaded yet
    if (!user || loading) return;

    const refetchTrends = async () => {
        setLoading(true); // Indicate loading state for trends specifically
        setError(null);
        try {
             const fetchedTrends = await fetchAllTrends({
                niche: selectedNiche,
                platform: selectedPlatform,
                dateRange: selectedDateRange
             });
             // Re-apply saved status based on current userData
             const savedIds = userData?.savedTrendIds || [];
             const trendsWithSaveStatus = fetchedTrends.map(trend => ({
                 ...trend,
                 saved: savedIds.includes(trend.id),
             }));
             setTrends(trendsWithSaveStatus);
        } catch (err) {
             console.error("Error refetching trends:", err);
             setError("Could not load trends with the selected filters.");
        } finally {
            setLoading(false);
        }
    };

    refetchTrends();
  }, [selectedNiche, selectedPlatform, selectedDateRange, user, userData?.savedTrendIds]); // Rerun when filters or user's saved trends change


  const handleSaveTrend = async (trendId: string, currentlySaved: boolean) => {
     if (!user || !userData) return;

     const isPaid = userData.subscription?.plan === 'paid';
     if (!isPaid) {
         alert("Saving trends is a premium feature. Please upgrade your plan.");
         return;
     }

     // Optimistic UI update
     const originalTrends = [...trends];
     setTrends(prevTrends =>
         prevTrends.map(t => t.id === trendId ? { ...t, saved: !currentlySaved } : t)
     );
     setUserData(prevUserData => ({
         ...prevUserData!,
         savedTrendIds: currentlySaved
            ? (prevUserData?.savedTrendIds || []).filter(id => id !== trendId)
            : [...(prevUserData?.savedTrendIds || []), trendId],
     }));


     try {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
            savedTrendIds: currentlySaved ? arrayRemove(trendId) : arrayUnion(trendId)
        });
        console.log(`Trend ${trendId} ${currentlySaved ? 'unsaved' : 'saved'} successfully.`);
     } catch (error) {
        console.error("Failed to update saved trend:", error);
        // Revert optimistic update on error
        setTrends(originalTrends);
        setUserData(prevUserData => ({ // Revert userData change
            ...prevUserData!,
            savedTrendIds: currentlySaved
                ? [...(prevUserData?.savedTrendIds || []), trendId] // Add it back if removal failed
                : (prevUserData?.savedTrendIds || []).filter(id => id !== trendId) // Remove it if addition failed
        }));
        alert(`Failed to ${currentlySaved ? 'unsave' : 'save'} trend. Please try again.`);
     }
  };

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
             <div className="flex-1 space-y-2">
                <Label htmlFor="niche-filter">Niche</Label>
                <Select value={selectedNiche} onValueChange={setSelectedNiche} disabled={loading}>
                    <SelectTrigger id="niche-filter">
                        <SelectValue placeholder="Filter by niche" />
                    </SelectTrigger>
                    <SelectContent>
                        {NICHES.map((niche) => (
                            <SelectItem key={niche} value={niche}>
                                {niche === 'all' ? 'All Niches' : niche}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
             </div>
             <div className="flex-1 space-y-2">
                <Label htmlFor="platform-filter">Platform</Label>
                <Select value={selectedPlatform} onValueChange={setSelectedPlatform} disabled={loading}>
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
             <div className="flex-1 space-y-2">
                <Label htmlFor="date-filter">Date Range</Label>
                 <Select value={selectedDateRange} onValueChange={setSelectedDateRange} disabled={loading}>
                    <SelectTrigger id="date-filter">
                        <SelectValue placeholder="Filter by date" />
                    </SelectTrigger>
                    <SelectContent>
                        {DATE_RANGES.map((range) => (
                            <SelectItem key={range} value={range}>
                                {range === 'today' ? 'Today' : range === 'last_3_days' ? 'Last 3 Days' : 'Last 7 Days'}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
             </div>
          </div>

          {/* Trends List */}
          {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                 <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                    <Skeleton className="h-12 w-12 rounded-md" />
                    <div className="space-y-2 flex-grow">
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-3 w-3/5" />
                        <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-full" />
                 </div>
              ))}
            </div>
          ) : trends.length > 0 ? (
            <ul className="space-y-4">
              {trends.map((trend) => (
                <li key={trend.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                   <div className="flex items-start gap-4 mb-2 sm:mb-0 flex-grow">
                       {/* Platform Icon Placeholder */}
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
                                <span className="inline-flex items-center"><Filter className="h-3 w-3 mr-1" /> {trend.category}</span>
                                {trend.views && <span>• {(trend.views / 1000000).toFixed(1)}M views</span>}
                                {trend.likes && <span>• {(trend.likes / 1000).toFixed(1)}K likes</span>}
                                <span className="inline-flex items-center"><Calendar className="h-3 w-3 mr-1" /> {formatDistanceToNow(trend.discoveredAt, { addSuffix: true })}</span>
                            </p>
                            {trend.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{trend.description}</p>}
                       </div>
                   </div>
                    <Button
                        variant={trend.saved ? "secondary" : "ghost"}
                        size="icon"
                        className={`mt-2 sm:mt-0 sm:ml-4 shrink-0 ${trend.saved ? 'text-accent' : ''}`}
                        onClick={() => handleSaveTrend(trend.id, !!trend.saved)}
                        aria-label={trend.saved ? "Unsave trend" : "Save trend"}
                        disabled={!userData} // Disable if user data isn't loaded
                    >
                        <Star className={`h-5 w-5 ${trend.saved ? 'fill-current' : ''}`} />
                    </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-muted-foreground py-8">No trends match your current filters. Try broadening your search!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { Label } from '@/components/ui/label'; // Ensure Label is imported
