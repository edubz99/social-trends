
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { TrendingUp, Zap, Filter, CheckCircle, BrainCircuit, Clock } from 'lucide-react'; // Updated icons
import Image from 'next/image';


const FEATURES = [
 {
    icon: BrainCircuit, // Changed icon
    title: "AI Trend Forecasting",
    description: "Our AI analyzes historical social media data to predict emerging trends and content formats for the upcoming week.", // Updated description
  },
  {
    icon: Filter,
    title: "Niche-Specific Insights",
    description: "Receive forecasts tailored to your specific content niche, ensuring relevance and actionable ideas.", // Updated description
  },
   {
    icon: Clock, // Changed icon
    title: "Weekly Forecasts",
    description: "Get reliable trend predictions delivered every Monday via email (Free & Premium) or Slack (Premium).", // Updated description
  },
   {
    icon: Zap, // Keep Zap for "actionable"
    title: "Actionable Content Ideas",
    description: "Forecasts include concrete suggestions for content formats and styles, helping you create timely content.", // Updated description
  },
];

const PLANS = {
  free: {
    name: "Free",
    price: "$0",
    frequency: "/month",
    description: "Get started with essential trend forecasting.",
    features: ["Select 1 Niche", "Weekly Forecast Email"], // Updated features
    cta: "Sign Up for Free",
    href: "/auth/signup",
    highlight: false,
  },
  premium: {
    name: "Premium",
    price: "$9.99",
    frequency: "/month",
    description: "Unlock the full power of predictive trend analysis.",
    features: [
        "Select Multiple Niches", // Updated features
        "Weekly Email & Slack Alerts",
        "Save Favorite Forecasts",
        "Access Forecast History",
        "Priority Support",
    ],
    cta: "Go Premium",
    href: "/auth/signup", // Link to signup, can redirect to billing if logged in
    highlight: true,
  },
};


export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-background to-secondary/50">
      {/* Header */}
      <header className="container mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
         <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-accent">
                {/* Re-using the old logo SVG */}
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-8c0-1.1.9-2 2-2h2v6H9v-4H7v4c0 1.1-.9 2-2 2s-2-.9-2-2v-4c0-1.1.9-2 2-2s2 .9 2 2v1zm10 0c0-1.1.9-2 2-2s2 .9 2 2v4c0 1.1-.9 2-2 2s-2-.9-2-2v-4h-2v4h2c1.1 0 2-.9 2-2v-1c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v4h-2v-6h4v-1z"/>
             </svg>
             <span>SocialTrendRadar</span>
         </Link>
        <nav className="flex gap-2">
          <Link href="/auth/login">
            <Button variant="ghost">Login</Button>
          </Link>
          <Link href="/auth/signup">
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">Sign Up</Button>
          </Link>
        </nav>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
          <div className="container px-4 md:px-6 text-center">
            <div className="max-w-3xl mx-auto space-y-4">
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                Predict the Next Wave.
              </h1>
              <p className="text-lg text-muted-foreground md:text-xl lg:text-2xl">
                SocialTrendRadar uses AI to analyze historical data and forecast emerging social media trends for <span className="text-accent font-semibold">your niche</span>. Get weekly predictions, create content that resonates.
              </p>
              <Link href="/auth/signup">
                <Button size="lg" className="mt-4 bg-accent hover:bg-accent/90 text-accent-foreground text-lg px-8 py-6">
                  Get Weekly Forecasts
                  <TrendingUp className="ml-2 h-5 w-5" />
                </Button>
              </Link>
               <p className="text-sm text-muted-foreground mt-2">Start free. No credit card required.</p>
            </div>
              {/* Optional: Placeholder for an image/graphic */}
             <div className="mt-12 flex justify-center">
                 <Image
                    src="https://picsum.photos/800/400?random=1" // Replace with a relevant placeholder or final image
                    alt="AI analysis graphic or abstract dashboard"
                    width={800}
                    height={400}
                    className="rounded-lg shadow-xl border"
                    data-ai-hint="ai data analysis social media forecast" // Updated hint
                 />
             </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-background">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How SocialTrendRadar Helps You</h2>
              <p className="mt-2 text-lg text-muted-foreground">Stay ahead with AI-powered insights.</p>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature) => (
                <Card key={feature.title} className="text-center shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="mx-auto bg-accent/10 p-3 rounded-full w-fit mb-3">
                      <feature.icon className="h-8 w-8 text-accent" />
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="w-full py-12 md:py-24 lg:py-32 bg-secondary/50">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Simple Pricing for Creators</h2>
              <p className="mt-2 text-lg text-muted-foreground">Choose the plan that fits your growth needs.</p>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 max-w-4xl mx-auto">
                {Object.values(PLANS).map((plan) => (
                    <Card key={plan.name} className={`flex flex-col ${plan.highlight ? 'border-accent shadow-lg' : 'shadow-sm'}`}>
                        <CardHeader className="text-center">
                            <CardTitle className="text-2xl">{plan.name}</CardTitle>
                            <CardDescription>{plan.description}</CardDescription>
                            <div className="mt-4">
                                <span className="text-4xl font-bold">{plan.price}</span>
                                <span className="text-muted-foreground">{plan.frequency}</span>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-grow">
                            <ul className="space-y-3">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-center gap-2">
                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                        <span className="text-muted-foreground">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                        <CardFooter>
                             <Link href={plan.href} className="w-full">
                                <Button className={`w-full ${plan.highlight ? 'bg-accent hover:bg-accent/90 text-accent-foreground' : ''}`} variant={plan.highlight ? 'default' : 'outline'}>
                                    {plan.cta}
                                </Button>
                             </Link>
                        </CardFooter>
                    </Card>
                ))}
            </div>
             <p className="text-center text-muted-foreground mt-8">Need more? Contact us for enterprise solutions.</p>
          </div>
        </section>

        {/* Optional: Add FAQ or Testimonial sections here */}

      </main>

      {/* Footer */}
      <footer className="py-8 border-t bg-background">
        <div className="container px-4 md:px-6 flex flex-col md:flex-row justify-between items-center text-center md:text-left">
           <div className="flex items-center gap-2 mb-4 md:mb-0">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-accent">
                  {/* Re-using the old logo SVG */}
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-8c0-1.1.9-2 2-2h2v6H9v-4H7v4c0 1.1-.9 2-2 2s-2-.9-2-2v-4c0-1.1.9-2 2-2s2 .9 2 2v1zm10 0c0-1.1.9-2 2-2s2 .9 2 2v4c0 1.1-.9 2-2 2s-2-.9-2-2v-4h-2v4h2c1.1 0 2-.9 2-2v-1c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v4h-2v-6h4v-1z"/>
               </svg>
               <span className="font-semibold">SocialTrendRadar</span>
           </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} SocialTrendRadar. All rights reserved.
          </p>
           <div className="flex gap-4 mt-4 md:mt-0">
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-accent">Terms</Link>
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-accent">Privacy</Link>
           </div>
        </div>
      </footer>
    </div>
  );
}
