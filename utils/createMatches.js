const fs = require("fs");
const path = require("path");
const Task = require("../models/task");
const Match = require("../models/match");
const Series = require("../models/series");
const MatchLiveDetails = require("../models/matchlive");

async function createMatchesList() {
    try {
        console.log('tasky')
        const tasks = await Task.find({ status: { $ne: "finished" } });
        console.log(tasks,'matches generating')
        if (!tasks.length) {
            console.log("❌ No tasks found");
            return;
        }

        const matches = [];
        for (const t of tasks) {
            const match = await Match.findOne({ matchId: t.matchId });
            const matchlive = await MatchLiveDetails.findOne({ matchId: t.matchId });
            let seriesName = "";
            let code = match.teamHomeCode+match.teamAwayCode
            if (match && match.seriesId) {
                const series = await Series.findOne({ seriesId: match.seriesId });
                seriesName = series?.name || "";
            }
            matches.push({
                video_path: `./${t.matchId}.mp4`,
                filename: `${t.matchId}`,
                matchid: t.matchId,
                video_path_cut: `./${t.matchId}.mp4`,
                format: t.format,
                type: match.type,
                year: String(t.year),
                homeTeam: t.teamHomeName || "",
                series: seriesName,
                code: code,
                notes: matchlive?.status?.toLowerCase() || ""
            });
        }

        const pythonContent =
            `matches = ${JSON.stringify(matches, null, 2)}
`;

        const outputPath = path.join(__dirname, "./../../../pythonocr/cricket_ocr/matches_list_temporary.py");

        fs.writeFileSync(outputPath, pythonContent);

        console.log("✅ matches_list_temporary.py generated successfully");
        console.log("📁 Path:", outputPath);

    } catch (err) {
        console.error("❌ Error generating matches list:", err);
    }
}

module.exports = { createMatchesList}
