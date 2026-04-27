const request = require("request");
const Clip = require("../models/clips");

async function makeRequest(options) {
    //console.log(options, 'options')
    return new Promise((resolve, reject) => {
        request(options, (error, response, body) => {
            if (error) {
                reject(error);
            }
            if (body) {
                //console.log(body, 'body')
                const s = JSON.parse(body);
                resolve({ ...s, headers: response.headers });
            }
            else {
                resolve(null);
            }
        });
    });
}

function generateMatchHashtags(team1, team2, seriesName) {
    const baseTag = `#${team1.replace(/\s/g, '')}Vs${team2.replace(/\s/g, '')}`;
    const tags = [baseTag, '#Cricket', '#asiacup2025'];

    const leagueMap = {
        'indian premier league': ['#IPL', '#IPL2025'],
        'pakistan super league': ['#PSL', '#PSL2025'],
        'big bash league': ['#BBL', '#BBL2025'],
        'caribbean premier league': ['#CPL', '#CPL2025'],
        'the hundred': ['#TheHundred', '#TheHundred2025']
        // Add more as needed
    };

    const normalizedSeries = seriesName?.toLowerCase();

    for (const [league, hashtags] of Object.entries(leagueMap)) {
        if (normalizedSeries.includes(league)) {
            tags.push(...hashtags);
            break;
        }
    }

    return tags.join(' ');
}

async function getInningsClipCount(matchId, extraFilters = {}) {
    if (!matchId) {
        return { first: 0, second: 0, total: 0, label: "0 + 0" };
    }

    const baseQuery = { matchId: String(matchId), ...extraFilters };

    const first = await Clip.countDocuments({
        ...baseQuery,
        clip: /_1\.[^/.]+$/
    });

    const second = await Clip.countDocuments({
        ...baseQuery,
        clip: /_2\.[^/.]+$/
    });

    return {
        first,
        second,
        total: first + second,
        label: `${first} + ${second}`
    };
}

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

function getTodayFolder() {
    const today = new Date();

    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");

    return `allclips_${yyyy}-${mm}-${dd}`;
}

async function moveTodayClips() {
    const baseDir = "D:/cricketvideos/dailyclips";
    const todayFolder = getTodayFolder();

    const sourceDir = path.join(baseDir, todayFolder);
    const destDir = "D:/cricketvideos/allclips";

    if (!fs.existsSync(sourceDir)) {
        throw new Error(`Today's folder not found: ${sourceDir}`);
    }

    await fsp.mkdir(destDir, { recursive: true });

    const files = await fsp.readdir(sourceDir);

    let moved = 0;

    for (const file of files) {
        const srcPath = path.join(sourceDir, file);
        const destPath = path.join(destDir, file);

        const stat = await fsp.stat(srcPath);
        if (!stat.isFile()) continue;

        // move file (instant on same drive)
        await fsp.rename(srcPath, destPath).catch(async () => {
            // overwrite if already exists
            await fsp.unlink(destPath);
            await fsp.rename(srcPath, destPath);
        });

        moved++;
    }

    return moved;
}

module.exports = { makeRequest, generateMatchHashtags, getInningsClipCount, moveTodayClips };