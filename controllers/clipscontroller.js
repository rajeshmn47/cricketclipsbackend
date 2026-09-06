const Clip = require("../models/clips");
const express = require("express");
const path = require('path');
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const Matches = require("../models/match");
const Player = require("../models/players");
const Playlist = require("../models/playlist").default || require("../models/playlist");
const Series = require("../models/series");
const Match = require("../models/match");
const MatchLiveDetails = require("../models/matchlive");
const { getInningsClipCount } = require("../utils/helpers");
const { type } = require("os");
const { addPlayerHands } = require("../helperfunctions/updateClips");
const { checkloggedinadmin } = require("../utils/checkUser");
const { checkloggedinuser } = require("../utils/checkUser");

const router = express.Router();

// ✅ CREATE a single clip
router.post("/create", checkloggedinadmin, async (req, res) => {
    try {
        const clip = new Clip(req.body);
        const savedClip = await clip.save();
        res.status(201).json(savedClip);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ✅ READ all clips
router.get("/allclipss", async (req, res) => {
    try {
        const clips = await Clip.find().sort({ createdAt: 1 });
        res.json(clips);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /all_clips?search=&batsman=&bowler=&matchType=&series=&shotType=&direction=&page=1&limit=10&sort=desc
router.get("/allclips", async (req, res) => {
    try {
        const {
            search = "",
            batsman,
            bowler,
            event,
            matchType,
            league,
            type,
            format,
            series,
            batting_team,
            bowling_team,
            battingHand,
            bowlingHand,
            bowlerType,
            wicketType,
            season,
            shotType,
            direction,
            ballType,
            lengthType,
            connection,
            slowball,
            lofted,
            comesDown,
            powerplay,
            isCleanBowled,
            durationRange,
            isLBW,
            isStumping,
            isRunout,
            isCatch,
            shotElevation,
            variation,
            // Flag filters
            isFlagged,
            flagReason,
            reviewStatus,
            conflictField,
            // Other filters
            isDropped,
            droppedBy,
            runOutBy,
            catchBy,
            caughtBy,
            stumpedBy,
            page = 1,
            limit = 20,
            sort = "desc",
        } = req.query;

        console.log(req.query, 'query');

        // Build filter dynamically
        const filter = {};

        // 🔍 Text search across multiple fields (including labels)
        if (search) {
            filter.$or = [
                { event: { $regex: search, $options: "i" } },
                { commentary: { $regex: search, $options: "i" } },
                { subEvent: { $regex: search, $options: "i" } },
                { batsman: { $regex: search, $options: "i" } },
                { bowler: { $regex: search, $options: "i" } },
                { batting_team: { $regex: search, $options: "i" } },
                { bowling_team: { $regex: search, $options: "i" } },
                { series: { $regex: search, $options: "i" } },
                { matchType: { $regex: search, $options: "i" } },
                { "labels.shotType": { $regex: search, $options: "i" } },
                { "labels.direction": { $regex: search, $options: "i" } },
                { "labels.ballType": { $regex: search, $options: "i" } },
                { "labels.lengthType": { $regex: search, $options: "i" } },
                { "labels.connection": { $regex: search, $options: "i" } },
                { "labels.slowball": { $regex: search, $options: "i" } },
                { "labels.comesDown": { $regex: search, $options: "i" } },
                { "labels.powerplay": { $regex: search, $options: "i" } },
            ];
        }

        // 🎯 Field-based filters
        if (event) filter.event = { $regex: event, $options: "i" };
        if (batsman) filter.batsman = { $regex: batsman, $options: "i" };
        if (bowler) filter.bowler = { $regex: bowler, $options: "i" };
        if (league) filter.league = { $regex: league, $options: "i" };
        if (matchType) filter.matchType = matchType;
        if (type) filter.type = type;
        if (format) filter.format = format;
        if (variation) filter["labels.variation"] = variation;
        if (series) filter.series = { $regex: series, $options: "i" };
        if (season) filter.season = { $regex: season, $options: "i" };
        if (batting_team) filter.batting_team = { $regex: batting_team, $options: "i" };
        if (bowling_team) filter.bowling_team = { $regex: bowling_team, $options: "i" };
        if (battingHand) filter.battingHand = { $regex: battingHand, $options: "i" };
        if (bowlingHand) filter.bowlingHand = { $regex: bowlingHand, $options: "i" };
        if (bowlerType) filter.bowlerType = { $regex: bowlerType, $options: "i" };
        if (durationRange) {
            let min = durationRange.split("-")[0];
            let max = durationRange.split("-")[1];
            filter.duration = { $gte: parseFloat(min), $lte: parseFloat(max) };
        }

        // Labels filters
        if (shotType) filter["labels.shotType"] = { $regex: `^${shotType}$`, $options: "i" };
        if (direction) filter["labels.direction"] = { $regex: direction, $options: "i" };
        if (ballType) filter["labels.ballType"] = { $regex: ballType, $options: "i" };
        if (lengthType) filter["labels.lengthType"] = { $regex: lengthType, $options: "i" };
        if (connection) filter["labels.connection"] = { $regex: connection, $options: "i" };
        if (slowball) filter["labels.slowball"] = { $regex: slowball, $options: "i" };
        if (comesDown) filter["labels.comesDown"] = { $regex: comesDown, $options: "i" };
        if (powerplay) filter["labels.powerplay"] = { $regex: powerplay, $options: "i" };
        if (shotElevation) filter["labels.shotElevation"] = { $regex: shotElevation, $options: "i" };

        // Boolean filter for lofted
        if (lofted !== undefined && lofted !== "") filter["labels.lofted"] = lofted === "true";

        // Flag filters
        if (isFlagged !== undefined && isFlagged !== "") {
            filter["flag.isFlagged"] = isFlagged === "true";
        }
        if (flagReason) filter["flag.reason"] = flagReason;
        if (reviewStatus) filter["flag.reviewStatus"] = reviewStatus;
        if (conflictField) filter["flag.conflictFields"] = conflictField;

        // Wicket type filters
        const wicketTypeFilters = [];
        if (isCleanBowled === "true") wicketTypeFilters.push({ "labels.wicketType": "bowled" });
        if (isCleanBowled === "false") wicketTypeFilters.push({ "labels.wicketType": { $ne: "bowled" } });
        if (isLBW === "true") wicketTypeFilters.push({ "labels.wicketType": "lbw" });
        if (isLBW === "false") wicketTypeFilters.push({ "labels.wicketType": { $ne: "lbw" } });
        if (isStumping === "true") wicketTypeFilters.push({ "labels.wicketType": "stumped" });
        if (isStumping === "false") wicketTypeFilters.push({ "labels.wicketType": { $ne: "stumped" } });
        if (isRunout === "true") wicketTypeFilters.push({ "labels.wicketType": "runout" });
        if (isRunout === "false") wicketTypeFilters.push({ "labels.wicketType": { $ne: "runout" } });
        if (isCatch === "true") wicketTypeFilters.push({ "labels.wicketType": "caught" });
        if (isCatch === "false") wicketTypeFilters.push({ "labels.wicketType": { $ne: "caught" } });
        if (wicketType) wicketTypeFilters.push({ "labels.wicketType": wicketType });

        if (wicketTypeFilters.length === 1) {
            Object.assign(filter, wicketTypeFilters[0]);
        } else if (wicketTypeFilters.length > 1) {
            filter.$and = wicketTypeFilters;
        }

        // Dropped/Catch/Runout/Stumped filters
        if (isDropped !== undefined && isDropped !== "") filter["labels.dropped"] = isDropped === "true";
        if (droppedBy) filter["labels.droppedBy"] = { $regex: droppedBy, $options: "i" };
        if (isRunout !== undefined && isRunout !== "") filter["labels.runout"] = isRunout === "true";
        if (runOutBy) filter["labels.runoutBy"] = { $regex: runOutBy, $options: "i" };
        if (isCatch !== undefined && isCatch !== "") filter["labels.catch"] = isCatch === "true";
        if (catchBy) filter["labels.catchBy"] = { $regex: catchBy, $options: "i" };
        if (caughtBy) filter["labels.catchBy"] = { $regex: caughtBy, $options: "i" };
        if (stumpedBy) filter["labels.stumpedBy"] = { $regex: stumpedBy, $options: "i" };

        // Event-based filters (WICKET, FOUR, SIX, etc.)
        if (event) {
            filter.event = { $regex: event, $options: "i" };
        }
        filter.missingClip = false; // Only include clips that are not marked as missing

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        let sortOrder = {};

        if (req.query.sortBy) {
            const sortBy = req.query.sortBy;
            switch (sortBy) {
                case 'createdAt_asc': sortOrder = { createdAt: 1 }; break;
                case 'createdAt_desc': sortOrder = { createdAt: -1 }; break;
                case 'duration_asc': sortOrder = { duration: 1 }; break;
                case 'duration_desc': sortOrder = { duration: -1 }; break;
                case 'over_asc': sortOrder = { over: 1 }; break;
                case 'event_asc': sortOrder = { event: 1 }; break;
                default: sortOrder = { createdAt: -1 };
            }
        } else {
            // legacy 'sort' parameter (default desc)
            const sortLegacy = sort === 'asc' ? 1 : -1;
            sortOrder = { createdAt: sortLegacy };
        }
        console.log(filter, req.query, sortOrder, 'final filter and sort');
        const clips = await Clip.find(filter)
            .sort(sortOrder)
            .skip(skip)
            .limit(parseInt(limit));

        // Total count for pagination
        const total = await Clip.countDocuments(filter);

        res.json({
            success: true,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit),
            clips,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ✅ READ a single clip by ID
router.get("/getclip/:id", async (req, res) => {
    try {
        const clip = await Clip.findById(req.params.id);
        if (!clip) return res.status(404).json({ error: "Clip not found" });
        res.json(clip);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/getmatchclips/:id", async (req, res) => {
    try {
        const clip = await Clip.find({ matchId: req.params.id, missingClip: false });
        if (!clip) return res.status(404).json({ error: "Clip not found" });
        res.json(clip);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/matches", checkloggedinuser, async (req, res) => {
    try {
        console.log(req.query, "query")
        const {
            seriesId,
            series,
            matchId,
            type,
            format,
            season,
            fromDate,
            toDate,
            hasClips,
            page = 1,
            limit = 100,
            sort = "dateDesc",
            includeClips = "false",
            perClipLimit = 5,
            importance,
            ballType,
            shotType,
            direction,
            lengthType,
            connection,
            slowball,
            lofted,
            comesDown,
            powerplay,
            completed
        } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10));
        const pageSize = Math.max(1, parseInt(limit, 10));
        const skip = (pageNum - 1) * pageSize;
        const include = includeClips === "true";
        const perLimit = Math.max(1, parseInt(perClipLimit, 10));

        // Build filter
        const filter = {};
        if (seriesId) filter.seriesId = seriesId;
        if (series) filter.series = { $regex: series, $options: "i" };
        if (matchId) filter.matchId = matchId;
        if (type) filter.type = type;
        if (format) filter.format = format;
        if (season) filter.season = season;
        if (importance) filter.importance = importance;
        if (fromDate || toDate) {
            filter.date = {};
            if (fromDate) filter.date.$gte = new Date(fromDate);
            if (toDate) filter.date.$lte = new Date(toDate);
        }

        // Add labels filters
        if (ballType) filter["labels.ballType"] = { $regex: ballType, $options: "i" };
        if (shotType) filter["labels.shotType"] = { $regex: shotType, $options: "i" };
        if (direction) filter["labels.direction"] = { $regex: direction, $options: "i" };
        if (lengthType) filter["labels.lengthType"] = { $regex: lengthType, $options: "i" };
        if (connection) filter["labels.connection"] = { $regex: connection, $options: "i" };
        if (slowball) filter["labels.slowball"] = { $regex: slowball, $options: "i" };
        if (comesDown) filter["labels.comesDown"] = { $regex: comesDown, $options: "i" };
        if (powerplay) filter["labels.powerplay"] = { $regex: powerplay, $options: "i" };
        if (lofted !== undefined) filter["labels.lofted"] = lofted === "true";

        // Clean destructuring and filter for dropped/runout/catch fields
        const { dropped: isDropped, droppedBy, runout: isRunOut, runoutBy, catch: catchParam, catchBy } = req.query;
        if (isDropped !== undefined) filter["labels.dropped"] = isDropped === "true";
        if (droppedBy) filter["labels.droppedBy"] = { $regex: droppedBy, $options: "i" };
        if (isRunOut !== undefined) filter["labels.runout"] = isRunOut === "true";
        if (runoutBy) filter["labels.runoutBy"] = { $regex: runoutBy, $options: "i" };
        if (catchParam !== undefined) filter["labels.catch"] = catchParam === "true";
        if (catchBy) filter["labels.catchBy"] = { $regex: catchBy, $options: "i" };

        const sortSpec = sort === "dateAsc" ? { date: 1 } : { date: -1 };

        // total matches count
        const total = await Matches.countDocuments(filter);

        let matches = [];
        // If sorting by clip count we need to load all matches, count clips, sort in JS, then paginate
        if (sort === "clipsDesc" || sort === "clipsAsc") {
            const allMatches = await Matches.find(filter).lean();
            for (let i = 0; i < allMatches.length; i++) {
                const m = allMatches[i];
                m.matchlive = await MatchLiveDetails.findOne({ matchId: m.matchId });
                const matchIdVal = m.matchId === undefined || m.matchId === null ? null : String(m.matchId);
                m.clipsCount = matchIdVal ? await Clip.countDocuments({ matchId: matchIdVal, missingClip: false }) : 0;
                let label = await getInningsClipCount(matchIdVal, { ...Object.fromEntries(Object.entries(filter).filter(([k]) => k.startsWith("labels."))) })
                m.clipsLabel = label.label;
            }
            allMatches.sort((a, b) => (sort === "clipsDesc" ? b.clipsCount - a.clipsCount : a.clipsCount - b.clipsCount));
            matches = allMatches
        } else {
            // normal DB pagination (sorted by date)
            matches = await Matches.find(filter).sort(sortSpec).lean();
            console.log(matches.length, "matches");
            for (let i = 0; i < matches.length; i++) {
                const m = matches[i];
                m.matchlive = await MatchLiveDetails.findOne({ matchId: m.matchId });
                const matchIdVal = m.matchId === undefined || m.matchId === null ? null : String(m.matchId);
                const labelFilters = Object.fromEntries(Object.entries(filter).filter(([k]) => k.startsWith("labels.")));
                m.clipsCount = matchIdVal ? await Clip.countDocuments({ matchId: matchIdVal, missingClip: false }) : 0;
                let label = await getInningsClipCount(matchIdVal, {})
                m.clipsLabel = label.label;
            }
        }

        // Attach matchlive to each match
        matches = await Promise.all(matches.map(async (m) => {
            m.matchlive = await MatchLiveDetails.findOne({ matchId: m.matchId });
            return m;
        }));

        // Backend filtering logic (replace selectedFilter with req.query.selectedFilter)
        const selectedFilter = req.query.selectedFilter;
        const currentDate = new Date();
        if (selectedFilter) {
            matches = matches.filter(match => {
                const matchDate = new Date(match.date);
                const matchEndDate = new Date(match.enddate);
                const result = match?.matchlive?.result?.toLowerCase();
                const status = match?.matchlive?.status?.toLowerCase();
                if (selectedFilter === 'ongoing') {
                    if (!(matchDate <= currentDate && matchEndDate >= currentDate)) return false;
                } else if (selectedFilter === 'upcoming') {
                    if (!(matchDate > currentDate)) return false;
                } else if (selectedFilter === 'completed') {
                    if (result !== 'complete') return false;
                } else if (selectedFilter === 'delayedOrAbandoned') {
                    if (!(result === 'delayed' || result === 'abandon' || result === 'abandoned' || status?.includes("abandoned") || status?.includes("no result"))) return false;
                } else if (selectedFilter === 'notUpdated') {
                    const isNotUpdated = (!match.matchlive || !result) ||
                        (currentDate > matchEndDate && !(result === 'complete' || result === 'abandon' || result === 'abandoned'));
                    if (!isNotUpdated) return false;
                }
                return true;
            });
        }

        return res.json({
            total: matches.length,
            page: pageNum,
            limit: pageSize,
            totalPages: Math.ceil(matches.length / pageSize),
            matches: matches.slice(skip, skip + pageSize),
        });
    } catch (err) {
        console.error("Error fetching matches with clips:", err);
        res.status(500).json({ error: err.message });
    }
});

// ✅ UPDATE a clip
router.put("/update-clip/:id", checkloggedinadmin, async (req, res) => {
    try {
        const updatedClip = await Clip.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
        });
        if (!updatedClip) return res.status(404).json({ error: "Clip not found" });
        res.json(updatedClip);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ✅ DELETE a clip
router.delete("/delete-clip/:id", checkloggedinadmin, async (req, res) => {
    try {
        const clip = await Clip.findByIdAndDelete(req.params.id);
        if (!clip) return res.status(404).json({ error: "Clip not found" });
        if (clip.clip) {
            const filePath = path.join(__dirname, "..", "D:/fango11/fango11/allclips_lost", path.basename(clip.clip));
            fs.unlink(filePath, (err) => {
                if (err) console.warn("Failed to delete file:", filePath, err.message);
            });
        }
        res.json({ message: "Clip deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ BULK INSERT (from earlier)
router.post("/bulk-insert", checkloggedinadmin, async (req, res) => {
    try {
        // Accept either raw array or { clips: [...] }
        const raw = Array.isArray(req.body) ? req.body : req.body.clips;
        if (!Array.isArray(raw) || raw.length === 0) {
            return res.status(400).json({ success: false, message: "No clips provided" });
        }

        // Normalize items
        const clips = raw.map((c) => {
            const item = { ...c };
            if (item.matchId !== undefined && item.matchId !== null) item.matchId = String(item.matchId);
            if (!item.createdAt) item.createdAt = new Date();
            return item;
        });

        // Insert - don't stop on first error (ordered: false)
        const inserted = await Clip.insertMany(clips, { ordered: false });

        return res.status(201).json({
            success: true,
            insertedCount: inserted.length,
            insertedIds: inserted.map((d) => d._id),
        });
    } catch (err) {
        // Partial success handling: insertedDocs may exist when ordered:false
        const insertedCount = (err && err.insertedDocs && Array.isArray(err.insertedDocs)) ? err.insertedDocs.length : 0;
        console.error("bulk-insert error:", err.message || err);
        return res.status(500).json({
            success: false,
            message: "Bulk insert failed",
            insertedCount,
            error: err.message || String(err),
        });
    }
});

router.post("/delete-multiple", checkloggedinadmin, async (req, res) => {
    try {
        const { clips } = req.body;

        if (!Array.isArray(clips) || clips.length === 0) {
            return res.status(400).json({ success: false, message: "No clips provided" });
        }

        // Delete files from filesystem
        for (const clipName of clips) {
            const filePath = path.join(__dirname, "../allclips", clipName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        // Delete from MongoDB
        await Clip.deleteMany({ _id: { $in: clips } });

        res.json({ success: true });
    } catch (err) {
        console.error("Delete clips error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

router.post('/cut', (req, res) => {
    const { filename, startTime, duration } = req.body;

    const inputPath = path.join(__dirname, '../public/mockvideos', filename);
    const outputFilename = `cut-${Date.now()}-${filename}`;
    const outputPath = path.join(__dirname, '../public/mockvideos', outputFilename);

    ffmpeg(inputPath)
        .setStartTime(startTime) // e.g., "00:00:05"
        .setDuration(duration)   // e.g., 10 (seconds)
        .output(outputPath)
        .on('end', () => {
            res.json({ success: true, file: outputFilename });
        })
        .on('error', (err) => {
            console.error(err);
            res.status(500).json({ success: false, message: 'Cut failed' });
        })
        .run();
});

router.post('/merge', async (req, res) => {
    console.log(req.body, 'body')
    const { clips } = req.body; // array of filenames, e.g., ["cut-1.mp4", "cut-2.mp4"]
    files = clips
    console.log(clips, files, 'files')
    if (!Array.isArray(files) || files.length < 2) {
        return res.status(400).json({ success: false, message: 'At least two files required to merge' });
    }

    const tempFileList = path.join(__dirname, '../temp_file_list.txt');
    const videoDir = path.join(__dirname, 'D:/cricketvideos/iplclips');

    // Create FFmpeg input list file
    const listContent = files.map(file => `file '${path.join(videoDir, file)}'`).join('\n');
    fs.writeFileSync(tempFileList, listContent);

    const outputFilename = `merged-${Date.now()}.mp4`;
    const outputPath = path.join(videoDir, outputFilename);

    ffmpeg()
        .input(tempFileList)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions('-c copy')
        .output(outputPath)
        .on('end', () => {
            fs.unlinkSync(tempFileList); // clean up
            res.json({ success: true, file: outputFilename });
        })
        .on('error', (err) => {
            console.error(err);
            fs.unlinkSync(tempFileList);
            res.status(500).json({ success: false, message: 'Merge failed', error: err.message });
        })
        .run();
});

// POST /clips/report
router.post('/report', async (req, res) => {
    const { clipId } = req.body; // send clip _id from frontend

    if (!clipId) {
        return res.status(400).json({ success: false, message: 'clipId is required' });
    }

    try {
        // Set reported to true (simple flag)
        const clip = await Clip.findOneAndUpdate(
            { clip: clipId },
            { reported: true },
            { new: true } // return the updated document
        );

        if (!clip) {
            return res.status(404).json({ success: false, message: 'Clip not found' });
        }

        res.json({ success: true, reported: clip.reported });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error reporting clip' });
    }
});

// GET /allclips?search=&batsman=&bowler=&matchType=&series=&shotType=&direction=&page=1&limit=10&sort=desc
router.get("/all_clips", async (req, res) => {
    try {
        const {
            search = "",
            batsman,
            bowler,
            event,
            matchType,
            league,
            type,
            format,
            series,
            batting_team,
            bowling_team,
            battingHand,
            bowlingHand,
            bowlerType,
            wicketType,
            season,
            shotType,
            direction,
            ballType,
            lengthType,
            connection,
            slowball,
            lofted,
            comesDown,
            powerplay,
            isCleanBowled,
            isLBW,
            isStumping,
            isRunout,
            isCatch,
            shotElevation,
            variation,
            page = 1,
            limit = 20,
            sort = "desc",
        } = req.query;
        console.log(req.query, 'query')
        // Build filter dynamically
        const filter = {};
        console.log(event, 'event')

        // 🔍 Text search across multiple fields (including labels)
        if (search) {
            filter.$or = [
                { event: { $regex: search, $options: "i" } },
                { commentary: { $regex: search, $options: "i" } },
                { subEvent: { $regex: search, $options: "i" } },
                { batsman: { $regex: search, $options: "i" } },
                { bowler: { $regex: search, $options: "i" } },
                { batting_team: { $regex: search, $options: "i" } },
                { bowling_team: { $regex: search, $options: "i" } },
                { series: { $regex: search, $options: "i" } },
                { matchType: { $regex: search, $options: "i" } },
                { "labels.shotType": { $regex: search, $options: "i" } },
                { "labels.direction": { $regex: search, $options: "i" } },
                { "labels.ballType": { $regex: search, $options: "i" } },
                { "labels.lengthType": { $regex: search, $options: "i" } },
                { "labels.connection": { $regex: search, $options: "i" } },
                { "labels.slowball": { $regex: search, $options: "i" } },
                { "labels.comesDown": { $regex: search, $options: "i" } },
                { "labels.powerplay": { $regex: search, $options: "i" } },
            ];
        }

        // 🎯 Field-based filters (both top-level and nested)
        if (event) filter.event = { $regex: event, $options: "i" };
        if (batsman) filter.batsman = { $regex: batsman, $options: "i" };
        if (bowler) filter.bowler = { $regex: bowler, $options: "i" };
        if (league) filter.league = { $regex: league, $options: "i" };
        if (type) filter.matchType = type;
        if (format) filter.format = format;
        if (type) filter.type = type;
        if (variation) filter["labels.variation"] = variation;
        if (series) filter.series = { $regex: series, $options: "i" };
        if (season) filter.season = { $regex: season, $options: "i" };
        if (batting_team) filter.batting_team = { $regex: batting_team, $options: "i" };
        if (bowling_team) filter.bowling_team = { $regex: bowling_team, $options: "i" };
        if (battingHand) filter.battingHand = { $regex: battingHand, $options: "i" };
        if (bowlingHand) filter.bowlingHand = { $regex: bowlingHand, $options: "i" };
        if (bowlerType) filter.bowlerType = { $regex: bowlerType, $options: "i" };
        if (shotType) filter["labels.shotType"] = { $regex: `^${shotType}$`, $options: "i" };
        if (direction) filter["labels.direction"] = { $regex: direction, $options: "i" };
        if (ballType) filter["labels.ballType"] = { $regex: ballType, $options: "i" };
        if (lengthType) filter["labels.lengthType"] = { $regex: lengthType, $options: "i" };
        if (connection) filter["labels.connection"] = { $regex: connection, $options: "i" };
        if (slowball) filter["labels.slowball"] = { $regex: slowball, $options: "i" };
        if (comesDown) filter["labels.comesDown"] = { $regex: comesDown, $options: "i" };
        if (powerplay) filter["labels.powerplay"] = { $regex: powerplay, $options: "i" };
        if (shotElevation) filter["labels.shotElevation"] = { $regex: shotElevation, $options: "i" };
        const wicketTypeFilters = [];
        if (isCleanBowled === "true") wicketTypeFilters.push({ "labels.wicketType": "bowled" });
        if (isCleanBowled === "false") wicketTypeFilters.push({ "labels.wicketType": { $ne: "bowled" } });
        if (isLBW === "true") wicketTypeFilters.push({ "labels.wicketType": "lbw" });
        if (isLBW === "false") wicketTypeFilters.push({ "labels.wicketType": { $ne: "lbw" } });
        if (isStumping === "true") wicketTypeFilters.push({ "labels.wicketType": "stumped" });
        if (isStumping === "false") wicketTypeFilters.push({ "labels.wicketType": { $ne: "stumped" } });
        if (isRunout === "true") wicketTypeFilters.push({ "labels.wicketType": "runout" });
        if (isRunout === "false") wicketTypeFilters.push({ "labels.wicketType": { $ne: "runout" } });
        if (isCatch === "true") wicketTypeFilters.push({ "labels.wicketType": "caught" });
        if (isCatch === "false") wicketTypeFilters.push({ "labels.wicketType": { $ne: "caught" } });
        if (wicketType) wicketTypeFilters.push({ "labels.wicketType": wicketType })
        if (wicketTypeFilters.length === 1) {
            Object.assign(filter, wicketTypeFilters[0]);
        } else if (wicketTypeFilters.length > 1) {
            filter.$and = wicketTypeFilters;
        }

        // Boolean filter for lofted
        if (lofted !== undefined) filter["labels.lofted"] = lofted === "true";

        // Support for dropped/runout/catch filters
        const { isDropped, droppedBy, runOutBy, catchBy, caughtBy, stumpedBy } = req.query;
        if (isDropped !== undefined) filter["labels.dropped"] = isDropped === "true";
        if (droppedBy) filter["labels.droppedBy"] = { $regex: droppedBy, $options: "i" };
        if (isRunout !== undefined) filter["labels.runout"] = isRunout === "true";
        if (runOutBy) filter["labels.runoutBy"] = { $regex: runOutBy, $options: "i" };
        if (isCatch !== undefined) filter["labels.catch"] = isCatch === "true";
        if (catchBy) filter["labels.catchBy"] = { $regex: catchBy, $options: "i" };
        if (caughtBy) filter["labels.catchBy"] = { $regex: caughtBy, $options: "i" };
        if (stumpedBy) filter["labels.stumpedBy"] = { $regex: stumpedBy, $options: "i" };
        filter.missingClip = false; // Only include clips that are not marked as missing
        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Fetch clips
        console.log(filter, 'final filter')
        const clips = await Clip.find(filter)
            .sort({ createdAt: sort === "asc" ? 1 : -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Total count for pagination
        const total = await Clip.countDocuments(filter);

        res.json({
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit),
            clips,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post("/rename-name", async (req, res) => {
    try {
        const { type, oldName, newName } = req.body;
        if (!type || !oldName || !newName) {
            return res.status(400).json({ message: "Missing fields" });
        }
        if (type !== 'batsman' && type !== 'bowler') {
            return res.status(400).json({ message: "Type must be 'batsman' or 'bowler'" });
        }

        const updateField = type === 'batsman' ? 'batsman' : 'bowler';
        const result = await Clip.updateMany(
            { [updateField]: oldName },
            { $set: { [updateField]: newName } }
        );

        res.status(200).json({
            message: `Renamed ${result.modifiedCount} clips`,
            modifiedCount: result.modifiedCount
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

router.get("/unique-names", async (req, res) => {
    try {
        const { league, includeMissing } = req.query;
        const filter = {};
        if (league) filter.league = league;

        // ----- 1. Aggregations for distinct names (for problematic detection) -----
        const batsmenAgg = await Clip.aggregate([
            { $match: { ...filter, batsman: { $exists: true, $ne: "" } } },
            { $group: { _id: "$batsman", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $project: { name: "$_id", count: 1, _id: 0 } }
        ]);

        const bowlersAgg = await Clip.aggregate([
            { $match: { ...filter, bowler: { $exists: true, $ne: "" } } },
            { $group: { _id: "$bowler", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $project: { name: "$_id", count: 1, _id: 0 } }
        ]);

        // ----- 2. Problematic name detection (single‑word or initial) -----
        const isProblematic = (name) => {
            const trimmed = name.trim();
            if (!trimmed) return false;
            if (trimmed.includes('-')) return false;
            if (trimmed.includes('.') && trimmed.split(/\s+/).length > 1) return false;
            const parts = trimmed.split(/\s+/);
            if (parts.length === 1) return true;
            if (parts[0].length === 1) return true;
            return false;
        };

        let batsmen = batsmenAgg.filter(item => isProblematic(item.name));
        let bowlers = bowlersAgg.filter(item => isProblematic(item.name));

        // ----- 3. Optionally include players with proper names but missing hand data -----
        if (includeMissing === "true") {
            // Bowlers: include those missing bowlingHand or bowlerType
            const allBowlers = await Clip.distinct("bowler", filter);
            for (const name of allBowlers) {
                if (bowlers.some(b => b.name === name)) continue; // already listed
                const player = await Player.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
                if (player && (!player.bowlingHand || !player.bowlerType)) {
                    const count = await Clip.countDocuments({ bowler: name, ...filter });
                    bowlers.push({ name, count });
                }
            }
            // Batsmen: include those missing battingHand
            const allBatsmen = await Clip.distinct("batsman", filter);
            for (const name of allBatsmen) {
                if (batsmen.some(b => b.name === name)) continue;
                const player = await Player.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
                if (player && !player.battingHand) {
                    const count = await Clip.countDocuments({ batsman: name, ...filter });
                    batsmen.push({ name, count });
                }
            }
        }

        res.json({ batsmen, bowlers });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

router.post('/update-clip-hands', async (req, res) => {
    try {
        await addPlayerHands(); // your existing function
        res.status(200).json({ message: 'Clip hands updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

// POST /api/clips/flag
router.post("/flag", async (req, res) => {
    try {
        const { clipId, reason, description } = req.body;

        if (!clipId) {
            return res.status(400).json({ error: "clipId is required" });
        }

        // Find the clip by ID
        const clip = await Clip.findById(clipId);
        if (!clip) {
            return res.status(404).json({ error: "Clip not found" });
        }

        // Update the flag field according to your schema
        clip.flag = {
            isFlagged: true,
            reason: reason || "manual",
            details: description || "",
            conflictFields: [],
            flaggedAt: new Date(),
            reviewStatus: "pending",
            reviewedAt: null,
            reviewNotes: ""
        };

        await clip.save();

        res.json({
            success: true,
            message: "Clip flagged successfully",
            clipId: clip._id
        });
    } catch (err) {
        console.error("Error flagging clip:", err);
        res.status(500).json({ error: err.message });
    }
});

router.get("/all_players", async (req, res) => {
    try {
        const batsman = await Clip.distinct("batsman", {})
        const bowler = await Clip.distinct("bowler", {})
        const players = [...batsman, ...bowler]
        res.json(players);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /series/completed - completed & important series with clips info
router.get("/series/completed", async (req, res) => {
    try {
        const { teamHomeName, teamAwayName,
            ballType, shotType, direction, lengthType, connection, slowball, lofted, comesDown, powerplay,
            season, fromDate, type, format, name, toDate, page = 1, limit = 20, perClipLimit = 3, includeClips = "false"
        } = req.query;
        console.log(req.query, "a query")
        const pageNum = Math.max(1, parseInt(page, 10));
        const pageSize = Math.max(1, parseInt(limit, 10));
        const skip = (pageNum - 1) * pageSize;
        const include = includeClips === "true";
        const perLimit = Math.max(1, parseInt(perClipLimit, 10));

        // Only completed and important series
        const now = new Date();
        const seriesFilter = {
            startDate: { $lte: now }, importance: { $ne: "low" }
        };

        // Optionally filter by season/date
        if (season) seriesFilter.season = season;
        if (fromDate || toDate) {
            seriesFilter.endDate = seriesFilter.endDate || {};
            if (fromDate) seriesFilter.endDate.$gte = new Date(fromDate);
            if (toDate) seriesFilter.endDate.$lte = new Date(toDate);
        }
        let matchFilter = {};
        if (teamHomeName) matchFilter.teamHomeName = teamHomeName;
        if (teamAwayName) matchFilter.teamAwayName = teamAwayName;
        if (type) matchFilter.type = type;
        if (format) matchFilter.format = format;

        let matches = [];
        matches = await Match.find(matchFilter);
        if (matches.length > 0) {
            const seriesIds = matches.map(m => String(m.seriesId));
            seriesFilter.seriesId = { $in: seriesIds };
        }
        if (name) {
            seriesFilter.name = name
        }
        // Get all completed & important series (paginated)
        const allSeries = await Series.find(seriesFilter).sort({ endDate: -1 }).lean();
        const pagedSeries = allSeries;


        const seriesResults = [];
        for (const series of pagedSeries) {
            // Find all matches for this series
            let matches = []
            if (format) {
                matches = await Matches.find({ seriesId: String(series.seriesId), format }).lean();
            }
            else {
                matches = await Matches.find({ seriesId: String(series.seriesId) }).lean();
            }
            if (!matches.length) continue;

            const matchIds = matches.map(m => String(m.matchId));
            const homeTeams = [...new Set(matches.map(m => m.teamHomeName).filter(Boolean))];
            const awayTeams = [...new Set(matches.map(m => m.teamAwayName).filter(Boolean))];

            // Count clips for this series (with label filters)
            const clipsCount = await Clip.countDocuments({
                matchId: { $in: matchIds },
                missingClip: false
            });

            // Optionally include sample clips
            let clips = [];
            if (include && clipsCount > 0) {
                clips = await Clip.find({
                    matchId: { $in: matchIds },
                    missingClip: false
                })
                    .sort({ createdAt: -1 })
                    .limit(perLimit)
                    .lean();
            }

            // Count match types (e.g., T20, ODI) in this series
            const matchTypeCounts = matches.reduce((acc, m) => {
                const type = (m.format || '').toUpperCase();
                if (type) {
                    acc[type] = (acc[type] || 0) + 1;
                }
                return acc;
            }, {});

            // Add array of matches with matchId, type, and number of clips for each match
            const matchesArray = await Promise.all(matches.map(async (m) => {
                const numClips = await Clip.countDocuments({ matchId: String(m.matchId), missingClip: false });
                return {
                    matchId: m.matchId,
                    type: m.format,
                    clipsCount: numClips
                };
            }));

            seriesResults.push({
                seriesId: series.seriesId,
                name: series.name,
                endDate: series.endDate,
                homeTeams,
                awayTeams,
                clipsCount,
                clips,
                matchTypeCounts, // e.g., { T20: 3, ODI: 2 }
                matches: matchesArray
            });
        }

        res.json({
            total: allSeries.length,
            page: pageNum,
            limit: pageSize,
            totalPages: Math.ceil(allSeries.length / pageSize),
            series: seriesResults,
        });
    } catch (err) {
        console.error("Error fetching completed series with clips:", err);
        res.status(500).json({ error: err.message });
    }
});

// Create a playlist
router.post("/playlists/create", async (req, res) => {
    try {
        const playlist = new Playlist(req.body);
        const saved = await playlist.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get all playlists (optionally filter by user)
router.get("/playlists/all", checkloggedinuser, async (req, res) => {
    try {
        const filter = {};
        if (req.body.uidfromtoken) {
            filter.createdBy = req.body.uidfromtoken;
            const playlists = await Playlist.find(filter)
                .populate("createdBy", "username")
                .populate("videos") // Populate the videos/clips field with full objects
                .sort({ createdAt: -1 });
            res.json(playlists);
        }
        else {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all playlists (optionally filter by user)
router.get("/publicplaylists", checkloggedinuser, async (req, res) => {
    try {
        const filter = {};
        if (req.body.uidfromtoken) {
            const playlists = await Playlist.find({ isPublic: true })
            res.json(playlists);
        }
        else {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get a single playlist by ID
router.get("/playlists/:id", async (req, res) => {
    try {
        const playlist = await Playlist.findById(req.params.id).populate("createdBy", "username")
            .populate("videos") // Populate the videos/clips field with full objects
            .sort({ createdAt: -1 });
        if (!playlist) return res.status(404).json({ error: "Playlist not found" });
        res.json(playlist);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update a playlist
router.put("/playlists/update/:id", async (req, res) => {
    try {
        const updated = await Playlist.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updated) return res.status(404).json({ error: "Playlist not found" });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Delete a playlist
router.delete("/playlists/delete/:id", async (req, res) => {
    try {
        const deleted = await Playlist.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: "Playlist not found" });
        res.json({ message: "Playlist deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a video to playlist
router.post("/playlists/:id/add-video", async (req, res) => {
    try {
        const { videoId } = req.body;
        const playlist = await Playlist.findByIdAndUpdate(
            req.params.id,
            { $addToSet: { videos: videoId } },
            { new: true }
        );
        if (!playlist) return res.status(404).json({ error: "Playlist not found" });
        res.json(playlist);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Remove a video from playlist
router.post("/playlists/:id/remove-video", async (req, res) => {
    try {
        const { videoId } = req.body;
        const playlist = await Playlist.findByIdAndUpdate(
            req.params.id,
            { $pull: { videos: videoId } },
            { new: true }
        );
        if (!playlist) return res.status(404).json({ error: "Playlist not found" });
        res.json(playlist);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST /clips/bulk-update
router.post('/bulk-update', checkloggedinadmin, async (req, res) => {
    try {
        const { ids, updates } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'No clip IDs provided' });
        }

        // Build update object – only include fields that are provided
        const updateFields = {};
        if (updates.hasOwnProperty('flagged')) updateFields['flag.isFlagged'] = updates.flagged;
        if (updates.hasOwnProperty('flagReason')) updateFields['flag.reason'] = updates.flagReason;
        if (updates.hasOwnProperty('conflictField')) updateFields['flag.conflictFields'] = updates.conflictField;
        if (updates.hasOwnProperty('reviewStatus')) updateFields['flag.reviewStatus'] = updates.reviewStatus;
        if (updates.hasOwnProperty('reported')) updateFields.reported = updates.reported;

        // Also allow updating labels if needed (e.g., shotType, ballType) – optional
        if (updates.hasOwnProperty('shotType')) updateFields['labels.shotType'] = updates.shotType;
        // ... add other fields as required

        const result = await Clip.updateMany(
            { _id: { $in: ids } },
            { $set: updateFields },
            { multi: true }
        );

        res.json({
            success: true,
            modifiedCount: result.modifiedCount,
            message: `${result.modifiedCount} clip(s) updated`
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;