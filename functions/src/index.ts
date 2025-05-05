
/**
 * @fileoverview Firebase Cloud Functions for SocialTrendRadar.
 * Includes a scheduled function to generate and distribute weekly AI forecasts.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getFirestore, FieldValue, Timestamp, CollectionReference } from 'firebase-admin/firestore';
// Removed scraping service imports
import { generateNicheForecast, type GenerateNicheForecastInput, type GenerateNicheForecastOutput } from '../../src/ai/flows/generate-forecast'; // Adjust path as needed
// Placeholder for email sending service
// import { sendWeeklyForecastEmail } from './emailService';

// Initialize Firebase Admin SDK (Ensure it runs only once)
if (admin.apps.length === 0) {
  admin.initializeApp();
  console.log('Firebase Admin SDK initialized.');
} else {
    console.log('Firebase Admin SDK already initialized.');
}

const db = getFirestore();

// Define possible niches (fetch from central config/db in future)
const ALL_NICHES = [
    "Fashion", "Beauty", "Fitness", "Food", "Travel", "Tech", "Gaming", "Finance", "Education", "DIY", "Comedy", "Dance", "Music", "Art", "Pets", "Parenting", "Lifestyle", "Business"
]; // This list should be the source of truth for generation

// --- Helper Functions ---

/**
 * Fetches all unique niches selected by active users.
 * Could be optimized by querying only users who need notifications.
 */
async function getActiveNiches(): Promise<string[]> {
    console.log("Fetching active niches from user profiles...");
    const usersCollection = db.collection('users');
    // Query active users (e.g., active subscription or recently active) - simplified for now
    const q = query(usersCollection); // Consider adding filters like where('subscription.status', '==', 'active')

    try {
        const querySnapshot = await getDocs(q);
        const niches = new Set<string>();
        querySnapshot.forEach(doc => {
            const data = doc.data();
            if (data.selectedNiches && Array.isArray(data.selectedNiches)) {
                data.selectedNiches.forEach((niche: string) => niches.add(niche));
            } else if (data.primaryNiche) {
                niches.add(data.primaryNiche);
            }
        });
         const uniqueNiches = Array.from(niches);
         console.log(`Found ${uniqueNiches.length} unique active niches: ${uniqueNiches.join(', ')}`);
         // Fallback or ensure core niches are always generated if none found?
         // For now, return what's found. Could merge with ALL_NICHES if needed.
         return uniqueNiches.length > 0 ? uniqueNiches : ALL_NICHES; // Generate for all if no users have selected any? Or just log?
    } catch (error) {
        console.error("Error fetching active niches:", error);
        // Fallback to default list on error? Or throw?
        console.warn("Falling back to default niche list due to error.");
        return ALL_NICHES;
    }
}


/**
 * Saves a generated forecast document to Firestore.
 * Uses a document ID like 'NicheName_YYYY-WW' for easy lookup.
 */
async function saveForecastToFirestore(forecast: GenerateNicheForecastOutput): Promise<void> {
    const weekStartDate = new Date(forecast.weekStartDate);
    const year = weekStartDate.getFullYear();
    // Calculate ISO week number (more reliable than simple division)
    const startOfYear = new Date(year, 0, 1);
    const days = Math.floor((weekStartDate.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    const docId = `${forecast.niche}_${year}-${String(weekNumber).padStart(2, '0')}`;

    const forecastsCollection = db.collection('forecasts');
    const docRef = forecastsCollection.doc(docId);

    try {
        await docRef.set({
            ...forecast,
            // Convert date strings back to Firestore Timestamps for proper querying
            weekStartDate: Timestamp.fromDate(new Date(forecast.weekStartDate)),
            generatedAt: Timestamp.fromDate(new Date(forecast.generatedAt)),
        }, { merge: true }); // Use merge to update if run again for the same week
        console.log(`Successfully saved forecast for ${forecast.niche} (Week ${year}-${weekNumber}) with ID: ${docId}`);
    } catch (error) {
        console.error(`Failed to save forecast for ${forecast.niche} (ID: ${docId}):`, error);
        // Consider retry logic or logging to monitoring service
    }
}

/**
 * Fetches users subscribed to a specific niche and triggers email sending.
 */
async function distributeForecastNotifications(niche: string, forecast: GenerateNicheForecastOutput): Promise<void> {
    console.log(`Distributing notifications for niche: ${niche}`);
    const usersCollection = db.collection('users');

    // Query users who have selected this niche AND have email notifications enabled
    const q = query(usersCollection,
        where('selectedNiches', 'array-contains', niche),
        where('notifications.emailWeeklyForecast', '==', true) // Check the correct notification setting
        // Optionally add where('subscription.status', '==', 'active') if needed
    );

    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            console.log(`No users subscribed to email notifications for niche: ${niche}`);
            return;
        }

        const emailPromises: Promise<any>[] = [];
        querySnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.email) {
                console.log(`Queueing email for ${userData.email} for niche ${niche}`);
                // TODO: Integrate with actual email service (SendGrid, Resend, etc.)
                // emailPromises.push(sendWeeklyForecastEmail(userData.email, niche, forecast));
            } else {
                 console.warn(`User ${doc.id} subscribed to ${niche} but has no email address.`);
            }
             // TODO: Handle Slack notifications for paid users
             // if (userData.subscription?.plan === 'paid' && userData.notifications?.slackEnabled && userData.notifications?.slackWebhookUrl) {
             //    console.log(`Queueing Slack notification for user ${doc.id} for niche ${niche}`);
             //    // queueSlackNotification(userData.notifications.slackWebhookUrl, niche, forecast);
             // }
        });

        // Wait for all emails for this niche to be processed (or queued)
        // await Promise.allSettled(emailPromises); // Use allSettled to handle individual failures
        console.log(`Finished queuing ${querySnapshot.size} notifications for niche: ${niche}`);

    } catch (error) {
        console.error(`Error fetching users or queueing notifications for niche ${niche}:`, error);
    }
}


// --- Scheduled Function ---
// Schedule: Run once a week, e.g., Sunday evening or early Monday morning.
// Example: 'every monday 05:00' (adjust timezone in Cloud Scheduler if needed)
export const weeklyForecastGenerator = functions.runWith({ timeoutSeconds: 540, memory: '1GB' }) // Increased timeout/memory for AI calls
    .pubsub.schedule('every monday 05:00').timeZone('America/Los_Angeles') // Example schedule
    .onRun(async (context) => {
    console.log(`Weekly forecast generation triggered. Event ID: ${context.eventId}, Timestamp: ${context.timestamp}`);

    // Check for necessary API keys (AI provider key)
    // This relies on ai-instance checking process.env
    const aiConfigured = ai.plugins.length > 0; // Basic check if any AI plugin loaded
    if (!aiConfigured) {
        console.error('CRITICAL: No AI provider configured (check environment variables like GOOGLE_GENAI_API_KEY/OPENAI_API_KEY). Aborting forecast generation.');
        return null; // Exit early
    } else {
        console.log('AI provider appears configured.');
    }
     // Check for email sending key (if applicable)
     if (!process.env.SENDGRID_API_KEY) { // Replace with your email service env var
         console.warn('Email service API key (e.g., SENDGRID_API_KEY) is not set. Weekly emails will not be sent.');
     }


    try {
        // 1. Determine which niches to generate forecasts for
        console.log('Step 1: Determining active niches...');
        const nichesToGenerate = await getActiveNiches();
        if (nichesToGenerate.length === 0) {
            console.log("Step 1 Result: No active niches found or configured. Exiting.");
            return null;
        }
        console.log(`Step 1 Result: Will generate forecasts for ${nichesToGenerate.length} niches: ${nichesToGenerate.join(', ')}`);

        // 2. Generate Forecast for each niche
        console.log(`Step 2: Generating forecasts...`);
        let generatedForecasts: { [niche: string]: GenerateNicheForecastOutput } = {};
        let generationSuccessCount = 0;
        let generationFailCount = 0;

        // Process niches sequentially or in parallel (consider rate limits)
        for (const niche of nichesToGenerate) {
            try {
                console.log(`Generating forecast for niche: ${niche}...`);
                const input: GenerateNicheForecastInput = {
                    niche: niche,
                    // historicalData: await fetchHistoricalDataForNiche(niche), // TODO: Implement data fetching
                };
                const forecast = await generateNicheForecast(input);
                generatedForecasts[niche] = forecast;
                generationSuccessCount++;
                // Optional delay between AI calls
                // await new Promise(resolve => setTimeout(resolve, 500));
            } catch (aiError: any) {
                generationFailCount++;
                console.error(`Failed to generate forecast for niche "${niche}":`, aiError.message || aiError);
            }
        }
        console.log(`Step 2 Result: Successfully generated ${generationSuccessCount} forecasts. Failed for ${generationFailCount} niches.`);

        // 3. Save Generated Forecasts to Firestore
        console.log(`Step 3: Saving ${generationSuccessCount} generated forecasts to Firestore...`);
        const savePromises = Object.values(generatedForecasts).map(forecast => saveForecastToFirestore(forecast));
        await Promise.allSettled(savePromises); // Wait for all saves, log individual errors if needed
        console.log(`Step 3 Result: Finished attempting to save forecasts.`);


        // 4. Distribute Notifications (Email/Slack)
        console.log(`Step 4: Distributing notifications for ${generationSuccessCount} forecasts...`);
        if (!process.env.SENDGRID_API_KEY) { // Check again before distributing
            console.warn("Skipping notification distribution as email service key is missing.");
        } else {
             const distributionPromises = Object.entries(generatedForecasts).map(([niche, forecast]) =>
                 distributeForecastNotifications(niche, forecast)
             );
             await Promise.allSettled(distributionPromises); // Wait for distribution attempts
             console.log(`Step 4 Result: Finished attempting to distribute notifications.`);
        }


        // 5. Optional: Cleanup old forecasts (e.g., older than X weeks)
        // console.log("Step 5: Cleaning up old forecasts...");
        // await cleanupOldForecasts(90); // Example: cleanup forecasts older than 90 days
        // console.log("Step 5 Result: Cleanup finished.");


        console.log('Weekly forecast generation completed successfully.');
        return null; // Indicate success

    } catch (error: any) {
        console.error('CRITICAL ERROR in weekly forecast generation function:', error.message || error, error.stack);
        // Optional: Log to error reporting service
        return null; // Indicate failure
    }
});

// --- Helper function stubs (Implement these) ---

// async function fetchHistoricalDataForNiche(niche: string): Promise<any> {
//    console.log(`TODO: Implement fetching historical data for niche: ${niche}`);
//    // Fetch relevant data from Firestore, external APIs, etc.
//    // Process/summarize it for the AI prompt.
//    return { summary: `Recent activity summary for ${niche}` };
// }

// async function cleanupOldForecasts(daysToKeep: number): Promise<void> {
//     console.log(`TODO: Implement cleanup of forecasts older than ${daysToKeep} days.`);
//     const cutoffDate = new Date();
//     cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
//     const cutoffTimestamp = Timestamp.fromDate(cutoffDate);
//     const oldForecastsQuery = db.collection('forecasts').where('weekStartDate', '<', cutoffTimestamp).limit(400); // Batch delete limit
//     // ... implement batch deletion logic ...
// }

// --- Add imports from firebase-admin/firestore used ---
import { query, where, orderBy, limit, getDocs } from 'firebase-admin/firestore';
