const Task = require("../models/task");
const Match = require("../models/match");
const MatchLive = require("../models/matchlive");
const fs = require("fs");
const path = require("path");

// Load ignore teams from JSON (once)
let ignoreTeamsSet = null;
function loadIgnoreTeams() {
    if (!ignoreTeamsSet) {
        const filePath = path.join(__dirname, "../config/ignoreTeams.json");
        if (fs.existsSync(filePath)) {
            const teams = JSON.parse(fs.readFileSync(filePath, "utf8"));
            ignoreTeamsSet = new Set(teams);
        } else {
            ignoreTeamsSet = new Set();
            console.warn("⚠️ No ignoreTeams.json found – no teams will be ignored.");
        }
    }
    return ignoreTeamsSet;
}

async function generatePendingTasks() {
    try {
        const startDate = new Date("2025-12-20T00:00:00Z");
        const ignoreTeams = loadIgnoreTeams();
        console.log(`Ignoring ${ignoreTeams.size} teams (from pre‑generated list).`);

        const liveMatches = await MatchLive.find({
            result: "Complete",
            date: { $gte: startDate }
        });

        let created = 0;
        let skipped = 0;

        for (const liveMatch of liveMatches) {
            const match = await Match.findOne({ matchId: liveMatch.matchId });
            if (!match) {
                console.warn(`⚠️ No Match document for ${liveMatch.matchId}, skipping`);
                skipped++;
                continue;
            }

            const homeTeam = match.teamHomeName?.toLowerCase();
            const awayTeam = match.teamAwayName?.toLowerCase();

            if ((homeTeam && ignoreTeams.has(homeTeam)) || (awayTeam && ignoreTeams.has(awayTeam))) {
                console.log(`⏭️ Skipping ${liveMatch.matchId} – team in ignore list`);
                skipped++;
                continue;
            }

            const existingTask = await Task.findOne({ matchId: liveMatch.matchId });
            if (!existingTask) {
                await Task.create({
                    matchId: liveMatch.matchId,
                    status: "created",
                    format: match.format,
                    year: match.date.getFullYear(),
                    teamHomeName: match.teamHomeName,
                    createdAt: new Date(),
                });
                created++;
            }
        }
        console.log(`✅ Generated ${created} tasks (skipped ${skipped}).`);
    } catch (err) {
        console.error("❌ Error:", err);
    }
}

if (require.main === module) {
    generatePendingTasks().then(() => process.exit());
}

module.exports = { generatePendingTasks };