const Task = require("../models/task");
const Match = require("../models/match");
const MatchLive = require("../models/matchlive");

/**
 * This script finds matches that are completed (status: "Complete") in MatchLive,
 * from Dec 1, 2025 onwards, and creates a pending task for them if one does not exist.
 */
async function generatePendingTasks() {
    try {
        const dec1 = new Date("2025-12-20T00:00:00Z");
        // Find all completed matches in MatchLive from Dec 1, 2025
        const liveMatches = await MatchLive.find({
            result: "Complete",
            date: { $gte: dec1 }
        });

        let created = 0;

        for (const liveMatch of liveMatches) {
            const match = await Match.findOne({ matchId: liveMatch.matchId });
            // Check if a pending task already exists for this match
            const existingTask = await Task.findOne({ matchId: liveMatch.matchId });
            if (!existingTask) {
                await Task.create({
                    matchId: liveMatch.matchId,
                    status: "created",
                    format: match.format,
                    year: match.date.getFullYear(),
                    teamHomeName: match.teamHomeName,
                    createdAt: new Date(),
                    // Add other fields as needed
                });
                created++;
            }
        }

        console.log(`✅ Generated ${created} pending tasks for completed matches from Dec 1, 2025.`);
    } catch (err) {
        console.error("❌ Error generating pending tasks:", err);
    }
}

// Run if executed directly
if (require.main === module) {
    generatePendingTasks().then(() => process.exit());
}

module.exports = { generatePendingTasks };