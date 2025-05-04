
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
        const results = await Promise.allSettled([
            getTikTokTrends(),
            getInstagramReelTrends(),
            getYoutubeTrends(),
        ]);

        // Process TikTok
        if (results[0].status === 'fulfilled') {
            const tiktokTrends = results[0].value.map((trend: TikTokTrend) => ({
                id: trend.url, title: trend.title, platform: 'TikTok' as const, views: trend.views, url: trend.url, discoveredAt: now,
            }));
            combinedTrends = combinedTrends.concat(tiktokTrends);
            console.log(`Fetched ${tiktokTrends.length} TikTok trends.`);
        } else {
            console.error("Failed to fetch TikTok trends:", results[0].reason);
        }

        // Process Instagram
        if (results[1].status === 'fulfilled') {
            const instagramTrends = results[1].value.map((trend: InstagramReelTrend) => ({
                id: trend.url, title: trend.title, platform: 'Instagram' as const, likes: trend.likes, url: trend.url, discoveredAt: now,
            }));
            combinedTrends = combinedTrends.concat(instagramTrends);
             console.log(`Fetched ${instagramTrends.length} Instagram trends.`);
        } else {
            console.error("Failed to fetch Instagram trends:", results[1].reason);
        }

        // Process YouTube
        if (results[2].status === 'fulfilled') {
            const youtubeTrends = results[2].value.map((trend: YoutubeTrend) => ({
                id: trend.url, title: trend.title, platform: 'YouTube' as const, views: trend.views, url: trend.url, discoveredAt: now,
            }));
            combinedTrends = combinedTrends.concat(youtubeTrends);
             console.log(`Fetched ${youtubeTrends.length} YouTube trends.`);
        } else {
            console.error("Failed to fetch YouTube trends:", results[2].reason);
        }

    } catch (error) {
        console.error("Error during combined trend fetching:", error);
        // Depending on requirements, might throw or return partial results.
    }
    console.log(`Total trends fetched before categorization: ${combinedTrends.length}`);
    return combinedTrends;
}


// --- Scheduled Function ---
export const dailyTrendProcessor = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
    console.log('Daily trend processing function triggered.');

    try {
        // 1. Fetch Trends
        const fetchedTrends = await fetchAllTrends();
        if (fetchedTrends.length === 0) {
            console.log("No trends fetched. Exiting function.");
            return null;
        }

        // 2. Categorize Trends using Genkit Flow
        console.log(`Attempting to categorize ${fetchedTrends.length} trends...`);
        const categorizedTrends: ProcessedTrend[] = [];
        for (const trend of fetchedTrends) {
            try {
                const input: CategorizeTrendInput = {
                    trendTitle: trend.title,
                    // trendDescription: trend.description, // Add if description is fetched
                    niches: ALL_NICHES,
                };
                // Ensure GOOGLE_GENAI_API_KEY is set in function environment variables
                const result: CategorizeTrendOutput = await categorizeTrend(input);

                categorizedTrends.push({
                    ...trend,
                    category: result.category,
                    categoryConfidence: result.confidence,
                    processedAt: FieldValue.serverTimestamp(),
                });
                console.log(`Categorized "${trend.title}" as ${result.category} (Confidence: ${result.confidence})`);
            } catch (aiError) {
                console.error(`Failed to categorize trend "${trend.title}":`, aiError);
                // Optionally store trend without category or skip it
                 categorizedTrends.push({
                     ...trend,
                     category: 'Uncategorized', // Mark as uncategorized
                     categoryConfidence: 0,
                     processedAt: FieldValue.serverTimestamp(),
                 });
            }
             // Add a small delay to avoid hitting potential API rate limits
            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
        }
         console.log(`Successfully processed ${categorizedTrends.length} trends.`);


        // 3. Store Processed Trends in Firestore
        console.log("Storing processed trends in Firestore...");
        const trendsCollection = db.collection('trends');
        const batch = db.batch();
        let batchCounter = 0;

        categorizedTrends.forEach(trend => {
            const docRef = trendsCollection.doc(trend.id.replace(/[^a-zA-Z0-9]/g, '_')); // Sanitize ID for Firestore
            // Use set with merge:true to update existing or create new
            batch.set(docRef, trend, { merge: true });
            batchCounter++;
            // Firestore batch limit is 500 operations
            if (batchCounter >= 490) {
                // Commit the batch and start a new one
                batch.commit().then(() => console.log(`Committed batch of ${batchCounter} trends.`)).catch(err => console.error('Batch commit failed:', err));
                batch = db.batch(); // Re-initialize batch
                batchCounter = 0;
            }
        });

        // Commit any remaining items in the last batch
        if (batchCounter > 0) {
            await batch.commit();
             console.log(`Committed final batch of ${batchCounter} trends.`);
        }

        console.log("Successfully stored all processed trends.");

        // 4. Optional: Clean up old trends
        console.log("Cleaning up old trends...");
        const cleanupCutoff = subDays(new Date(), 30); // Delete trends older than 30 days
        const oldTrendsQuery = trendsCollection.where('processedAt', '<', cleanupCutoff);
        const oldTrendsSnapshot = await oldTrendsQuery.get();

        if (!oldTrendsSnapshot.empty) {
             const deleteBatch = db.batch();
             oldTrendsSnapshot.docs.forEach(doc => deleteBatch.delete(doc.ref));
             await deleteBatch.commit();
             console.log(`Deleted ${oldTrendsSnapshot.size} old trends.`);
        } else {
            console.log("No old trends found to delete.");
        }


        console.log('Daily trend processing completed successfully.');
        return null;

    } catch (error) {
        console.error('Error in daily trend processing function:', error);
        // Depending on the error, you might want to retry or alert.
        return null; // Indicate failure, but don't necessarily throw to prevent infinite retries unless configured.
    }
});

// --- Potentially add other functions here (e.g., user alert generation) ---

