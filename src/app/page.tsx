
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Zap, Filter } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-background to-secondary/50">
      <header className="container mx-auto px-4 py-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-primary">SocialTrendRadar</h1>
        <nav>
          <Link href="/auth/login">
            <Button variant="ghost" className="mr-2">Login</Button>
          </Link>
          <Link href="/auth/signup">
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">Sign Up</Button>
          </Link>
        </nav>
      </header>

      <main className="flex-grow container mx-auto px-4 py-16 text-center flex flex-col items-center justify-center">
        <h2 className="text-4xl md:text-5xl font-extrabold mb-4 text-foreground tracking-tight">
          Never Miss a Viral Trend Again
        </h2>
        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl">
          SocialTrendRadar uses AI to find emerging trends in your niche, delivering daily alerts so you can create viral content faster.
        </p>
        <Link href="/auth/signup">
          <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground text-lg px-8 py-6">
            Get Started for Free
            <TrendingUp className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      </main>

      <section className="bg-background py-16">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto bg-accent/10 p-3 rounded-full w-fit mb-2">
                <TrendingUp className="h-8 w-8 text-accent" />
              </div>
              <CardTitle>Catch Trends Early</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Our AI scans TikTok, Reels, and YouTube Shorts to identify viral potential before it peaks.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto bg-accent/10 p-3 rounded-full w-fit mb-2">
                <Filter className="h-8 w-8 text-accent" />
              </div>
              <CardTitle>Niche Specific Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Select your niche and receive relevant trends tailored specifically for your audience.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto bg-accent/10 p-3 rounded-full w-fit mb-2">
                <Zap className="h-8 w-8 text-accent" />
              </div>
              <CardTitle>Act Fast</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Get daily email summaries (or real-time alerts for paid users) to stay ahead of the curve.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="text-center py-6 text-muted-foreground text-sm">
        © {new Date().getFullYear()} SocialTrendRadar. All rights reserved.
      </footer>
    </div>
  );
}

