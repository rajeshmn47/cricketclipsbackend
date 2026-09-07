const mongoose = require('mongoose');
const Clip = require('../../models/clips');      // adjust path if needed
const Series = require("../../models/series");
const Player = require('../../models/players');  // adjust path if needed
const connectDB = require('../../config/db');    // adjust path if needed

// 🔧 Corrections mapping (wrong name → correct name)
const corrections = {
    // Pant variants → Rishabh Pant
    "pant": "Rishabh Pant",
    "r pant": "Rishabh Pant",
    "pranav pant": "Rishabh Pant",

    // Rayudu
    "madhav rayudu": "Ambati Rayudu",

    // Kohli
    "aryaveer kohli": "Virat Kohli",

    // Tripathi
    "rahul tripthi": "Rahul Tripathi",
    "rahul tripathi": "Rahul Tripathi",

    // Samson
    "samson sola": "Sanju Samson",

    // Dubey
    "praveen dubey": "Praveen Dubey",

    // Rohit Sharma / Yuvraj Singh
    "rohit yadav": "Rohit Sharma",
    "sahab yuvraj": "Yuvraj Singh",
    "tishant dabla": "Ishan Kishan",
    "prithvi raj": "prithvi Shaw",
    "karthik raman": "Dinesh Karthik",
    "rahul chaudhary": "KL Rahul",
    "manish sehrawat": "Manish Pandey",
    "hardik sharma": "Hardik Pandya",
    "jitesh singh": "Jitesh Sharma",
    "Nadeem Khan": "Shahbaz Nadeem",
    "pranshu vijayran": "Vijay Shankar",
    "aadi agarwal": "Mayank agarwal",
    "sarfaraz ahmed": "sarfaraz khan",
    "deepak khatri": "deepak hooda"
};

// Escape regex special characters in the "wrong" name
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let runsMap = { "SIX": 6, "FOUR": 4 }

async function renamePlayers() {
    try {
        await connectDB();
        let count = 0;
        // Find all wicket clips
        let batsmen = {}
        const clipse = await Clip.find({
            missingClip: true,
            //batting_team: "RCB"
            //league: "IPL",
            //season: "2025",
            //clip: ""
        });
        let matchIds = Array.from(new Set(clipse.map((c) => c.matchId)))
        let seriesIds = Array.from(new Set(clipse.map((c) => c.series)))
        console.log(matchIds.length, seriesIds.length, "match and series length")
        function findteam(batsman, matchCl) {
            //console.log(batsman, matchClips, "batsman")
            let team = matchCl.find((c) => c.batsman == batsman && c?.batting_team?.length > 0)
            //console.log(team?.batting_team, "team")
            return team?.batting_team || ""
        }
        for (let seriesId of seriesIds) {
            continue;
            //console.log(seriesId, "seriesId")
            let seriesClips = await Clip.find({ series: seriesId })
            let batsmen = Array.from(new Set(seriesClips.map((c) => c.batsman)))
            //console.log(matchClips.length, "length")
            for (let i = 0; i < batsmen.length; i++) {
                let batsman = batsmen[i];
                let team = findteam(batsman, seriesClips)
                //console.log(team, "yetthakkand")
                let wrongClips = await Clip.find({ series: seriesId, batsman: batsman, clip: "", batting_team: { $ne: team } })
                for (let j = 0; j < wrongClips.length; j++) {
                    let clip = wrongClips[j];
                    //if (team == "RCB") {
                    //console.log(clip.batting_team, team, clip.batsman, "wrong clip")
                    await Clip.updateOne({ _id: clip._id }, { $set: { batting_team: team } })
                    //}
                }
            }
        }
        //console.log(count, "count")
        for (let i = 0; i < clipse.length; i++) {
            continue
            let batsman = clipse[i].batsman;
            let team = clipse[i].batting_team;
            if (!batsmen[batsman]) {
                batsmen[batsman] = {};
            }
            if (!(batsmen[batsman][team])) {
                batsmen[batsman][team] = 1
            }
            else {
                batsmen[batsman][team] = (batsmen[batsman][team] || 0) + 1
            }
        }
        let t = await Clip.find({ batting_team: undefined, clip: "" }).count()
        let ucount = 0;
        console.log(Array.from(new Set((clipse.filter((c) => c.batting_team == undefined).map((k) => k.batsman)))).length, "batsman length")
        for (let seriesId of seriesIds) {
            let seriesClips = await Clip.find({ series: seriesId });
            let batsmens = Array.from(new Set((seriesClips.filter((c) => c.batting_team == undefined).map((k) => k.batsman))));
            console.log(seriesId, batsmens.length, "series and batsman length")
            for (let i = 0; i < batsmens.length; i++) {
                let batsman = batsmens[i]
                let wrongClips = await Clip.find({ series: seriesId, batsman: batsman, batting_team: undefined })
                if (wrongClips.length == 0) {
                    continue;
                }
                let ids= wrongClips.map((c) => c._id)
                //console.log(ids, "ids")
                let team = findteam(batsman, seriesClips)
                await Clip.updateMany({ _id: { $in: ids } }, { $set: { batting_team: team } })
                //console.log(batsman, "batsman")
                //console.log(game, batsman, clipse[i].batting_team)
                //console.log(wrongClips?.length, batsman, team, "length")
                //let seriesClips = await Clip.find({ series: seriesId })
                //console.log(wrongClips.length, batsman, team, "wrong clips length")
                if (!team) {
                    console.log(team, batsman, seriesId, ucount, "team")
                    {/*
                    let s = await Series.findOne({ _id: seriesId })
                    let a = await Clip.find({ series: seriesId })
                    let b = await Clip.find({ series: seriesId, batting_team: { $ne: undefined } })
                    let c = await Clip.find({ series: seriesId, clip: "" })
                    console.log(s.name, a.length, c.length, b?.[0].batting_team, "name")
                    */}
                    ucount++
                }
            }
        }
        console.log(ucount, t, "ucount")
        let batters = Object.entries(batsmen).sort((b, a) => a[1] - b[1])
        console.log(batters, "batters")
        process.exit()
        return ""

        const clips = await Clip.find({
            //league: "IPL",
            //batsman: "Virat Kohli",
            //clip: "",
            //missingClip: false,
            event: "DROPPED",
            "labels.droppedBy": "travis head",
            //event: { $regex: /^(wicket)$/i },
            //commentary: { $regex: /^(head)$/i }
        });
        console.log(clips.length, "length")
        let clipsa = clips.map((c) => c.commentary)
        console.log(clipsa, "clips")
        let words_beside = []
        for (let i = 0; i < clips.length; i++) {
            let commentary = clips[i].commentary;
            let droppedBy = clips[i].labels.droppedBy;
            let parts = commentary.split(" ");
            for (let j = 0; j < parts.length; j++) {
                if (parts[j].toLowerCase() == droppedBy || parts[j].toLowerCase() == droppedBy) {
                    words_beside.push(parts[j - 2], parts[j - 1], parts[j + 1], parts[j + 2])
                }
            }
        }
        console.log(words_beside.filter((c) => !!c), "words beside")
        //console.log(Array.from(new Set(clipsa)).length, clipsa)
        return ""
        console.log(`${clips.length} wicket clips found`);

        // Count wickets per batsman_matchId
        const wicketsPerPlayerMatch = {};
        for (const clip of clips) {
            const key = `${clip.batsman}_${clip.matchId}`;
            wicketsPerPlayerMatch[key] = (wicketsPerPlayerMatch[key] || 0) + 1;
        }

        // Sort by wicket count descending
        const sorted = Object.entries(wicketsPerPlayerMatch).sort((a, b) => b[1] - a[1]);
        console.log("Top batsman_matchId entries:", sorted.slice(0, 10));

        // Group by matchId – only include batsmen with >1 wicket in that match
        const matchMap = new Map(); // key = matchId, value = array of { batsman, count }
        for (const [key, count] of sorted) {
            if (count <= 1) continue; // skip single dismissals
            const [batsman, matchId] = key.split('_');
            if (!matchMap.has(matchId)) {
                matchMap.set(matchId, []);
            }
            matchMap.get(matchId).push({ batsman, count });
        }

        // Convert to the desired array format
        const result = Array.from(matchMap, ([matchId, batsmen]) => ({
            matchId,
            batsmen
        }));

        console.log("\nUnique matches with batsmen dismissed more than once:");
        //console.log(result, "length");
        console.log(JSON.stringify(result, null, 2), result.length, result.reduce((c, b) => c + b.batsmen.reduce((x, y) => x + y.count, 0), 0), result.reduce((c, b) => c + b.batsmen.reduce((x, y) => x + 1, 0), 0));


        // Additional useful logs (from original script)
        const overClips = clips.filter(c => c.event?.toLowerCase().includes("over")).length;
        console.log(`Clips containing "over" in event: ${overClips}`);
        const totalBoundaryRuns = clips.reduce((sum, c) => sum + (runsMap[c.event] || 0), 0);
        console.log(`Total runs from SIX/FOUR in wicket clips: ${totalBoundaryRuns}`);

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

renamePlayers();