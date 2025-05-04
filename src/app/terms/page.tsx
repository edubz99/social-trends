
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 md:py-20">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Terms of Service</CardTitle>
          <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
        </CardHeader>
        <CardContent className="prose prose-sm sm:prose lg:prose-lg dark:prose-invert max-w-none space-y-4">
          <p>Welcome to SocialTrendRadar!</p>

          <p>
            These terms and conditions outline the rules and regulations for the use of
            SocialTrendRadar's Website, located at [Your Website URL].
          </p>

          <p>
            By accessing this website we assume you accept these terms and conditions. Do not continue
            to use SocialTrendRadar if you do not agree to take all of the terms and conditions
            stated on this page.
          </p>

          <h2>License</h2>
          <p>
            Unless otherwise stated, SocialTrendRadar and/or its licensors own the intellectual
            property rights for all material on SocialTrendRadar. All intellectual property rights
            are reserved. You may access this from SocialTrendRadar for your own personal use
            subjected to restrictions set in these terms and conditions.
          </p>
          <p>You must not:</p>
          <ul>
            <li>Republish material from SocialTrendRadar</li>
            <li>Sell, rent or sub-license material from SocialTrendRadar</li>
            <li>Reproduce, duplicate or copy material from SocialTrendRadar</li>
            <li>Redistribute content from SocialTrendRadar</li>
          </ul>

          <h2>User Accounts</h2>
           <p>
             When you create an account with us, you must provide us information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
           </p>
           <p>
             You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password, whether your password is with our Service or a third-party service.
           </p>


          <h2>Subscription and Payment</h2>
           <p>
             Some parts of the Service are billed on a subscription basis ("Subscription(s)"). You will be billed in advance on a recurring and periodic basis ("Billing Cycle"). Billing cycles are set either on a monthly or annual basis, depending on the type of subscription plan you select when purchasing a Subscription.
           </p>
           <p>
             A valid payment method, including credit card, is required to process the payment for your Subscription. You shall provide SocialTrendRadar with accurate and complete billing information including full name, address, state, zip code, telephone number, and a valid payment method information. By submitting such payment information, you automatically authorize SocialTrendRadar to charge all Subscription fees incurred through your account to any such payment instruments.
           </p>


          <h2>Disclaimer</h2>
          <p>
            To the maximum extent permitted by applicable law, we exclude all representations,
            warranties and conditions relating to our website and the use of this website. Nothing
            in this disclaimer will:
          </p>
          <ul>
            <li>limit or exclude our or your liability for death or personal injury;</li>
            <li>limit or exclude our or your liability for fraud or fraudulent misrepresentation;</li>
            <li>limit any of our or your liabilities in any way that is not permitted under applicable law; or</li>
            <li>exclude any of our or your liabilities that may not be excluded under applicable law.</li>
          </ul>
          <p>
            The limitations and prohibitions of liability set in this Section and elsewhere in this
            disclaimer: (a) are subject to the preceding paragraph; and (b) govern all liabilities
            arising under the disclaimer, including liabilities arising in contract, in tort and for
            breach of statutory duty.
          </p>
           <p>
             As long as the website and the information and services on the website are provided free of charge, we will not be liable for any loss or damage of any nature.
           </p>

           <h2>Governing Law</h2>
           <p>
            These Terms shall be governed and construed in accordance with the laws of [Your Jurisdiction, e.g., State of California], without regard to its conflict of law provisions.
           </p>


           <h2>Changes to Terms</h2>
           <p>
            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material we will try to provide at least 30 days notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
           </p>

           <h2>Contact Us</h2>
            <p>If you have any questions about these Terms, please contact us at [Your Contact Email].</p>

            <p className="mt-8"><Link href="/" className="text-accent hover:underline">← Back to Home</Link></p>
        </CardContent>
      </Card>
    </div>
  );
}
