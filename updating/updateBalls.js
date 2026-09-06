const path = require('path');
const fs = require('fs');
const MatchLiveDetails = require("../models/matchlive");
const Matches = require("../models/match");
const Team = require("../models/team");
const getkeys = require("../utils/crickeys");
const db = require("../utils/firebaseinitialize");
const DetailScores = require("../models/detailscores");
const { fuzzyMatchVideo } = require("../utils/fuzzyMatchVideos");
const { findBestMatchingOver } = require("../utils/stringSimilar");
const { appendClipWithOverlay } = require('../utils/combineClips');
const Clip = require('../models/clips');
const { detectHighlights } = require('../utils/detectHighlights');
const { match } = require('assert');
const MatchLiveCommentary = require('../models/matchCommentary');

function getRunValue(event) {
    if (!event) return 0;
    event = event.trim();

    // Wicket
    if (event === 'W') return 0;

    // Leg byes: L1, L2, etc.
    if (event.startsWith('L')) return parseInt(event.slice(1)) || 0;

    // Wides: Wd, Wd1, Wd2 -> always +1 for the wide
    if (event.startsWith('Wd')) {
        const extra = parseInt(event.slice(2)) || 0;
        return 1 + extra;
    }

    // No-balls: Nb, Nb4 -> always +1 for the no-ball
    if (event.startsWith('Nb')) {
        const extra = parseInt(event.slice(2)) || 0;
        return 1 + extra;
    }

    // Normal number (0,1,2,3,4,6)
    const numeric = parseInt(event);
    return isNaN(numeric) ? 0 : numeric;
}

module.exports.updateBalls = async function () {
    try {
        let date = new Date();
        let matchess = [];
        //const endDate = new Date(date.getTime());
        date = new Date(date.getTime() - 120 * 60 * 60 * 1000);
        const startDate = new Date("2025-01-01T00:00:00Z");
        const endDate = new Date("2025-12-31T23:59:59Z");
        const matches = await Matches.find({
            //seriesId: '10587',
            //type: "i",
            //format: "t20",
            matchId: "151954",
            date: {
                $gte: date,
                $lt: new Date(),
            }
        });

        //  const citiesRef = db.db.collection('commentary');
        //  const snapshot = await citiesRef.get();
        //  if (snapshot.empty) {
        //    console.log('No matching documents.');
        //    return;
        // }
        // snapshot.forEach(async doc => {
        //  console.log(doc.id, '=>', doc.data());
        //  const commentaryRef = db.db.collection("commentary").doc(doc.id);
        //  const res = await commentaryRef.set(
        //    {
        //      commentary: [...doc.data().capital],
        //      livedata: !doc.data().matchdata ? 'not found' : doc.data().matchdata,
        //      miniscore: !doc.data().miniscore ? 'not found' : doc.data().miniscore
        //    },
        //    { merge: true }
        // );
        //});
        console.log(matches.length, 'matches found');
        for (let i = 0; i < matches.length; i++) {
            const matchid = matches[i].matchId;
            const match = await MatchLiveDetails.findOne({ matchId: matchid });
            console.log(match?.matchId, 'matche')
            if (match && ((match.result == "Complete")) && !match?.isInPlay) {
                //if (!(matches[i]?.matchId == '130179')) continue
                matchess.push(matches[i]);
            }
        }
        const m = matchess;
        console.log(m?.length, 'me')
        for (let i = 0; i < matchess.length; i++) {
            if (m[i].matchId.length > 3) {
                try {
                    console.log('getting')
                    const commentaryRef = db.db.collection("commentary").doc(m[i].matchId);
                    const doc = await commentaryRef.get();
                    console.log('fix')
                    if (doc.exists && doc.data().commentary && doc.data().commentary.length > 0) {
                        let xyz = doc.data().commentary;
                        console.log(m[i].matchId, 'matchid')
                        let matchCommentary = await MatchLiveCommentary.findOne({ matchId: m[i].matchId });
                        //console.log(matchCommentary, 'matchcommentary'  )
                        let xyz1 = matchCommentary?.teamHomeCommentary;
                        let xyz2 = matchCommentary?.teamAwayCommentary;
                        let fBalls = [];
                        let sBalls = [];
                        //console.log(xyz1, matchess[i].matchId, 'data')
                        let firstTeam = matchess[i].isHomeFirst ? matchess[i].teamHomeName : matchess[i].teamAwayName;
                        let secondTeam = !matchess[i].isHomeFirst ? matchess[i].teamHomeName : matchess[i].teamAwayName;;
                        for (let a = 0; a < xyz1.length; a++) {
                            let over = xyz1[a]?.overSeparator;
                            if (over) {
                                let overArray = over?.o_summary?.split(' ');
                                overArray = overArray?.filter((o) => o != '')
                                for (let b = 0; b < overArray?.length; b++) {
                                    let runs = getRunValue(overArray[b]);
                                    fBalls.push({ ballNbr: parseInt((xyz1[a].ballNbr - ((overArray?.length - 1) - b))), runs: runs, event: overArray[b] })
                                }
                            }
                        }
                        //console.log(xyz2, 'wxyz')
                        for (let a = 0; a < xyz2.length; a++) {
                            let over = xyz2[a]?.overSeparator;
                            if (over) {
                                let overArray = over?.o_summary?.split(' ');
                                overArray = overArray?.filter((o) => o != '')
                                for (let b = 0; b < overArray?.length; b++) {
                                    let runs = getRunValue(overArray[b]);
                                    sBalls.push({ ballNbr: parseInt((xyz2[a].ballNbr - ((overArray?.length - 1) - b))), runs: runs, event: overArray[b] })
                                }
                            }
                        }

                        //console.log(sBalls, 'xyz')
                        //console.log(detectHighlights(xyz),'highlights')
                        let wickets = 0
                        let updatedCommentary = []
                        for (let a = 0; a < xyz.length; a++) {
                            // console.log(xyz[a].event)
                            const event = xyz[a].event;
                            if (xyz[a]?.videoLink) {
                                let eventType = event.split('over-break,').join('')
                                const clips = await Clip.find({ event: eventType, reported: false, series: { $ne: "CPL" } })
                                let anyEvent = eventType.includes('FOUR') || eventType.includes('SIX') || eventType.includes('WICKET') || eventType === 'HUNDRED' || eventType === 'FIFTY'
                                if (anyEvent && xyz[a]?.commText?.length > 60) {
                                    const batsmanName = xyz[a]?.commText || 'batsman';
                                    const teamName = matchess[i]?.battingTeam?.replace(/ /g, "_") || 'team';
                                    const shotType = event === 'FOUR' ? 'four' : event === "SIX" ? 'six' : 'wicket';

                                    const keyword = `${teamName}_${batsmanName}_${shotType}`;

                                    //onst videoLink = await fuzzyMatchVideo(eventType, xyz[a]?.commText, xyz[a]) // your fuzzy logic to get video
                                    const bowling_team = ((xyz?.[a]?.batTeamName.toLowerCase() == matches[i].teamHomeCode?.toLowerCase())) ? matches[i].teamAwayCode : matches[i].teamHomeCode;
                                    const { videoLink, breakdown } = await fuzzyMatchVideo(clips, eventType, xyz[a]?.commText, xyz?.[a], bowling_team)
                                    console.log(videoLink, 'videolinked')
                                    xyz[a].videoLink = videoLink || ''; // fallback if not found
                                    if (videoLink && breakdown) {
                                        updatedCommentary.push({
                                            ...xyz[a],
                                            videoLink: videoLink || '',
                                            breakdown,
                                        });
                                        const originalClipPath = path.resolve(`D:/compressed_240p/${videoLink}`);
                                        if (fs.existsSync(originalClipPath)) {
                                            //await appendClipWithOverlay(videoLink, matchess?.[i].matchId, xyz[a], wickets)
                                        }
                                        if (eventType.includes('WICKET')) {
                                            wickets = wickets + 1
                                        }
                                    }
                                    else {
                                        updatedCommentary.push({ ...xyz[a] })
                                    }
                                }
                                else {
                                    updatedCommentary.push(xyz[a])
                                }
                            }
                            else {
                                updatedCommentary.push(xyz[a])
                            }
                        }
                        //console.log(updatedCommentary, 'updated commentary')
                        const res = await commentaryRef.set(
                            {
                                commentary: updatedCommentary,
                                livedata: doc.data().livedata,
                                miniscore: doc.data().miniscore
                            },
                            { merge: true }
                        );
                        console.log('updated the commentary')
                        {/*for (let a = 0; a <= 20; a++) {
                            let overArray = '1 6 0 1 2 4'.split(' ');
                            for (let b = 0; b < 6; b++) {
                                console.log((a - (5 - b)), 'fball number')
                                fBalls.push({ ballNbr: parseInt(a * 6 - (5 - b)), runs: isNaN(overArray[b]) ? 0 : parseInt(overArray[b]), event: overArray[b] })
                            }
                            let overArray2 = '0 4 w 1 2 2'.split(' ');
                            for (let b = 0; b < 6; b++) {
                                sBalls.push({ ballNbr: parseInt(a * 6 - (5 - b)), runs: isNaN(overArray2[b]) ? 0 : parseInt(overArray2[b]), event: overArray2[b] })
                            }

                        }*/}
                        let detail = await DetailScores.findOne({ matchId: m[i]?.matchId });
                        if (!detail) {
                            await DetailScores.create({
                                matchId: m[i].matchId, firstInningsBalls: fBalls,
                                secondInningsBalls: sBalls
                            })
                        }
                        else {
                            const firBalls = fBalls.filter((f) => !(detail.firstInningsBalls.find((b) => b.ballNbr == f.ballNbr)));
                            const firInnBalls = [...detail.firstInningsBalls.filter((b, index) => detail.firstInningsBalls.find((l) => detail.firstInningsBalls.indexOf(l) == index))]
                            const secBalls = sBalls.filter((x) => !(detail.secondInningsBalls.find((b) => b.ballNbr == x.ballNbr)));
                            const secInnBalls = [...detail.secondInningsBalls.filter((b, index) => detail.secondInningsBalls.find((l) => detail.secondInningsBalls.indexOf(l) == index))]
                            //console.log(secBalls, secInnBalls, 'secdata')
                            await DetailScores.updateOne({
                                matchId: m[i].matchId
                            }, {
                                firstTeam: firstTeam,
                                secondTeam: secondTeam,
                                firstInningsBalls: [...fBalls],
                                secondInningsBalls: [...sBalls]
                            })
                        }
                    }
                } catch (error) {
                    console.error(error);
                }
            }
        }
    } catch (error) {
        console.error(error);
    }
};
