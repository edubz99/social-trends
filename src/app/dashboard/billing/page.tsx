
"use client";

import { useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle, XCircle, ExternalLink, Rocket } from 'lucide-react';

// Placeholder function to create a Stripe Checkout session
// In a real app, this would call a backend function (Next.js API route or Firebase Function)
async function createCheckoutSession(userId: string, priceId: string): Promise<{ sessionId: string } | { error: string }> {
    console.log(`Creating checkout session for user ${userId} with price ${priceId}`);
    // Simulate backend call delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // !! IMPORTANT !!
    // This is a placeholder. In a real application:
    // 1. Create a Next.js API route (e.g., /api/stripe/create-checkout).
    // 2. In the API route, verify the user's authentication.
    // 3. Use the Stripe Node.js library (`stripe.checkout.sessions.create`).
    // 4. Pass the user ID and price ID.
    // 5. Set success_url and cancel_url back to your app (e.g., /dashboard/billing?success=true).
    // 6. Return the session ID to the client.
    // 7. Redirect the client to Stripe Checkout using the session ID.

    // Example successful response (replace with actual session ID)
    // return { sessionId: 'cs_test_abcdefg...' };

    // Example error response
     return { error: "Checkout session creation is not implemented yet." };

     // If using Firebase Extensions (stripe/firestore-stripe-payments),
     // you might just need to write a document to a specific collection
     // to trigger the checkout session creation. Refer to the extension docs.
}

// Placeholder function to create a Stripe Customer Portal session
// Similar to checkout, this needs a backend implementation
async function createCustomerPortalSession(userId: string): Promise<{ url: string } | { error: string }> {
    console.log(`Creating customer portal session for user ${userId}`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // !! IMPORTANT !!
    // This requires a backend function:
    // 1. Create an API route (e.g., /api/stripe/create-portal).
    // 2. Verify user authentication.
    // 3. Retrieve the Stripe Customer ID associated with the Firebase user (often stored in Firestore).
    // 4. Use `stripe.billingPortal.sessions.create` with the customer ID and a return_url.
    // 5. Return the portal session URL to the client.
    // 6. Redirect the client to the Stripe Customer Portal.

    // Example successful response (replace with actual URL)
    // return { url: 'https://billing.stripe.com/p/session/...' };

     return { error: "Customer portal session creation is not implemented yet." };

     // The stripe/firestore-stripe-payments extension might simplify this. Check its features.
}


// Define plan details (could be fetched from config/backend)
const PLANS = {
  free: {
    name: "Free",
    price: "$0/month",
    features: ["1 Niche", "Daily Email Summary", "3 Trend Alerts per Email"],
    priceId: null, // No Stripe Price ID for free plan
  },
  paid: {
    name: "Premium",
    price: "$9.99/month",
    features: ["Multiple Niches", "Daily & Real-time Alerts", "Save Favorite Trends", "Slack Integration"],
    // Replace with your actual Stripe Price ID for the monthly subscription
    priceId: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID || "price_example_premium_monthly",
  },
};

export default function BillingPage() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<{ plan: string; status: string; stripeCustomerId?: string } | null | undefined>(undefined); // undefined: loading, null: error/not found
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'checkout' | 'portal' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
       setLoading(true);
       const userDocRef = doc(db, "users", user.uid);

       // Use onSnapshot for real-time updates (optional but good for subscription status)
       const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSubscription({
                    plan: data.subscription?.plan || 'free',
                    status: data.subscription?.status || 'inactive',
                    stripeCustomerId: data.stripeCustomerId, // Assuming you store this
                });
                setError(null);
            } else {
                setError("User profile not found.");
                setSubscription(null);
            }
            setLoading(false);
       }, (err) => {
            console.error("Error fetching subscription:", err);
            setError("Could not load subscription details.");
            setSubscription(null);
            setLoading(false);
       });

       // Cleanup listener on unmount
       return () => unsubscribe();
    } else {
        setLoading(false);
        setError("Please log in to manage billing.");
    }
  }, [user]);

 const handleUpgrade = async () => {
    if (!user || !PLANS.paid.priceId) {
        setError("Could not initiate upgrade. User or Plan ID missing.");
        return;
    }
    setActionLoading('checkout');
    setError(null);

    // Call backend to create checkout session
    const result = await createCheckoutSession(user.uid, PLANS.paid.priceId);

    if ('sessionId' in result) {
       // Redirect to Stripe Checkout - Requires Stripe.js library
       // const stripe = await getStripe(); // Load Stripe.js instance
       // await stripe.redirectToCheckout({ sessionId: result.sessionId });
       alert(`Redirecting to Stripe Checkout... (Session ID: ${result.sessionId}) - Replace with actual Stripe.js redirect`);
       // In a real app, you'd use stripe.redirectToCheckout here
    } else {
        setError(result.error || "Failed to create checkout session.");
    }
    setActionLoading(null);
 };

 const handleManageSubscription = async () => {
    if (!user || !subscription?.stripeCustomerId) {
        setError("Could not open portal. Customer ID missing.");
        return;
    }
    setActionLoading('portal');
    setError(null);

    // Call backend to create customer portal session
    const result = await createCustomerPortalSession(user.uid);

    if ('url' in result) {
        // Redirect user to the Stripe Customer Portal
        window.location.href = result.url;
    } else {
        setError(result.error || "Failed to open customer portal.");
    }
    setActionLoading(null);
 };


 if (loading) {
     return (
        <div className="space-y-6">
            <Card>
                <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
                <CardContent><Skeleton className="h-4 w-1/2" /></CardContent>
            </Card>
            <Card>
                <CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-10 w-32" />
                </CardContent>
            </Card>
        </div>
     );
 }

 if (error) {
     return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
 }

 const currentPlanKey = subscription?.plan === 'paid' ? 'paid' : 'free';
 const currentPlan = PLANS[currentPlanKey];
 const isPaidAndActive = currentPlanKey === 'paid' && subscription?.status === 'active'; // Or check other active statuses like 'trialing'

 return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Billing & Subscription</CardTitle>
          <CardDescription>Manage your SocialTrendRadar plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Current Plan</Label>
            <p className="text-xl font-semibold">{currentPlan.name}</p>
          </div>
          <div>
             <Label className="text-xs text-muted-foreground">Status</Label>
             <Badge variant={isPaidAndActive ? "default" : "secondary"} className={`capitalize ${isPaidAndActive ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : ""}`}>
               {subscription?.status || 'Inactive'}
             </Badge>
          </div>

           {isPaidAndActive ? (
              <Button onClick={handleManageSubscription} disabled={actionLoading === 'portal'}>
                 {actionLoading === 'portal' ? 'Loading Portal...' : 'Manage Subscription'}
                 <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
           ) : (
              <p className="text-sm text-muted-foreground">You are currently on the Free plan.</p>
           )}

        </CardContent>
      </Card>

      {!isPaidAndActive && (
        <Card className="border-accent">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Rocket className="text-accent" /> Upgrade to Premium</CardTitle>
                <CardDescription>{PLANS.paid.price}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <ul className="space-y-2 text-sm">
                     {PLANS.paid.features.map((feature, i) => (
                        <li key={i} className="flex items-center">
                            <CheckCircle className="h-4 w-4 mr-2 text-green-500 shrink-0" />
                            {feature}
                        </li>
                     ))}
                 </ul>
                <Button onClick={handleUpgrade} disabled={actionLoading === 'checkout'} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                    {actionLoading === 'checkout' ? 'Processing...' : 'Upgrade Now'}
                </Button>
            </CardContent>
        </Card>
      )}

       {/* Placeholder for Free Plan Card if needed */}
       {isPaidAndActive && (
            <Card>
                <CardHeader>
                    <CardTitle>{PLANS.free.name} Plan</CardTitle>
                    <CardDescription>{PLANS.free.price}</CardDescription>
                </CardHeader>
                <CardContent>
                     <ul className="space-y-2 text-sm text-muted-foreground">
                        {PLANS.free.features.map((feature, i) => (
                            <li key={i} className="flex items-center">
                                <CheckCircle className="h-4 w-4 mr-2 shrink-0" />
                                {feature}
                            </li>
                        ))}
                    </ul>
                    <p className="mt-4 text-sm text-muted-foreground">To downgrade, manage your subscription via the Stripe portal.</p>
                </CardContent>
            </Card>
        )}

    </div>
 );
}

import { Label } from '@/components/ui/label'; // Ensure Label is imported
