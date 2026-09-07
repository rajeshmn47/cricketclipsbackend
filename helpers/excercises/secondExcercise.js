const { google } = require("googleapis");
const Match = require("../../models/match");
const partnership = require("../../models/partnership");
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
    let allpartnerships = [];
    try {
        const teams = await Clip.distinct("batting_team");
        //console.log(teams, teams.length, "teams")
        const matches = await Match.find({ date: { $gte: new Date('2018-01-01') }, teamHomeCode: { $in: teams } })
        let matchIds = [...new Set(matches.map((m) => m.matchId))];
        //console.log(matchIds, "length")
        let matcheslive = await MatchLiveDetails.find({ result: "Complete", matchId: { $in: matchIds }, status: undefined })
        console.log(matcheslive.length, "length")
        let matchliveids = [...new Set(matcheslive.map((m) => m.matchId))];
        console.log(matchliveids.length, "ids")
        for (let i = 0; i < matcheslive.length; i++) {
            //console.log(matcheslive[i]?.status)
            const match = await Match.findOne({ matchId: matcheslive[i].matchId })
            //console.log(match?.date, "status")
        }
    } catch (err) {
        console.error("Error:", err);
    }
}

//shotTypeConnections();

async function findplayersmissinghands() {
    await Clip.updateMany({ bowler: "Marnus Labuschagne" }, { $set: { bowlingHand: "right", bowlerType: "spin" } })
    const clips = await Clip.find({ bowlingHand: "", league: "IPL" });
    console.log(clips.length, "clips")
    batMap = {}
    let batsmans = clips.map((c) => c.bowler)
    for (let i = 0; i < batsmans.length; i++) {
        batMap[batsmans[i]] = (batMap[batsmans[i]] || 0) + 1
    }
    console.log(Object.entries(batMap).sort((b, a) => a[1] - b[1]))
    //console.log(batMap, "batsmans")
}

findplayersmissinghands()

const fs = require('fs').promises;   // <--- fixed import
const path = require('path');

async function countZeroByteFilesRecursive(folderPath) {
    let zeroCount = 0;
    const zeroFiles = [];

    async function scan(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await scan(fullPath);
            } else if (entry.isFile()) {
                const stat = await fs.stat(fullPath);
                if (stat.size === 0) {
                    zeroCount++;
                    zeroFiles.push(fullPath);
                }
            }
        }
    }

    await scan(folderPath);
    console.log(`Total zero‑byte files: ${zeroCount}`);
    if (zeroCount) console.log(zeroFiles);
    return { zeroCount, zeroFiles };
}

//countZeroByteFilesRecursive("D:/cricketvideos/allclips")