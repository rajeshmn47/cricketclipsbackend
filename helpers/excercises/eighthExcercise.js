const mongoose = require('mongoose');
const CricketTeam = require('../../models/cricketteam');
const connectDB = require('../../config/db');
const Player = require('../../models/players');
const Clip = require('../../models/clips');
const MatchLiveDetails = require('../../models/matchlive');

async function findplayerswitha() {
    let letters = []
    let amap = {}
    const clips = await Clip.find({ league: "IPL" });
    const players = Array.from(new Set([...clips.map((c) => c.batsman.toLowerCase()), ...clips.map((c) => c.bowler.toLowerCase())]))
    console.log(players.length, "length")
    letters = Array.from(new Set(players.map((p) => p[0])));
    //console.log(letters, "letters")
    for (let player of players) {
        //console.log(players[0], "player");
        let letter = player[0]
        if (!amap[letter]) {
            amap[letter] = { count: 0, words: [] }
        }
        amap[letter].count = (amap[letter].count || 0) + 1
        amap[letter].words.push(player)
    }
    //console.log(Object.entries(amap).sort((a, b) => b[1].count - a[1].count), "amap");
    console.log(amap, "amap");
}

async function fixTeams() {
    await connectDB();
    let text = `We need to analyze the provided code.The user wrote an async function findmostrunsinanover but the name suggests finding most runs in an over, yet inside it seems to be counting consecutive events(like SIX) to find "hattricks" of sixes ? Actually, the code tries to count consecutive occurrences of a test_event(default "SIX") and when it reaches times(default 5) it pushes a hat - trick entry.However, there are many bugs.The user likely wants feedback or correction.The instruction just shows the code, no explicit question.But the context: previous exercises, and now they wrote this function. Probably they want a review or help to fix it.As an AI, I should explain what's wrong and how to improve, focusing on finding most runs in an over. The function name is misleading; they probably want to find the over with highest runs. I'll provide a corrected version and point out issues.lWhich direction would you like to go ? Or feel free to just ask a specific question about the content`
    await findplayerswitha();
    process.exit(0);
}

fixTeams().catch(err => {
    console.error(err);
    process.exit(1);
});