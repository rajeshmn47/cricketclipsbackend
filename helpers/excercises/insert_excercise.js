const mongoose = require('mongoose');
const Clip = require('../../models/clips');
const CricketTeam = require('../../models/cricketteam');
const connectDB = require('../../config/db');
const fs = require("fs");
const { default: axios } = require('axios');
const Match = require('../../models/match');
const Player = require('../../models/players');
const MatchLiveDetails = require('../../models/matchlive');
const Series = require('../../models/series');

async function insert_clips() {
    await connectDB();
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyaWQiOiI2OTMxOGVlZWU1ZjY0NzgzMDAxMzUwYzgiLCJpYXQiOjE3ODgxODgwNjQsImV4cCI6MTc4ODE5MTA2NH0.EomZArFwDdhU15ZClt1wfBVQM6NhBa13cVT7U-dCOXQ";
    const clips = await Clip.find({ batsman: "Virat Kohli", event: "WICKET", bowling_team: "CSK", missingClip: false, batting_team: { $ne: "" } }).lean();
    await axios.post("https://cricketclipsbackend.onrender.com/clips/bulk-insert", clips, {
        headers: {
            Authorization: `Bearer ${token}`,
            Servertoken: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyaWQiOiI2YTllMWNlNTBmNTQ5YzJmZDE5YTI3OTkiLCJpYXQiOjE3ODg3NDY5OTksImV4cCI6MTc4ODc0OTk5OX0.LbQtzBcTKSQe03zChfPkOCRDAVtMEVRv1cLXg6Pn_O0`
        }
    }
    );
}

async function insert_todb() {
    await connectDB();
    //await Clip.deleteMany({});
    for (let i = 1; i < 16; i++) {
        const { data } = await axios.get(`http://localhost:5000/clips/all_clips?search=&page=${i}&limit=5000`);
        await Clip.insertMany(data.clips);
    }
    console.log("Inserted clips to DB");
    process.exit();
}

async function test_repeat() {
    await connectDB();
    const clips = await Clip.find({}).lean();
    const uniqueClips = new Set();
    const duplicateClips = [];
    for (let clip of clips) {
        const one_clip = clip.clip;
        if (uniqueClips.has(one_clip)) {
            duplicateClips.push(one_clip);
        } else {
            uniqueClips.add(one_clip);
        }
    }
    console.log(uniqueClips.size, "unique clips");
    console.log(duplicateClips, "duplicate clips");
    process.exit();
}

function groupOvers(overs) {
    const sortedOvers = overs.sort((a, b) => a - b);
    const groupedOvers = [];
    let groups = {};
    for (let i = 0; i < sortedOvers.length; i++) {
        let over = sortedOvers[i].split(".")[0];
        if (!groups[over]) {
            groups[over] = [sortedOvers[i]];
        }
        else {
            groups[over].push(sortedOvers[i]);
        }
    }
    return groups
}

async function over_numbers() {
    await connectDB();
    const clips = await Clip.find({ format: { $ne: "test" }, missingClip: false }).lean();
    const overs_map = {};
    for (let clip of clips) {
        const match_id = clip.matchId;
        const over = clip.over;
        const innings = clip.clip?.includes("_1.mp4") ? 1 : clip.clip?.includes("_2.mp4") ? 2 : undefined;
        let string = `${match_id}_${innings}`;
        if (match_id !== undefined) {
            if (!overs_map[string]) {
                overs_map[string] = []
            }
            else {
                overs_map[string].push(clip.over);
            }
        }
    }
    let over_entries = Object.entries(overs_map).sort((a, b) => b[1].length - a[1].length);
    over_entries = over_entries.map(([key, value]) => {
        return { key, count: value.length, overs_group: groupOvers(value) };
    });
    console.log(...over_entries.slice(0, 10), "over entries");
    //console.log(Object.entries(overs_map).sort((a, b) => b[1].length - a[1].length), "over numbers");
    process.exit();
};

async function test_overs() {
    await connectDB();
    let overs_map = {};
    const clips = await Clip.find({ missingClip: false }).lean();
    const overs = clips.map((clip) => clip.over).sort((b, a) => b - a);
    console.log(overs, new Set(overs.map((ov) => ov.split(".")[1])), "overs");
    const after_dot = overs.map((ov) => ov.split(".")[1]);
    //const groupedOvers = groupOvers(overs);
    for (let i = 0; i < after_dot.length; i++) {
        overs_map[after_dot[i]] = (overs_map[after_dot[i]] || 0) + 1;
    }
    console.log(overs_map, "overs map");
    //console.log(Object.entries(overs_map).sort((b,a) => b[1] - a[1]), "overs map");
    //console.log(groupedOvers, "grouped overs");
    process.exit();
}

async function reported_matches() {
    await connectDB();
    const clips = await Clip.find({
        missingClip: false, league: "IPL", "flag.isFlagged": true
    }).lean();
    const matchIds = clips.map((clip) => clip.matchId);
    let reported_map = {};
    for (let matchId of matchIds) {
        reported_map[matchId] = (reported_map[matchId] || 0) + 1;
    }
    console.log(Object.entries(reported_map).sort((b, a) => a[1] - b[1]), "reported matches");
    process.exit();
}

//reported_matches();

async function flag_reasons() {
    await connectDB();
    const reasons = await Clip.distinct("flag.reason", {});
    console.log(reasons, "flag reasons");
    process.exit();
}

async function wrong_clips() {
    await connectDB();
    const series_list = await Clip.distinct("series", { missingClip: false, league: "IPL" });
    let series_map = {};
    for (let series of series_list) {
        const match_ids = await Clip.distinct("matchId", { series: series, missingClip: false, league: "IPL" });
        for (let matchId of match_ids) {
            const clips = await Clip.find({ innings: 1, series: series, matchId: matchId, missingClip: false, league: "IPL" });
            const innings1 = clips.filter((c) => c.clip?.includes("_1.mp4"));
            const innings2 = clips.filter((c) => c.clip?.includes("_2.mp4"));
            const ratio = (innings1.length / innings2.length);
            const average = (innings1.length + innings2.length) / 2;
            if (series_map[series] === undefined) {
                series_map[series] = [];
                series_map[series].push({ matchId: matchId, count: clips.length, innings1: innings1.length, innings2: innings2.length, ratio: ratio, average: average })
            }
            else {
                series_map[series].push({ matchId: matchId, count: clips.length, innings1: innings1.length, innings2: innings2.length, ratio: ratio, average: average })
            }
        }
    }
    console.log(Object.entries(series_map).map(([series, matches]) => ({ series, matches: matches, average: matches.reduce((sum, match) => sum + match.average, 0) / matches.length })), "series map");
    let series_average = Object.entries(series_map).map(([series, matches]) => ({ series, matches: matches, average: matches.reduce((sum, match) => sum + match.average, 0) / matches.length }));
    let below_average_matches = series_average.map((series) => ({ series: series.series, below_average_matches: series.matches.filter((match) => ((match.innings1 + match.innings2) + 5) < series.average), average: series.average }));
    console.log(...below_average_matches, "below average matches");
    process.exit();
};

async function test_file() {
    await connectDB();
    const clips = JSON.parse(fs.readFileSync("./matches.json"));
    console.log(clips.map((cl) => cl.totalClips).sort((b, a) => a - b));
}

async function uneven() {
    await connectDB();
    const clips = await Clip.find({ missingClip: false, league: "IPL" }).lean();
    const matchIds = await Clip.distinct("matchId", { missingClip: false, league: "IPL" });
    let uneven_matches = [];
    for (let matchId of matchIds) {
        const match_clips = clips.filter((clip) => clip.matchId === matchId);
        const innings1 = match_clips.filter((clip) => clip.clip?.includes("_1.mp4"));
        const innings2 = match_clips.filter((clip) => clip.clip?.includes("_2.mp4"));
        let ratio = 0;
        if (innings2.length > innings1.length) {
            ratio = innings1.length / innings2.length
        }
        else {
            ratio = innings2.length / innings1.length
        }
        if (ratio < 0.3 && (innings1.length > 0 || innings2.length > 0)) {
            uneven_matches.push({ matchId: matchId, innings1: innings1.length, innings2: innings2.length, ratio: ratio });
        }
    }
    console.log(uneven_matches.sort((a, b) => b.ratio - a.ratio), "uneven matches");
}

async function less_count() {
    await connectDB();
    const clips = await Clip.find({ missingClip: false, league: "IPL" }).lean();
    const matchIds = await Clip.distinct("matchId", { missingClip: false, league: "IPL" });
    let less_count_matches = [];
    for (let matchId of matchIds) {
        const match_clips = clips.filter((clip) => clip.matchId === matchId);
        let innings1 = match_clips.filter((clip) => clip.clip?.includes("_1.mp4"));
        let innings2 = match_clips.filter((clip) => clip.clip?.includes("_2.mp4"));
        if (match_clips.length < 25 && innings1.length > 0 && innings2.length > 0) {
            less_count_matches.push({ matchId: matchId, count: match_clips.length });
        }
    }
    console.log(less_count_matches.sort((a, b) => b.count - a.count), "less count matches");
}

async function missing_matches() {
    await connectDB();
    let clips_file = JSON.parse(fs.readFileSync("matches.json"));
    //clips_file = clips_file.filter((cf) => cf.ingsSecond > 0)
    let clip_matchids = clips_file.map((cf) => cf.matchid);
    console.log(clip_matchids, "clip matchids");
    const clips = await Clip.find({ missingClip: false, league: "IPL" }).lean();
    const matchIds = await Clip.distinct("matchId", { missingClip: false, league: "IPL" });
    let less_count_matches = [];
    for (let matchId of matchIds) {
        const match_clips = clips.filter((clip) => clip.matchId === matchId);
        let innings1 = match_clips.filter((clip) => clip.clip?.includes("_1.mp4"));
        let innings2 = match_clips.filter((clip) => clip.clip?.includes("_2.mp4"));
        if (match_clips.length < 25) {
            less_count_matches.push({ matchId: matchId, count: match_clips.length });
        }
    }
    let lcm = less_count_matches.sort((a, b) => b.count - a.count).map((c) => c.matchId);
    console.log(lcm.length, lcm, clip_matchids)
    lcm = clip_matchids.filter((matchId) => lcm.includes(matchId));
    console.log(lcm.length, clip_matchids.length, lcm, "less count matches");
};

//missing_matches();

async function league_test() {
    await connectDB();
    const matches = JSON.parse(fs.readFileSync("matches.json"))
    matches = matches.filter((m) => m.inningsFirst > 0 && m.inningsSecond > 0)
    let match_ids = matches.map((m) => m.matchid);
    console.log(match_ids, match_ids.length)
    const leagues = await Clip.distinct("season", { matchId: match_ids });
    //console.log(leagues);
}

async function longest_ipl_season() {
    await connectDB();
    const seasons = await Clip.distinct("season", { league: "IPL" });
    console.log(seasons, "seasons");
    const series_list = await Clip.distinct("series", { league: "IPL" });
    let season_map = {};
    let all_seasons = [];
    for (let i = 0; i < series_list.length; i++) {
        const match_first = await Match.findOne({ seriesId: series_list[i] }).sort({ date: -1 });
        const match_last = await Match.findOne({ seriesId: series_list[i] }).sort({ date: 1 });
        let months = new Date(match_first.date).getMonth() - new Date(match_last.date).getMonth()
        let days = (new Date(match_first.date).getDate() - new Date(match_last.date).getDate()) + months * 30;
        season_map[series_list[i]] = days
        let year = new Date(match_first.date).getFullYear();
        let count = await Match.find({ seriesId: series_list[i] }).count();
        let teams = await Match.distinct("teamHomeCode", { seriesId: series_list[i] });
        all_seasons.push({ series: series_list[i], year: year, days: days, count: count, teams: teams });
    };
    console.log(all_seasons.sort((a, b) => b.days - a.days))
};

async function retired_players() {
    await connectDB();
    let batsmen = await Clip.distinct("batsman", { league: "IPL" });
    const bowlers = await Clip.distinct("bowler", { league: "IPL" });
    let batsmen_map = [];
    batsmen = Array.from(new Set(batsmen.map((b) => b.toLowerCase())));
    for (let i = 0; i < batsmen.length; i++) {
        const seasons = await Clip.distinct("season", { batsman: { $regex: batsmen[i], $options: "i" }, league: "IPL" });
        batsmen_map.push({ player: batsmen[i].toLowerCase(), seasons: seasons, count: seasons.length })
    };
    console.log(batsmen_map.sort((a, b) => b.count - a.count).filter((c) => !c.seasons.find(se => ((se > 2020)))), "batsmen map");
    process.exit();
};

async function long_break() {
    await connectDB();
    let batsmen = await Clip.distinct("batsman", { league: "IPL" });
    const bowlers = await Clip.distinct("bowler", { league: "IPL" });
    let batsmen_map = [];
    batsmen = Array.from(new Set(batsmen.map((b) => b.toLowerCase())));
    for (let i = 0; i < batsmen.length; i++) {
        const seasons = await Clip.distinct("season", { batsman: { $regex: batsmen[i], $options: "i" }, league: "IPL" });
        seasons.sort((a, b) => a - b);
        let long_break = 0;
        for (let j = 1; j < seasons.length; j++) {
            if (seasons[j] - seasons[j - 1] > 2) {
                season_break = seasons[j] - seasons[j - 1];
                if (season_break > long_break) {
                    long_break = season_break
                }
            }
        };
        batsmen_map.push({ player: batsmen[i].toLowerCase(), seasons: seasons, count: seasons.length, long_break: long_break })
    };
    console.log(batsmen_map.sort((a, b) => b.long_break - a.long_break), "batsmen map");
    process.exit();
};

async function no_break() {
    await connectDB();
    let batsmen = await Clip.distinct("batsman", { league: "IPL" });
    const bowlers = await Clip.distinct("bowler", { league: "IPL" });
    let batsmen_map = [];
    batsmen = Array.from(new Set(batsmen.map((b) => b.toLowerCase())));
    for (let i = 0; i < batsmen.length; i++) {
        const seasons = await Clip.distinct("season", { batsman: { $regex: batsmen[i], $options: "i" }, league: "IPL" });
        seasons.sort((a, b) => a - b);
        let no_break = 0;
        for (let j = 1; j < seasons.length; j++) {
            if (seasons[j] - seasons[j - 1] === 1) {
                no_break++;
            }
        };
        batsmen_map.push({ player: batsmen[i].toLowerCase(), seasons: seasons, count: seasons.length, no_break: no_break })
    }
    console.log(batsmen_map.sort((a, b) => b.no_break - a.no_break), "batsmen map");
    process.exit();
}

async function batsmen_count() {
    await connectDB();
    const clips = await Clip.find({ league: "IPL" }).lean();
    const matchIds = await Clip.distinct("matchId", { league: "IPL" });
    const match_map = {};
    for (let matchId of matchIds) {
        const match_clips = clips.filter((clip) => clip.matchId === matchId);
        const batsmen = Array.from(new Set(match_clips.map((clip) => clip.batsman)));
        match_map[matchId] = batsmen.length;
    }
    console.log(Object.entries(match_map).sort((a, b) => b[1] - a[1]), "match map");
    process.exit();
}

async function season_sixes() {
    await connectDB();
    const seasons = await Clip.distinct("season", { league: "IPL" });
    let season_map = {};
    for (let season of seasons) {
        const clips = await Clip.find({ season: season, league: "IPL", event: { $regex: "SIX", $options: "i" } }).lean();
        const matchIds = Array.from(new Set(clips.map((clip) => clip.matchId)));
        season_map[season] = clips.length;
    }
    console.log(Object.entries(season_map).sort((a, b) => b[1] - a[1]), "season map");
    process.exit();
}

async function dissmissed_players() {
    await connectDB();
    const clips = await Clip.find({});
    let batsmen = await Clip.distinct("batsman", { league: "IPL" })
    let clips_map = {};
    for (let i = 0; i < batsmen.length; i++) {
        const bowlers = await Clip.distinct("bowler", { batsman: batsmen[i], league: "IPL", event: "WICKET" })
        const normal_bowlers = await Clip.distinct("bowler", { batsman: batsmen[i], league: "IPL" });
        if (bowlers.length > 10) {
            if (!(clips_map[batsmen[i]])) {
                clips_map[batsmen[i]] = {};
            }
            if (!clips_map[batsmen[i]].bowlers) {
                clips_map[batsmen[i]].bowlers = []
            }
            clips_map[batsmen[i]].bowlers.push(...bowlers)
        }
        if (normal_bowlers.length > 10) {
            if (!(clips_map[batsmen[i]])) {
                clips_map[batsmen[i]] = {};
            }
            if (!clips_map[batsmen[i]].nbowlers) {
                clips_map[batsmen[i]].nbowlers = []
            }
            clips_map[batsmen[i]].nbowlers.push(...normal_bowlers)
        }
    }
    //console.log(Object.entries(clips_map))
    console.log(Object.entries(clips_map).map((cm) => ({ ...cm, ncount: cm[1]?.nbowlers?.length, count: cm[1]?.bowlers?.length })).sort((a, b) => b.ncount - a.ncount).slice(0, 10));
}

async function batsman_multinames() {
    await connectDB();
    const live_matches = await MatchLiveDetails.find().lean();
    let innings = live_matches.map((lm) => lm.teamHomePlayers.flat((mp) => mp)).flatMap((kl) => (kl));
    console.log(Array.from(new Set(innings.map((inn) => inn?.playerName))).filter((pl) => pl.split(" ").length > 1).sort((ab, bc) => bc.split(" ").length - ab.split(" ").length).sort((o, p) => p.length - o.length), "innings");
};

async function longbreak_series() {
    await connectDB();
    const ipl_matches = await Clip.distinct("matchId", { league: "IPL" });
    const series_ids = await Clip.distinct("series", { league: "IPL" });
    const all_matches = await Match.distinct("matchId", { seriesId: { $in: series_ids } })
    console.log(Array.from(new Set(ipl_matches)), series_ids, all_matches.length, ipl_matches.length);
    console.log(all_matches.filter((id) => !ipl_matches.includes(id)).length, all_matches.length - ipl_matches.length)
    const missing = all_matches.filter((id) => !ipl_matches.includes(id));
    const matchTitle = await Match.distinct("matchTitle", { matchId: { $in: missing } });
    console.log(matchTitle);
    const status = await MatchLiveDetails.distinct("status", { matchId: { $in: missing } });
    console.log(status)
    let season_map = {};
    for (let missed of missing) {
        const match_info = await Match.findOne({ matchId: missed });
        const match_live_info = await MatchLiveDetails.findOne({ matchId: missed });
        let year = new Date(match_info.date).getFullYear()
        if (!season_map[year]) {
            season_map[year] = [];
            season_map[year].push({ matchId: missed, status: match_live_info.status })
        }
        else {
            season_map[year].push({ matchId: missed, status: match_live_info.status })
        }
    }
    console.log(...Object.entries(season_map).sort((a, b) => b[1].length - a[1].length), "season map");
};

//longbreak_series();

async function batsman_breaks() {
    await connectDB();
    let batter_map = {};
    const seasons = await Clip.distinct("season", { league: "IPL" });
    console.log(seasons.length)
    for (let i = 0; i < seasons.length; i++) {
        batter_map[seasons[i]] = {};
        const batters = await Clip.distinct("batsman", { season: seasons[i], league: "IPL" });
        for (let j = 0; j < batters.length; j++) {
            batter_map[seasons[i]][batters[j]] = [];
            let match_ids = await Clip.distinct("matchId", { batsman: batters[j], season: seasons[i], league: "IPL" });
            const matches = await Match.find({ matchId: { $in: match_ids } }).sort({ date: -1 });
            let differences = [];
            for (let k = 0; k < matches.length - 1; k++) {
                //console.log(k, "k");
                let difference = new Date(matches[k + 1].date).getDate() - new Date(matches[k].date).getDate();
                let difference_months = new Date(matches[k + 1].date).getMonth() - new Date(matches[k].date).getMonth();
                difference = Math.abs(difference) + (difference_months * 30)
                //console.log(difference, "difference");
                let months1 = new Date(matches[k].date).getMonth();
                let dates1 = new Date(matches[k].date).getDate();
                let days1 = (months1 * 30) + dates1;
                let months2 = new Date(matches[k + 1].date).getMonth();
                let dates2 = new Date(matches[k + 1].date).getDate();
                let days2 = (months2 * 30) + dates2;
                difference = days2 - days1;
                let title = matches[k].matchTitle + matches[k + 1].matchTitle
                differences.push({ matchTitle: title, difference: Math.abs(difference) });
            }
            differences = differences.sort((a, b) => b.difference - a.difference);
            batter_map[seasons[i]][batters[j]].push(...differences)
        }
    };
    //console.log(...Object.entries(batter_map).map((a) => ({ ...a, players: Object.entries(a[1]).map((b) => ({ batsman: b[0], match: b[1] })) })));
    let data = Object.entries(batter_map).map((a) => ({ ...a, players: Object.entries(a[1]).map((b) => ({ batsman: b[0], match: b[1][0] })) }));
    data = data.map((c) => ({ ...c, players: c.players.filter((k) => k?.match?.difference).sort((a, b) => b.match?.difference - a.match?.difference) }));
    //console.log(...(data[0].players.filter((k) => k?.match?.difference).sort((a, b) => b.match?.difference - a.match?.difference)), "data");
    console.log(...(data.map((d) => ({ '1': d[0], players: d.players[0] })).sort((l, k) => k.players.match.difference - l.players.match.difference)));
};

function get_days(date) {
    let month = new Date(date).getMonth();
    let real_date = new Date(date).getDate();
    let year = new Date(date).getFullYear();
    let days = month * 30 + real_date + (year * 365);
    return days;
}

async function dense_series() {
    await connectDB();
    const series_list = await Clip.distinct("series", { league: "IPL" });
    console.log(series_list);
    let all_series = [];
    let density_map = {};
    for (let i = 0; i < series_list.length; i++) {
        let dates = await Match.distinct("date", { seriesId: series_list[i] });
        dates = dates.sort((a, b) => new Date(b) - new Date(a))
        //console.log(dates)

        let difference = Math.abs(get_days(dates[0]) - get_days(dates[dates.length - 1]));
        let series = await Series.findOne({ seriesId: series_list[i] });
        let ratio = dates.length / difference;
        console.log(ratio, series_list[i], series?.name);
        density_map[series?.name] = difference / dates.length;
        all_series.push({ length: dates.length, name: series?.name, ratio: ratio, difference: difference })
    };
    console.log(all_series.filter((as) => as.length > 10).sort((a, b) => b.ratio - a.ratio));
};

function same_day_test(dates, day) {
    dates = dates.filter((dt) => (new Date(dt).getDate() == new Date(day).getDate()) && (new Date(dt).getMonth() == new Date(day).getMonth()));
    return dates.length > 1
}

async function same_day() {
    await connectDB();
    const series_list = await Clip.distinct("series", { league: "IPL" });
    console.log(series_list);
    let all_series = [];
    let density_map = {};
    for (let i = 0; i < series_list.length; i++) {
        let dates = await Match.distinct("date", { seriesId: series_list[i] });
        dates = dates.sort((a, b) => new Date(b) - new Date(a))
        //console.log(dates)

        let difference = Math.abs(get_days(dates[0]) - get_days(dates[dates.length - 1]));
        let series = await Series.findOne({ seriesId: series_list[i] });
        let ratio = dates.length / difference;
        console.log(ratio, series_list[i], series?.name);
        density_map[series?.name] = difference / dates.length;
        let same_day_list = [];
        for (let j = 0; j < dates.length; j++) {
            if (same_day_test(dates, dates[j])) {
                same_day_list.push(dates[j])
            }
        }
        all_series.push({ length: dates.length, name: series?.name, ratio: ratio, difference: difference, total_same_days: same_day_list.length })
    };
    console.log(all_series.filter((as) => as.length > 10).sort((a, b) => b.ratio - a.ratio).sort((e, f) => e.total_same_days - f.total_same_days));
};

async function match_overtime() {
    await connectDB();
    const matches_list = await Clip.distinct("matchId", { league: "IPL" });
    let matches_map = [];
    const all_matches = await Match.find({ matchId: { $in: matches_list } })
    for (let i = 0; i < all_matches.length; i++) {
        let time_token = new Date(all_matches[i].date).getTime() - new Date(all_matches[i].enddate).getTime()
        matches_map.push({ matchTitle: all_matches[i].matchTitle, time: time_token })
    }
    console.log(matches_map.sort((a, b) => b.time - a.time))
};

async function biggest_wins() {
    await connectDB();
    const matches_list = await Clip.distinct("matchId", { league: "IPL" });
    let matches = await MatchLiveDetails.find({ matchId: { $in: matches_list } }).lean();
    matches = matches.map((m) => ({ ...m, margin: Math.abs(m.runSI - m.runFI) }))
    matches = matches.sort((a, b) => b.margin - a.margin).filter((fg) => fg.margin < 2)
    console.log(matches.slice(0, 10).map((m) => ({ matchId: m.matchId, margin: m.margin })));
    matches = matches.slice(0, 100);
    let match_map = [];
    for (let m of matches) {
        const match = await Match.findOne({ matchId: m.matchId });
        match_map.push({ matchTitle: match?.matchTitle, margin: m.margin })
    }
    console.log(match_map);
}

biggest_wins();