const Clip = require("../../models/clips");
const connectDB = require("../../config/db");
const fs = require("fs");
const path = require("path");

async function findlowclips() {
    try {
        await connectDB();
        let matches = [];
        const matchIds = await Clip.distinct("matchId");
        console.log(matchIds?.length, "clips length");
        for (let i = 0; i < matchIds.length; i++) {
            const clips = await Clip.find({ $or: [{ clip: { $ne: null } }, { clip: { $ne: "" } }], matchId: matchIds[i] });
            let innings1 = clips.filter((c) => c.clip?.includes("_1.mp4"));
            let innings2 = clips.filter((c) => c.clip?.includes("_2.mp4"));
            let ratio = (innings1.length / innings2.length);

            if ((ratio > 5) || (ratio < 0.2)) {
                //console.log(ratio, "ratio");
                matches.push(matchIds[i])
            }
            if (clips.length < 5) {
                matches.push(matchIds[i])
                //console.log(matchIds[i], "matchid")
            }
        }
        matches = Array.from(new Set(matches));
        console.log(matches, matches.length, "matches");
        process.exit();
    }
    catch (err) {
        console.log(err, "err")
        process.exit();
    }
}

async function findaverage() {
    try {
        await connectDB();
        let matches = [];
        const seriesIds = await Clip.distinct("series", { league: "IPL", missingClip: false });
        console.log(seriesIds?.length, "clips length");
        let seriesList = [];
        let below_average = [];
        for (let i = 0; i < seriesIds.length; i++) {
            const clips = await Clip.find({ series: seriesIds[i], missingClip: false });
            const matchCount = await Clip.distinct("matchId", { series: seriesIds[i], missingClip: false });
            let average = clips.length / matchCount.length;
            //console.log(average, "average");
            seriesList.push({ seriesId: seriesIds[i], average: average })
        }
        for (series of seriesList) {
            let matchIds = await Clip.distinct("matchId", { series: series.seriesId, missingClip: false });
            for (matchId of matchIds) {
                const clips = await Clip.find({ matchId: matchId, missingClip: false });
                if (clips.length < series.average && series.average - clips.length > 20) {
                    below_average.push(matchId)
                }
            }
        }
        console.log(below_average, "belowaverage")
    }
    catch (err) {
        console.log(err, "err");
    }
}

//findaverage();

let belowavee = [
    "123375", "149314", "149392", "22396", "105802", "130019",
    "117359", "117413", "117416", "117425", "108787", "108809",
    "121406", "114636", "114643", "114661", "111193", "69788",
    "78208", "69858", "73638", "53357", "60023", "59986",
    "60000", "57783", "22745", "20717", "20238", "20239",
    "20257", "20271", "21265", "21266", "21267", "21268",
    "20301", "20137", "20172", "30540", "23252", "23253",
    "26808", "91778", "95232", "95241", "95245", "100274",
    "105962", "76507", "96199", "96208", "96213", "101545",
    "76486", "76500", "78649", "78656", "70354", "92948",
    "114616", "105772", "118595", "118619", "105834", "109393",
    "112677", "100283", "105890", "36547", "32258", "32267",
    "32273", "48128", "38342", "38356", "38306", "38312",
    "46499", "46506", "46534", "38326", "38632", "38637",
    "38642", "35852", "35857", "35863", "35867", "139118",
    "91452", "91663", "115032", "115113", "115156", "115174",
    "115248", "118907", "151935", "117209"
]

let belowave = [
    '20092', '22409', '30409',
    '45886', '45906', '46096',
    '66208', '66211', '66432',
    '73638', '20257', '115032',
    '115084', '115093', '115095',
    '115113', '115156', '115174',
    '118907', '151935'
]

async function ignorelist() {
    try {
        await connectDB();
        const ids = [];
        let matches = JSON.parse(fs.readFileSync(path.join(__dirname, "../../matches.json")));
        //console.log(matches, "matches");
        let mids = matches.map((m) => m.matchid);
        let ba = belowave.filter((b) => (!(mids.includes(b))));
        console.log(ba, "ba");
        const matchIds = await Clip.distinct("matchId", { league: "IPL", missingClip: false });
        console.log(matchIds.filter((m) => ba.includes(m)), "real ids");
    }
    catch (err) {
        console.log(err, "err");
    }
}

ignorelist()
