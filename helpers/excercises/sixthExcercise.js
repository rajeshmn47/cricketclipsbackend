const mongoose = require('mongoose');
const CricketTeam = require('../../models/cricketteam');
const connectDB = require('../../config/db');
const Player = require('../../models/players');
const Clip = require('../../models/clips');
const MatchLiveDetails = require('../../models/matchlive');
const cricketteam = require('../../models/cricketteam');
const Match = require('../../models/match');

async function viratkohlififties() {
    const clips = await Clip.find({ league: "IPL" });
    console.log(clips.filter(c => c.event.includes("WICKET")).length, "total wickets in IPL clips");
    const matchIds = Array.from(new Set(clips.map((c) => c.matchId)));
    const matches = await MatchLiveDetails.find({ matchId: { $in: matchIds } });
    let strikerates = [];
    let runs = 0;
    let balls = 0;
    for (let i = 0; i < matches.length; i++) {
        let players = [...matches[i].teamHomePlayers, ...matches[i].teamAwayPlayers]
        let virat = players.find((a) => a.playerName.toLowerCase().includes("kohli"))
        if (virat && virat.runs > 50 && virat.runs < 100) {
            //console.log(virat.runs, virat.balls, "runs")
            runs = virat.runs + runs;
            balls = virat.balls + balls;
            let sr = (virat.runs / virat.balls) * 100;
            strikerates.push({ sr: sr, status: matches[i].status })
        }
    }
    s_r = runs * 100 / balls
    let totalsr = strikerates.reduce((a, b) => a + b, 0)
    //console.log(totalsr / strikerates.length, strikerates.sort((a, b) => b.sr - a.sr), "rates")
}

async function getindianplayers(country) {
    const bowlerslist = await Clip.find({});
    const bowlernames = Array.from(new Set(bowlerslist.filter(b => !!b.bowler).map(b => b.bowler.toLowerCase())));
    const team = await CricketTeam.findOne({ teamName: { $regex: country, $options: "i" } });
    const teamId = team ? team.id : null;
    if (!teamId) {
        console.log(`Team with name ${country} not found.`);
        return;
    }
    const players = await Player.find({ country_id: teamId });
    console.log(teamId, team, "total players in db");
    console.log(players.length, "total " + country + " players in db");
    const playernames = players.map(p => p.name.toLowerCase());
    const indianbowlers = bowlernames.filter(b => b && playernames.includes(b));
    console.log(indianbowlers.length, "total " + country + " bowlers in clips");
}

async function getallrounders(country) {
    const team = await CricketTeam.findOne({ teamName: { $regex: country, $options: "i" } });
    const teamId = team ? team.id : null;
    if (!teamId) {
        console.log(`Team with name ${country} not found.`);
        return;
    }
    const players = await Player.find({ country_id: teamId });
    const allclips = await Clip.find({});
    let batters = Array.from(new Set(allclips.filter(c => !!c.batsman).map(c => c.batsman.toLowerCase())));
    let bowlers = Array.from(new Set(allclips.filter(c => !!c.bowler).map(c => c.bowler.toLowerCase())));
    let allroundersBatsman = batters.filter(b => bowlers.includes(b)).map((b) => ({ player: b, batCount: allclips.filter(c => c.batsman.toLowerCase() === b).length, count: allclips.filter(c => c.bowler.toLowerCase() === b).length })).filter((fg) => ((fg.batCount / fg.count) < 2) && ((fg.batCount / fg.count) > 0.5) && fg.count > 100);
    let allroundersBowler = bowlers.filter(b => batters.includes(b)).map((b) => ({ player: b, bowlCount: allclips.filter(c => c.bowler.toLowerCase() === b).length, count: allclips.filter(c => c.batsman.toLowerCase() === b).length })).filter((fg) => ((fg.bowlCount / fg.count) < 2) && ((fg.bowlCount / fg.count) > 0.5) && fg.count > 100);
    let all_batsmen = allroundersBatsman.map((a) => ({ ...a, ratio: Math.abs(1 - (a.batCount / a.count)) }))
    let all_bowlers = allroundersBowler.map((a) => ({ ...a, ratio: Math.abs(1 - (a.bowlCount / a.count)) }))
    let allrounders = [...all_batsmen, ...all_bowlers];
    let alltheplayers = allrounders.filter((a) => ({ ...a, ratio: a.count / a.batCount }));
    const teamPlayers = players.map(p => p.name.toLowerCase());
    const sorted = allrounders.sort((a, b) => a.ratio - b.ratio).filter((a) => teamPlayers.includes(a.player));
    const allrounderslist = teamPlayers.filter(p => batters.includes(p) && bowlers.includes(p));
    console.log(allrounderslist.length, sorted, "total " + country + " all-rounders in db");
}

async function findwhohitsmostsixes(sixes) {
    try {
        const clips = await Clip.find({ league: "IPL" })
        const players = await Player.find({});
        const playersSixMapByMatch = {};
        for (let i = 0; i < clips.length; i++) {
            if (!(clips[i].event.includes("SIX"))) continue;
            let player_match = clips[i].batsman + "_" + clips[i].matchId;
            if (!playersSixMapByMatch[player_match]) {
                playersSixMapByMatch[player_match] = 0;
            }
            playersSixMapByMatch[player_match]++;
        }
        console.log(Object.entries(playersSixMapByMatch).sort((a, b) => b[1] - a[1]));
        let teams = {};
        let clip_players = Object.keys(playersSixMapByMatch)
        console.log(clip_players.length, "total players with sixes");
        for (let i = 0; i < clip_players.length; i++) {
            let player_name = clip_players[i].split("_")[0];
            let country_id = players.find(p => p.name.toLowerCase() === player_name.toLowerCase())?.country_id || "";
            const team = await CricketTeam.findOne({ id: country_id });
            let teamName = team?.teamName || "Unknown Team";
            //console.log(player_name, country_id, teamName);
            if (!teams[teamName]) {
                teams[teamName] = {}
            }
            if (!teams[teamName].count) {
                teams[teamName].count = 0;
            }
            if (!teams[teamName].players) {
                teams[teamName].players = [];
            }
            let allsixes = playersSixMapByMatch[clip_players[i]];
            if (parseInt(allsixes) >= sixes) {
                //console.log(allsixes, "console log")
                teams[teamName].players.push({ player: player_name, sixes: allsixes })
                teams[teamName].count = (teams[teamName].count || 0) + 1;
            }
        }
        console.log(teams);
    }
    catch (err) {
        console.error(err);
    }
}

async function similarity(a, b) {
    if (a.length == b.length) {
        let matches = 0;
        for (let i = 0; i < a.length; i++) {
            if (a[i] == b[i]) {
                matches++;
            }
        }
        return matches == a.length ? 0 : matches / a.length;
    }
    return 0;
}

async function namesimilarity(all_players, clip_players) {
    all_players = all_players.map(p => p.name.toLowerCase());
    clip_players = clip_players.map(p => p.toLowerCase());
    let matchingpairs = [];
    for (let i = 0; i < clip_players.length; i++) {
        let clip_player = clip_players[i].toLowerCase();
        let best_similarity = 0;
        let best_match = null;
        for (let j = 0; j < all_players.length; j++) {
            let player = all_players[j].toLowerCase();
            if (!(player.toLowerCase().includes("chak"))) continue;
            let sim = await similarity(clip_player, player);
            if (sim > best_similarity) {
                best_similarity = sim;
                best_match = player;
                matchingpairs.push({ clip_player, best_match, best_similarity });
            }
        }
    }
    return [matchingpairs];
}

async function findhattrickfours() {
    let test_event = "SIX";
    let times = 5;
    const clips = await Clip.find({ league: "IPL", event: { $regex: test_event } });
    const matchIds = Array.from(new Set(clips.map((c) => c.matchId)));
    let hattricks = [];
    let over_balls = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]
    let overs_count = 20;
    let overs = [];
    for (let i = 0; i < overs_count; i++) {
        for (let j = 0; j < over_balls.length; j++) {
            console.log(i, j, "ij")
            let over = i + over_balls[j]
            overs.push(over)
        }
    }
    console.log(overs, "overs")
    for (let i = 0; i < matchIds.length; i++) {
        const matchClips = await Clip.find({ matchId: matchIds[i] });
        let innings1 = []
        let innings2 = []
        let inn1 = matchClips.filter((m) => m.clip.includes("_1.mp4"))
        let inn2 = matchClips.filter((m) => m.clip.includes("_2.mp4"))
        //console.log(innings1.map((op) => op.event), "x")
        for (let x = 0; x < overs.length; x++) {
            //console.log(overs[x], "innings")
            let over = inn1.find((op) => op.over == overs[x])
            //console.log(over, overs[x], "too much")
            if (!!over) {
                innings1.push(over)
            }
            else {
                innings1.push(null)
            }
        }
        //console.log(innings2, "inn2")
        for (let x = 0; x < overs.length; x++) {
            let over = inn2.find((op) => op.over == overs[x])
            if (!!over) {
                innings2.push(over)
            }
            else {
                //console.log(null, "it is null")
                innings2.push(null)
            }
        }
        //console.log(innings1.map((io) => io?.over || null), "innings1")

        let p = 0;
        let l = 0;
        for (let j = 0; j < innings1.length; j++) {
            if (innings1[j] == null) {
                l = 0;
                continue;
            }
            let event = innings1[j].event;
            let over = innings1[j].over;
            let overNum = over.split(".")[0];
            p = overNum;
            if (!(overNum == p)) {
                p = overNum;
                l = 0;
            }
            if (event.includes(test_event) && overNum == p) {
                //console.log(event, overNum, "event")
                l = l + 1
            }
            else {
                l = 0
            }
            if (l == times) {
                l = 0;
                console.log(innings1[j].batsman, event, matchIds[i], "match ids", over, j)
                hattricks.push({ matchId: matchIds[i], over: over, event: event, batsman: innings1[j].batsman })
            }
        }
        let o = 0;
        let k = 0;
        for (let j = 0; j < innings2.length; j++) {
            //console.log(j, innings2.length, "j")
            if (innings2[j] == null) {
                k = 0;
                //console.log(null, j, "it is null");
                continue;
            }
            let event = innings2[j].event;
            let over = innings2[j].over;
            let overNum = over.split(".")[0];
            let balls = [];
            for (let a = 0; a < over_balls.length; a++) {
                let ba = overNum + over_balls[a];
                balls.push(ba)
            }
            if (!(overNum == o)) {
                o = overNum;
                k = 0
            }
            if (event.includes(test_event) && overNum == o) {
                k = k + 1
                //console.log(event, "event")
            }
            else {
                k = 0
            }
            if (k == times) {
                k = 0;
                console.log(innings2[j].batsman, matchIds[i], "match ids", over, j)
                hattricks.push({ matchId: matchIds[i], over: over, event: event, batsman: innings2[j].batsman })
            }
        }
    }
    console.log(hattricks, "hattricks")
}

async function findmostrunsinanover() {
    try {
        let test_event = "SIX";
        let times = 5;
        const clips = await Clip.find({ league: "IPL" });
        const matchIds = Array.from(new Set(clips.map((c) => c.matchId)));
        console.log(matchIds.length, "length")
        let hattricks = [];
        let over_balls = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]
        let overs_count = 20;
        let overs = [];
        let match_overs = {};
        for (let i = 0; i < overs_count; i++) {
            for (let j = 0; j < over_balls.length; j++) {
                //console.log(i, j, "ij")
                let over = i + over_balls[j]
                overs.push(over)
            }
        }
        //console.log(overs, "overs")
        for (let i = 0; i < matchIds.length; i++) {
            let matchId = matchIds[i];
            match_overs[matchId] = {
                matchId: matchIds[i],
                innings1: [],
                innings2: []
            };
            const matchClips = await Clip.find({ matchId: matchIds[i] });
            console.log(matchId, "matchId")
            let innings1 = [];
            let innings2 = [];
            let inn1 = matchClips.filter((m) => m.clip.includes("_1.mp4"))
            let inn2 = matchClips.filter((m) => m.clip.includes("_2.mp4"))
            //console.log(innings1.map((op) => op.event), "x")
            for (let x = 0; x < overs.length; x++) {
                //console.log(overs[x], "innings")
                let over = inn1.find((op) => op.over == overs[x])
                //console.log(over, overs[x], "too much")
                if (!!over) {
                    innings1.push(over)
                }
                else {
                    innings1.push(null)
                }
            }
            //console.log(innings2, "inn2")
            for (let x = 0; x < overs.length; x++) {
                let over = inn2.find((op) => op.over == overs[x])
                if (!!over) {
                    innings2.push(over)
                }
                else {
                    //console.log(null, "it is null")
                    innings2.push(null)
                }
            }
            //console.log(innings1.map((io) => io?.over || null), "innings1")

            let p = 0;
            let l = 0;
            let runs = 0;
            for (let j = 0; j < innings1.length; j++) {
                if (innings1[j] == null) {
                    l = 0;
                    continue;
                }
                let event = innings1[j].event;
                let over = innings1[j].over;
                let overNum = over.split(".")[0];
                //console.log(overNum, "overnum")
                let o_r = "over" + overNum
                runs = (event.includes("FOUR") ? 4 : event.includes("SIX") ? 6 : 0) + runs;
                //console.log(match_overs, "match overs")
                if (!(overNum == p)) {
                    //console.log(matchId, overNum, p, "over num p")
                    p = overNum;
                    l = 0;
                    match_overs[matchId].innings1.push({ over: p - 1, runs: runs })
                    runs = 0;
                }
                if (event.includes(test_event) && overNum == p) {
                    //console.log(event, overNum, "event")
                    l = l + 1
                }
                else {
                    l = 0
                }
                if (l == times) {
                    l = 0;
                    //console.log(innings1[j].batsman, event, matchIds[i], "match ids", over, j)
                    hattricks.push({ matchId: matchIds[i], over: over, event: event, batsman: innings1[j].batsman })
                }
            }
            let o = 0;
            let k = 0;
            runs = 0;
            for (let j = 0; j < innings2.length; j++) {
                //console.log(j, innings2.length, "j")
                if (innings2[j] == null) {
                    k = 0;
                    //console.log(null, j, "it is null");
                    continue;
                }
                let event = innings2[j].event;
                let over = innings2[j].over;
                let overNum = over.split(".")[0];
                let balls = [];
                let o_r = "over" + overNum
                runs = (event.includes("FOUR") ? 4 : event.includes("SIX") ? 6 : 0) + runs;
                for (let a = 0; a.over_balls; a++) {
                    let ba = overNum + over_balls[a];
                    balls.push(ba)
                }
                if (!(overNum == o)) {
                    o = overNum;
                    k = 0
                    match_overs[matchId].innings2.push({ over: o - 1, runs: runs })
                    runs = 0
                }
                if (event.includes(test_event) && overNum == o) {
                    k = k + 1
                    //console.log(event, "event")
                }
                else {
                    k = 0
                }
                if (k == times) {
                    k = 0;
                    //console.log(innings2[j].batsman, matchIds[i], "match ids", over, j)
                    hattricks.push({ matchId: matchIds[i], over: over, event: event, batsman: innings2[j].batsman })
                }
            }
        }
        console.log(match_overs, "hattricks")
        let overs_list = []
        for (let key in match_overs) {
            let overs = match_overs[key].innings1;
            let matchId = match_overs[key].matchId;
            for (let i = 0; i < overs.length; i++) {
                overs_list.push({ ...overs[i], matchId: matchId, innings: 1 })
            }
            let overs2 = match_overs[key].innings2;
            for (let i = 0; i < overs2.length; i++) {
                overs_list.push({ ...overs2[i], matchId: matchId, innings: 2 })
            }
        }
        let sorted_overs = overs_list.sort((a, b) => b.runs - a.runs);
        console.log(sorted_overs.slice(0, 20), "sorted overs")
    }
    catch (e) {
        console.log(e)
    }
}

async function mostwicketsinamatch() {
    let t1 = new Date().getTime()
    const clips = await Clip.find({ season: "2025", league: "IPL" });
    const matchIds = Array.from(new Set(clips.map((c) => c.matchId)));
    console.log(matchIds.length, 'length')
    let bowlersMap = {}
    let k = 0;
    for (let matchId of matchIds) {
        //console.log(matchId, "matchId");
        k = k + 1
        console.log(k)
        let matchClips = await Clip.find({ matchId: matchId });
        let bowlers = Array.from(new Set(matchClips.map((c) => c.bowler)));
        for (let i = 0; i < bowlers.length; i++) {
            let match_bowler = matchId + "_" + bowlers[i]
            let wickets = await Clip.find({ matchId: matchId, bowler: bowlers[i], event: { $regex: "WICKET" } }).count();
            bowlersMap[match_bowler] = wickets;
        }
    }
    console.log(Object.entries(bowlersMap).sort((a, b) => b[1] - a[1]))
    let t2 = new Date().getTime()
    let difference = t2 - t1;
    console.log(difference, "t1")
}

async function findmatchingword(word, text) {
    let parts = text.split(" ");
    for (let i = 0; i < parts.length; i++) {
        if (word.length == parts[i].length) {
            let m = 0;
            for (let j = 0; j < word.length; j++) {
                if ((word[j] == parts[i][j]) || word[j] == "_") {
                    //console.log("ok")
                    m = m + 1
                    if (m == word.length) {
                        console.log(parts[i], "matched with")
                    }
                    else {
                        continue;
                    }
                }
                else {
                    //console.log(parts[i], "skipping")
                    continue;
                }
            }
        }
        else {
            continue
        }
    }
}

async function checkastart(word, letter) {
    let parts = word.split(" ");
    let letters = await starting(word);
    console.log(letters)
    let wordMap = {}
    for (let j = 0; j < letters.length; j++) {
        wordMap[letters[j]] = { count: 0, words: [] }
        for (let i = 0; i < parts.length; i++) {
            let a = parts[i].startsWith(letters[j])
            if (a) {
                console.log(parts[i])
                wordMap[letters[j]].count = (wordMap[letters[j]].count || 0) + 1
                wordMap[letters[j]].words.push(parts[i])
            }
        }
    }
    console.log(Object.values(wordMap).sort((a, b) => b.count - a.count), "word map");
}

async function starting(text) {
    let first_letters = [];
    let parts = text.split(" ");
    for (let i = 0; i < parts.length; i++) {
        let first_letter = parts[i][0]
        first_letters.push(first_letter)
    }
    let arr = Array.from(new Set(first_letters.sort((a, b) => a - b)))
    return arr;
}

async function repeatedword(word) {
    let parts = word.split(" ");
    let wordMap = {}
    for (let i = 0; i < parts.length; i++) {
        wordMap[parts[i]] = (wordMap[parts[i]] || 0) + 1
    }
    console.log(Object.entries(wordMap).sort((a, b) => b[1] - a[1]))
}

async function repeatedincommentary(event) {
    const clips = await Clip.find({ league: "IPL", event: event });
    let wordMap = {}
    for (let i = 0; i < clips.length; i++) {
        let parts = clips[i].commentary.split(" ");
        for (let j = 0; j < parts.length; j++) {
            let part = parts[j].toLowerCase();
            wordMap[part] = (wordMap[part] || 0) + 1
        }
    }
    return wordMap;
}

async function uniquewords(eve) {
    let uniqueMap = {}
    let six_words = await repeatedincommentary("SIX");
    //console.log(six_words, "six words")
    let four_words = await repeatedincommentary("FOUR");
    let wicket_words = await repeatedincommentary("WICKET")
    if (eve == "SIXES") {
        let unique = Object.entries(six_words).filter((s) => (!(Object.entries(four_words).find((sa) => sa[0] == s[0]))))
        //console.log(unique, "unique")
        unique = unique.filter((s) => (!Object.entries(wicket_words).find((sa) => sa[0] == s[0])))
        console.log(unique, Array.from(new Set(unique)).length, "unique length")
        for (let i = 0; i < unique.length; i++) {
            u = unique[i][0]
            uniqueMap[u] = unique[i][1]
        }
        //console.log(uniqueMap)
        console.log(Object.entries(uniqueMap).sort((a, b) => b[1] - a[1]).slice(0, 200));
    }
    if (eve == "WICKETS") {
        let unique = Object.entries(wicket_words).filter((s) => (!(Object.entries(four_words).find((sa) => sa[0] == s[0]))))
        //console.log(unique, "unique")
        unique = unique.filter((s) => (!Object.entries(six_words).find((sa) => sa[0] == s[0])))
        console.log(unique, Array.from(new Set(unique)).length, "unique length")
        for (let i = 0; i < unique.length; i++) {
            u = unique[i][0]
            uniqueMap[u] = unique[i][1]
        }
        //console.log(uniqueMap)
        console.log(Object.entries(uniqueMap).sort((a, b) => b[1] - a[1]).slice(0, 200));
    }
}

async function findplayersmissingcountry() {
    const clips = await Clip.find({ league: "" });
    //const clips = await Clip.updateMany({ bowler: "Jasprit  Bumrah" }, { $set: { bowler: "Jasprit Bumrah" } });
    //return ""
    const players = Array.from(new Set([...clips.map((a) => a.batsman), ...clips.map((a) => a.bowler)]))
    const all_players = await Player.find({});
    //let matchingpairs = await namesimilarity(all_players, players)
    //console.log(matchingpairs[0].sort((a, b) => b.best_similarity - a.best_similarity).slice(0, 20));
    //return;
    const missing = players.filter((p) => !(all_players.find((a) => a.name.toLowerCase() == p.toLowerCase())))
    //console.log(players.length, missing)
    let all_missed = [];
    let missingMap = {};
    for (let i = 0; i < missing.length; i++) {
        let player_name = missing[i];
        //console.log(player_name, "checking for this player");
        let missed = await Clip.find({ $or: [{ batsman: player_name }, { bowler: player_name }] })
        //let missed = await Clip.find({ bowler: player_name })
        //console.log(player_name, missed.length);
        all_missed.push(...missed);
        missingMap[player_name] = missed.length;
    }

    console.log(all_missed.length);
    console.log(Object.entries(missingMap).sort((a, b) => b[1] - a[1]));
}

function convertnumberstoword(number) {
    let length = number.toString().length;
    let word = ""
    for (let i = 0; i < length; i++) {
        if (i = 3) {
            word = word + "thousand"
        }
        if (i = 2) {
            word = word + "hundred"
        }
    }
    console.log(word, "word");
    return word;
}

async function upcoming(batsman) {
    await connectDB();
    let player = await Player.find({ name: batsman });
    console.log(player[0].teamIds, "team ids");
    let ids = player[0].teamIds.map((p) => parseInt(p))
    let team_country = await cricketteam.find({ id: ids });
    console.log(team_country?.[0].teamName);
    let country = team_country?.[0].teamName;
    let date_next = new Date().getTime() + (120 * 24 * 60 * 60 * 1000);
    const matches = await Match.find({ format: "odi", date: { $gt: new Date(), $lt: new Date(date_next) }, $or: [{ teamHomeName: country }, { teamAwayName: country }] })
    console.log(matches.map((m) => ({ date: m.date, teamHomeName: m.teamHomeName })))
    process.exit();
}

upcoming("rohit sharma");