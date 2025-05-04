
"use client";

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Rocket, Star, Settings } from 'lucide-react';
import Link from 'next/link';

// Mock trend data structure
interface Trend {
    id: string;
    title: string;
    platform: 'TikTok' | 'Instagram' | 'YouTube';
    views?: number;
    likes?: number;
    category?: string;
    url: string;
    saved?: boolean; // Add saved status
    description?: string; // Optional description
}

// Mock function to fetch trends - replace with actual API call later
async function fetchTrendsForNiche(niche: string): Promise<Trend[]> {
  console.log(`Fetching trends for niche: ${niche}`);
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Example data - replace with real data fetching logic
  const mockTrends: Trend[] = [
    { id: '1', title: `Viral Dance Challenge in ${niche}`, platform: 'TikTok', views: 1500000, url: '#', saved: false, description: "A new dance trend taking over TikTok." },
    { id: '2', title: `Easy ${niche} Recipe Reel`, platform: 'Instagram', likes: 80000, url: '#', saved: true, description: "Quick and tasty recipe perfect for your niche." },
    { id: '3', title: `${niche} Tech Unboxing Short`, platform: 'YouTube', views: 300000, url: '#', saved: false, description: "Unboxing the latest gadget relevant to your niche." },
    { id: '4', title: `Funny ${niche} Skit`, platform: 'TikTok', views: 2200000, url: '#', saved: false, description: "A humorous take on a common situation in your niche." },
    { id: '5', title: `Top 5 ${niche} Tips`, platform: 'YouTube', views: 500000, url: '#', saved: false, description: "Helpful tips and tricks for your audience." },
  ];
  // Filter/Tailor based on niche for more realistic simulation
  return mockTrends.filter(trend => trend.title.toLowerCase().includes(niche.toLowerCase()) || Math.random() > 0.3).slice(0, 3); // Show top 3
}

// Mock function to fetch user data
async function fetchUserData(uid: string) {
    const userDocRef = doc(db, "users", uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
        return userDocSnap.data();
    } else {
        console.log("No such user document!");
        return null;
    }
}


export default function DashboardPage() {
  const { user } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const loadUserData = async () => {
        setLoadingUser(true);
        try {
          const data = await fetchUserData(user.uid);
          setUserData(data);
        } catch (err) {
          console.error("Error fetching user data:", err);
          setError("Could not load user information.");
        } finally {
          setLoadingUser(false);
        }
      };
      loadUserData();
    }
  }, [user]);

 useEffect(() => {
    if (userData?.selectedNiches && userData.selectedNiches.length > 0) {
      const loadTrends = async () => {
        setLoadingTrends(true);
        setError(null);
        try {
          // For simplicity, fetch trends for the primary niche in MVP
          // In paid version, iterate through userData.selectedNiches
          const primaryNiche = userData.primaryNiche || userData.selectedNiches[0];
          const fetchedTrends = await fetchTrendsForNiche(primaryNiche);
          // TODO: Check saved status against user's saved trends in Firestore
          setTrends(fetchedTrends);
        } catch (err) {
          console.error("Error fetching trends:", err);
          setError("Could not load trends. Please try again later.");
        } finally {
          setLoadingTrends(false);
        }
      };
      loadTrends();
    } else if (!loadingUser && user) {
         // Handle case where user data loaded but no niches found (maybe onboarding issue)
         setLoadingTrends(false);
         if (!userData) {
             setError("User data not found. Please try logging in again or contact support.");
         } else {
            // User might need to select a niche
             setError("Please select at least one niche in your settings.");
         }
    }
  }, [userData, loadingUser, user]);


  const handleSaveTrend = (trendId: string) => {
    // Placeholder: Implement saving logic (paid feature)
    // Requires Firestore update
    // Update local state for immediate feedback
    setTrends(prevTrends =>
        prevTrends.map(t => t.id === trendId ? { ...t, saved: !t.saved } : t)
    );
    console.log("Saving/unsaving trend:", trendId);
    // Check if user is paid before allowing save
    if (userData?.subscription?.plan !== 'paid') {
        // Optionally show upgrade prompt
        alert("Saving trends is a premium feature. Upgrade your plan!");
         // Revert save state if not paid
         setTimeout(() => {
             setTrends(prevTrends =>
                prevTrends.map(t => t.id === trendId ? { ...t, saved: !t.saved } : t)
             );
         }, 100);
    } else {
        // TODO: Add Firestore logic to save/unsave trend ID under user document
    }
  }

  const isPaidUser = userData?.subscription?.plan === 'paid';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Welcome, {loadingUser ? <Skeleton className="h-6 w-32 inline-block" /> : userData?.displayName || 'User'}!</CardTitle>
          <CardDescription>
            Here's a quick look at your dashboard and the latest trends for your niche{userData?.selectedNiches?.length > 1 ? 's' : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUser ? (
            <Skeleton className="h-5 w-48" />
          ) : userData?.selectedNiches ? (
            <p>Your selected niche{userData.selectedNiches.length > 1 ? 's' : ''}: <span className="font-semibold">{userData.selectedNiches.join(', ')}</span></p>
          ) : (
             <p className="text-muted-foreground">No niche selected. <Link href="/dashboard/settings" className="text-accent hover:underline">Go to settings to add one.</Link></p>
          )}
           {!isPaidUser && (
              <Alert className="mt-4 bg-accent/10 border-accent/30 text-accent-foreground">
                 <Rocket className="h-4 w-4 !text-accent" />
                 <AlertTitle className="text-accent">Go Premium!</AlertTitle>
                 <AlertDescription>
                   Unlock multiple niches, real-time alerts, saved trends, and Slack integration.
                   <Link href="/dashboard/billing" className="ml-2 font-semibold underline">Upgrade Now</Link>
                 </AlertDescription>
               </Alert>
           )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Latest Trend Alerts</CardTitle>
            <CardDescription>Top 3 trends based on your primary niche for today.</CardDescription>
          </div>
           <Link href="/dashboard/trends">
             <Button variant="outline" size="sm">View All Trends</Button>
           </Link>
        </CardHeader>
        <CardContent>
          {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {loadingTrends ? (
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
          ) : trends.length > 0 ? (
            <ul className="space-y-4">
              {trends.map((trend) => (
                <li key={trend.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                   <div className="flex items-start gap-4 mb-2 sm:mb-0">
                        {/* Platform Icon Placeholder */}
                        <div className="p-2 bg-secondary rounded-md">
                           {trend.platform === 'TikTok' && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3z"/>
                                </svg>
                            }
                           {trend.platform === 'Instagram' && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 0 0-1.417.923A3.917 3.917 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.85.175 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.916 3.916 0 0 0-.923-1.417A3.916 3.916 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0h.003zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.389-.009-3.232-.047c-.78-.036-1.203-.166-1.485-.276a2.478 2.478 0 0 1-.92-.598 2.48 2.48 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.231 0-2.136.008-2.388.046-3.231.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045v.002zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217zm0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334z"/>
                            </svg>}
                           {trend.platform === 'YouTube' && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 0 1 1.415 1.42c.101.38.172.883.22 1.402l.01.104.022.26.008.104c.065.914.073 1.77.074 1.957v.075c-.001.194-.01 1.102-.074 2.016l-.008.105-.022.259-.01.104c-.048.519-.119 1.023-.22 1.402a2.007 2.007 0 0 1-1.415 1.42c-1.16.312-5.569.334-6.18.335h-.142c-.309 0-1.587-.006-2.927-.052l-.17-.006-.087-.004-.171-.007-.171-.007c-1.11-.049-2.167-.128-2.654-.26a2.007 2.007 0 0 1-1.415-1.419c-.111-.417-.185-.986-.235-1.558L.09 9.82l-.008-.104A31.4 31.4 0 0 1 0 7.68v-.123c.002-.215.01-.958.064-1.778l.007-.103.003-.052.008-.104.022-.26.01-.104c.048-.519.119-1.023.22-1.402a2.007 2.007 0 0 1 1.415-1.42c.487-.13 1.544-.21 2.654-.26l.17-.007.171-.006.087-.004.171-.007.17-.006c1.34-.046 2.617-.052 2.927-.052H8.05zm-1.631 5.53l3.243 1.858-3.243 1.858V7.53z"/>
                            </svg>}
                        </div>
                       <div>
                          <a href={trend.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline hover:text-accent">
                            {trend.title}
                          </a>
                           <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                <span>{trend.platform}</span>
                                {trend.views && <span>• {(trend.views / 1000000).toFixed(1)}M views</span>}
                                {trend.likes && <span>• {(trend.likes / 1000).toFixed(1)}K likes</span>}
                            </p>
                            {trend.description && <p className="text-sm text-muted-foreground mt-1">{trend.description}</p>}
                       </div>
                   </div>

                  <Button
                      variant={trend.saved ? "secondary" : "ghost"}
                      size="icon"
                      className={`mt-2 sm:mt-0 sm:ml-4 ${trend.saved ? 'text-accent' : ''}`}
                      onClick={() => handleSaveTrend(trend.id)}
                      aria-label={trend.saved ? "Unsave trend" : "Save trend"}
                    >
                      <Star className={`h-5 w-5 ${trend.saved ? 'fill-current' : ''}`} />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-muted-foreground py-8">No trends found for your niche today. Check back later!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
