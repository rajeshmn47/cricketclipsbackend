const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const Match = require("../../models/match");
const { default: mongoose } = require("mongoose");

mongoose
    .connect("mongodb://127.0.0.1:27017/test", {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log("Connected to DB"))
    .catch((err) => console.error("DB error:", err));

const Clip = require("../../models/clips");
const MatchLiveDetails = require("../../models/matchlive");
const Player = require("../../models/players");
const cricketSynonyms = require('./../../utils/cricket_synonyms.json');
const exclusionMap = require('./../../utils/exclusion_map.json');

async function shotTypeConnections() {
    try {
        console.log("Fetching clips...");

        const clips = await Clip.find({
            //"flag.isFlagged": true,
            "labels.shotType": { $exists: true, $ne: "" },
            "labels.direction": { $exists: true, $ne: "" },
            "labels.length": { $exists: true, $ne: "" }
        }).lean().limit(4000);

        console.log(`Found ${clips.length} valid clips.\n`);
        if (clips.length === 0) {
            console.log("No clips with all three fields. Check your data.");
            return;
        }

        // Structure: Map { shotType -> { direction: Map(direction->count), length: Map(length->count), total: number } }
        const stats = new Map();

        for (const clip of clips) {
            const shot = clip.labels.shotType;
            const dir = clip.labels.direction;
            const len = clip.labels.lengthType;

            if (!stats.has(shot)) {
                stats.set(shot, {
                    direction: new Map(),
                    length: new Map(),
                    total: 0
                });
            }
            const entry = stats.get(shot);
            entry.total++;

            // Count direction
            const dirCount = entry.direction.get(dir) || 0;
            entry.direction.set(dir, dirCount + 1);

            // Count length
            //console.log(entry.length.entries(), Object.entries(entry.length), "sorted");
            const sorted = [...entry.direction.entries()].sort((a, b) => b[1] - a[1])
            const lenCount = entry.length.get(len) || 0;
            entry.length.set(len, lenCount + 1);
            entry.clips = entry.clips || {};
            //console.log(sorted, "sorted");
            if (lenCount < 5 && sorted?.[0]?.[1] > 25) {
                //console.log(sorted, "sorted");
                entry.clips.ball_length = entry.clips.ball_length || []
                entry.clips.ball_length.push(clip.commentary)
            }
            const dir_sorted = [...entry.direction.entries()].sort((a, b) => b[1] - a[1])
            if (dirCount < 5 && sorted?.[0]?.[1] > 25) {
                entry.clips.direction = entry.clips.direction || []
                entry.clips.direction.push(clip.commentary)
            }
        }

        // Print results
        let list = {}
        for (const [shot, data] of stats.entries()) {
            console.log(`\n========== ${shot} (total: ${data.total}) ==========`);

            console.log("  Directions:");
            const sortedDirs = [...data.direction.entries()].sort((a, b) => b[1] - a[1]);
            for (const [dir, count] of sortedDirs) {
                const percent = (count / data.total * 100).toFixed(1);
                console.log(`    ${dir}: ${count} (${percent}%)`);
                if (count < 3) {
                    if (!list[shot]) {
                        list[shot] = []
                    }
                    list[shot].push(dir);
                }
            }

            console.log("  Lengths:");
            const sortedLens = [...data.length.entries()].sort((a, b) => b[1] - a[1]);
            console.log(sortedLens.reduce((a, b) => a + b[1], 0), "sorted lens");
            for (const [len, count] of sortedLens) {
                let totalCount = sortedLens.reduce((a, b) => a + b[1], 0);
                const percent = (count / data.total * 100).toFixed(1);
                console.log(`    ${len}: ${count} (${percent}%)`);
                if (count < 3 && totalCount > 100) {
                    if (!list[shot]) {
                        list[shot] = []
                    }
                    list[shot].push(len);
                }
            }
            if (data.clips?.ball_length?.length > 0) {
                const lenclips = [...data.clips?.ball_length];
                //console.log(lenclips, "clips")
            }
            if (data.clips?.direction?.length > 0) {
                const dirclips = [...data.clips?.direction];
                //console.log(dirclips, "clips")
            }
        }
        console.log(list, "list");
        fs.writeFileSync(path.join(__dirname,"./shotslikelyunlikely.json"),JSON.stringify(list));
        process.exit();
    } catch (err) {
        console.error("Error:", err);
        process.exit();
    }
}

shotTypeConnections();