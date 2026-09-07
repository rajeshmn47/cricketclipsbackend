const Clip = require("../../models/clips");
const connectDB = require("../../config/db");
const Task = require("../../models/task");
const fs = require("fs");
const Match = require("../../models/match");
const MatchLiveDetails = require("../../models/matchlive");

async function findhalf() {
    try {
        await connectDB();
        const matches = await Match.find({ date: { $gt: new Date(new Date().getTime() - 13 * 24 * 60 * 60 * 1000), $lt: new Date() } }).sort({ date: 1 }).limit(10);
        const matchIds = matches.map(match => match.matchId);
        console.log(matchIds)
        for (let matchId of matchIds) {
            const matchlive = await MatchLiveDetails.findOne({ matchId: matchId });
            if (matchlive) {
                if ((!(matchlive?.teamHomePlayers?.length)) > 0 && (!(matchlive?.teamAwayPlayers?.length > 0))) {
                    console.log(matchlive.matchId, matchlive.inPlayStatus)
                }
            }
        }
        process.exit(0);
    }
    catch (err) {
        console.error(err);
        process.exit(0);
    }
}

findhalf();