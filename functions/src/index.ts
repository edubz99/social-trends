
/**
 * @fileoverview Firebase Cloud Functions for SocialTrendRadar.
 * Includes a scheduled function to fetch, categorize, and store social media trends.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getTikTokTrends, type TikTokTrend } from '../../src/services/tiktok';
import { getInstagramReelTrends, type InstagramReelTrend } from '../../src/services/instagram';
import { getYoutubeTrends, type YoutubeTrend } from '../../src/services/youtube';
import { categorizeTrend, type CategorizeTrendInput, type CategorizeTrendOutput } from '../../src/ai/flows/categorize-trend'; // Adjust relative path
import { subDays } from 'date-fns';

// Initialize Firebase Admin SDK
// Ensure the Firebase project is initialized ONLY ONCE.
if (admin.apps.length === 0) {
  admin.initializeApp();
  console.log('Firebase Admin SDK initialized.');
} else {
    console.log('Firebase Admin SDK already initialized.');
}

const db = getFirestore();

// Define possible niches (consider fetching from a central config later)
const ALL_NICHES = [
    "Fashion", "Beauty", "Fitness", "Food", "Travel", "Tech", "Gaming", "Finance", "Education", "DIY", "Comedy", "Dance", "Music", "Art", "Pets", "Parenting", "Lifestyle", "Business"
];

// --- Unified Trend Interface (used internally in function) ---
interface ProcessedTrend {
    id: string; // URL used as ID
    title: string;
    platform: 'TikTok' | 'Instagram' | 'YouTube';
    views?: number;
    likes?: number;
    url: string;
    description?: string; // Optional description from source
    discoveredAt: Date;
    category?: string; // AI Assigned
    categoryConfidence?: number; // AI Confidence
    processedAt: FieldValue; // Firestore server timestamp
}

// --- Trend Fetching Logic ---
/**
 * Fetches trends from all supported platforms.
 * Note: Currently uses mock data from service files. Replace with actual scraping/API calls.
 */
async function fetchAllTrends(): Promise<Omit<ProcessedTrend, 'category' | 'categoryConfidence' | 'processedAt'>[]> {
    console.log("Starting trend fetching from all platforms...");
    let combinedTrends: Omit<ProcessedTrend, 'category' | 'categoryConfidence' | 'processedAt'>[] = [];
    const now = new Date();

    try {
        // Use Promise.allSettled to handle potential errors from individual fetches
        const results = await Promise.allSettled([
            getTikTokTrends(),
            getInstagramReelTrends(),
            getYoutubeTrends(),
        ]);

        // Process TikTok
        if (results[0].status === 'fulfilled' && results[0].value.length > 0) {
            const tiktokTrends = results[0].value.map((trend: TikTokTrend) => ({
                id: trend.url, title: trend.title, platform: 'TikTok' as const, views: trend.views, url: trend.url, discoveredAt: now,
            }));
            combinedTrends = combinedTrends.concat(tiktokTrends);
            console.log(`Successfully fetched ${tiktokTrends.length} TikTok trends.`);
        } else if (results[0].status === 'fulfilled') {
            console.log("Fetched 0 TikTok trends.");
        } else {
            console.error("Failed to fetch TikTok trends:", results[0].reason);
        }

        // Process Instagram
        if (results[1].status === 'fulfilled' && results[1].value.length > 0) {
            const instagramTrends = results[1].value.map((trend: InstagramReelTrend) => ({
                id: trend.url, title: trend.title, platform: 'Instagram' as const, likes: trend.likes, url: trend.url, discoveredAt: now,
            }));
            combinedTrends = combinedTrends.concat(instagramTrends);
             console.log(`Successfully fetched ${instagramTrends.length} Instagram trends.`);
        } else if (results[1].status === 'fulfilled') {
            console.log("Fetched 0 Instagram trends.");
        } else {
            console.error("Failed to fetch Instagram trends:", results[1].reason);
        }

        // Process YouTube
        if (results[2].status === 'fulfilled' && results[2].value.length > 0) {
            const youtubeTrends = results[2].value.map((trend: YoutubeTrend) => ({
                id: trend.url, title: trend.title, platform: 'YouTube' as const, views: trend.views, url: trend.url, discoveredAt: now,
            }));
            combinedTrends = combinedTrends.concat(youtubeTrends);
             console.log(`Successfully fetched ${youtubeTrends.length} YouTube trends.`);
        } else if (results[2].status === 'fulfilled') {
            console.log("Fetched 0 YouTube trends.");
        } else {
            console.error("Failed to fetch YouTube trends:", results[2].reason);
        }

    } catch (error) {
        console.error("Unexpected error during combined trend fetching:", error);
        // Depending on requirements, might throw or return partial results.
    }
    console.log(`Total trends fetched before categorization: ${combinedTrends.length}`);
    return combinedTrends;
}


// --- Scheduled Function ---
// Schedule: Run every 24 hours. Consider adjusting timezone if needed.
// Memory/Timeout: Adjust based on expected workload. Default might be insufficient for many trends + AI calls.
export const dailyTrendProcessor = functions.runWith({timeoutSeconds: 300, memory: '1GB'})
    .pubsub.schedule('every 24 hours').onRun(async (context) => {
    console.log(`Daily trend processing function triggered. Event ID: ${context.eventId}, Timestamp: ${context.timestamp}`);

    // Check for necessary API keys *before* starting heavy processing
    // GOOGLE_GENAI_API_KEY should be set in Cloud Function environment variables
    if (!process.env.GOOGLE_GENAI_API_KEY) {
        console.error('CRITICAL: GOOGLE_GENAI_API_KEY environment variable is not set. Trend categorization will fail. Aborting function.');
        // Optional: Log to error reporting service
        return null; // Exit early
    } else {
        console.log('GOOGLE_GENAI_API_KEY found.');
    }


    try {
        // 1. Fetch Trends
        console.log('Step 1: Fetching trends...');
        const fetchedTrends = await fetchAllTrends();
        if (fetchedTrends.length === 0) {
            console.log("Step 1 Result: No trends fetched. Exiting function.");
            return null;
        }
        console.log(`Step 1 Result: Fetched ${fetchedTrends.length} raw trends.`);

        // 2. Categorize Trends using Genkit Flow
        console.log(`Step 2: Attempting to categorize ${fetchedTrends.length} trends...`);
        const categorizedTrends: ProcessedTrend[] = [];
        let categorizationSuccessCount = 0;
        let categorizationFailCount = 0;

        for (const trend of fetchedTrends) {
            try {
                const input: CategorizeTrendInput = {
                    trendTitle: trend.title,
                    // trendDescription: trend.description, // Add if description is reliably fetched
                    niches: ALL_NICHES,
                };

                // Call the Genkit flow defined in categorize-trend.ts
                const result: CategorizeTrendOutput = await categorizeTrend(input);

                categorizedTrends.push({
                    ...trend,
                    category: result.category || 'Uncategorized', // Ensure category is not null/undefined
                    categoryConfidence: result.confidence ?? 0, // Ensure confidence is not null/undefined
                    processedAt: FieldValue.serverTimestamp(), // Set Firestore timestamp here
                });
                categorizationSuccessCount++;
                // console.log(`Categorized "${trend.title}" as ${result.category} (Confidence: ${result.confidence})`);
            } catch (aiError: any) {
                categorizationFailCount++;
                console.error(`Failed to categorize trend "${trend.title}" (URL: ${trend.url}):`, aiError.message || aiError);
                // Store trend without category or skip it - storing as 'Uncategorized'
                 categorizedTrends.push({
                     ...trend,
                     category: 'Uncategorized', // Mark as uncategorized
                     categoryConfidence: 0,
                     processedAt: FieldValue.serverTimestamp(),
                 });
            }
             // Optional Delay: Add a small delay between AI calls if hitting rate limits.
             // await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
        }
         console.log(`Step 2 Result: Successfully categorized ${categorizationSuccessCount} trends. Failed to categorize ${categorizationFailCount} trends (marked as Uncategorized). Total processed: ${categorizedTrends.length}`);


        // 3. Store Processed Trends in Firestore
        console.log(`Step 3: Storing ${categorizedTrends.length} processed trends in Firestore...`);
        const trendsCollection = db.collection('trends');
        let batch = db.batch();
        let batchCounter = 0;
        let firestoreWriteSuccessCount = 0;
        let firestoreWriteFailCount = 0;

        for (const trend of categorizedTrends) {
            // Sanitize URL to create a Firestore-compatible document ID
            // Replace common invalid characters like /, ., $, [, ], #
            const docId = trend.id.replace(/[.#$[\]/]/g, '_');
            const docRef = trendsCollection.doc(docId);

            // Use set with merge:true to update existing or create new
            // This prevents duplicates if the same trend URL is fetched again
            batch.set(docRef, {
                ...trend,
                 // Ensure Timestamps are handled correctly by Firestore
                 discoveredAt: Timestamp.fromDate(trend.discoveredAt), // Convert JS Date back to Timestamp
                 processedAt: FieldValue.serverTimestamp(), // Use server timestamp for consistency
            }, { merge: true });
            batchCounter++;

            // Firestore batch limit is 500 operations. Commit frequently to avoid large failures.
            if (batchCounter >= 490) {
                try {
                    await batch.commit();
                    console.log(`Committed batch of ${batchCounter} trends.`);
                    firestoreWriteSuccessCount += batchCounter;
                    batch = db.batch(); // Re-initialize batch
                    batchCounter = 0;
                } catch (batchError: any) {
                     console.error(`Firestore batch commit failed: ${batchError.message || batchError}. Losing ${batchCounter} trends in this batch.`);
                     firestoreWriteFailCount += batchCounter;
                     // Reset batch and counter even on failure to potentially continue with next batch
                     batch = db.batch();
                     batchCounter = 0;
                     // Optional: Implement retry logic here for failed batches
                }
            }
        }

        // Commit any remaining items in the last batch
        if (batchCounter > 0) {
            try {
                await batch.commit();
                console.log(`Committed final batch of ${batchCounter} trends.`);
                firestoreWriteSuccessCount += batchCounter;
            } catch(batchError: any) {
                console.error(`Firestore final batch commit failed: ${batchError.message || batchError}. Losing ${batchCounter} trends.`);
                firestoreWriteFailCount += batchCounter;
            }
        }

        console.log(`Step 3 Result: Successfully wrote ${firestoreWriteSuccessCount} trends to Firestore. Failed to write ${firestoreWriteFailCount} trends.`);

        // 4. Optional: Clean up old trends
        console.log("Step 4: Cleaning up old trends (older than 30 days)...");
        const cleanupCutoffDays = 30;
        const cleanupCutoffTimestamp = Timestamp.fromDate(subDays(new Date(), cleanupCutoffDays));
        const oldTrendsQuery = trendsCollection.where('processedAt', '<', cleanupCutoffTimestamp).limit(490); // Limit batch delete size

        let deletedCount = 0;
        try {
            const oldTrendsSnapshot = await oldTrendsQuery.get();

            if (!oldTrendsSnapshot.empty) {
                 const deleteBatch = db.batch();
                 oldTrendsSnapshot.docs.forEach(doc => deleteBatch.delete(doc.ref));
                 await deleteBatch.commit();
                 deletedCount = oldTrendsSnapshot.size;
                 console.log(`Deleted ${deletedCount} old trends.`);
                 // Note: If more than 490 old trends exist, this will only delete a portion.
                 // Consider running cleanup more frequently or implementing pagination for deletion if needed.
            } else {
                console.log("No old trends found matching the cleanup criteria.");
            }
        } catch (cleanupError: any) {
             console.error(`Error during old trend cleanup: ${cleanupError.message || cleanupError}`);
        }
        console.log(`Step 4 Result: Deleted ${deletedCount} old trends.`);


        console.log('Daily trend processing completed successfully.');
        return null; // Indicate success to Cloud Functions

    } catch (error: any) {
        console.error('CRITICAL ERROR in daily trend processing function:', error.message || error);
        // Log the entire error stack if available
        if (error.stack) {
            console.error(error.stack);
        }
        // Optional: Log to error reporting service
        // Consider throwing the error if you have retry policies configured in Cloud Functions,
        // but be cautious of infinite retries. Returning null prevents automatic retries by default.
        return null; // Indicate failure, but don't necessarily throw.
    }
});

// --- Potentially add other functions here (e.g., user alert generation) ---

// Helper function to get environment variables with checks
function getEnv(key: string, required = true): string {
    const value = process.env[key];
    if (!value && required) {
        console.error(`CRITICAL: Required environment variable ${key} is not set.`);
        // Throwing here might stop the function deployment/execution depending on context
        // throw new Error(`Missing required environment variable: ${key}`);
    }
    if (!value && !required) {
        console.warn(`Optional environment variable ${key} is not set.`);
        return '';
    }
    return value || '';
}

// Example of using the helper
// const apiKey = getEnv('GOOGLE_GENAI_API_KEY');
// const optionalSetting = getEnv('OPTIONAL_CONFIG', false);
