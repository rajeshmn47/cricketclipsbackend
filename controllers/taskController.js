const express = require("express");
const path = require('path');
const fs = require("fs");
const Task = require("../models/task");
const Match = require("../models/match");
const Series = require("../models/series");
const { runPipeline } = require("../updating/generateClips");
const Clip = require("../models/clips");
const { generateLabelsMatch } = require("../helpers/generateLabels_match");
const { addPlayerHandsMatch } = require("../helpers/updateClips_match");
const { moveTodayClips } = require("../utils/helpers");
const Config = require("../models/config");
const { findingmatchkeeper } = require("../helpers/findingmatchkeeper");

const router = express.Router();

// Start the clips processing pipeline
router.get("/startPipeline", async (req, res) => {
    try {
        runPipeline();
        res.status(200).json({ message: "Pipeline started" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ CREATE a single clip
router.post("/create", async (req, res) => {
    try {
        //await Task.deleteMany({});
        const clip = new Task(req.body);
        const savedClip = await clip.save();
        runPipeline()
        res.status(201).json(savedClip);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// UPDATE a task
router.put("/update/:id", async (req, res) => {
    try {
        const updatedTask = await Task.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!updatedTask) {
            return res.status(404).json({ error: "Task not found" });
        }

        res.json(updatedTask);

    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE a task by ID
router.delete("/delete/:id", async (req, res) => {
    try {
        const deletedTask = await Task.findByIdAndDelete(req.params.id);
        if (!deletedTask) {
            return res.status(404).json({ error: "Task not found" });
        }
        res.json({ success: true, message: "Task deleted", task: deletedTask });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ READ all tasks with pagination and match date (manual lookup using matchId field in Match)
router.get("/alltasks", async (req, res) => {
    try {
        const page = parseInt(req.query.page) > 0 ? parseInt(req.query.page) : 1;
        const limit = parseInt(req.query.limit) > 0 ? parseInt(req.query.limit) : 20;
        const skip = (page - 1) * limit;
        const teamHomeName = req.query.teamHomeName;
        const teamAwayName = req.query.teamAwayName;

        console.log(req.query, 'query params')

        // Add status filter if provided
        const filter = {};
        if (req.query.status) {
            filter.status = req.query.status;
        }
        if (teamHomeName) {
            filter.teamHomeName = teamHomeName;
        }
        if (teamAwayName) {
            filter.teamAwayName = teamAwayName;
        }

        // If series filter is provided, find matchIds for that series
        let matchIdsForSeries = null;
        if (req.query.series) {
            const seriesDoc = await Series.findOne({ seriesId: req.query.series });
            if (seriesDoc) {
                const matches = await Match.find({ seriesId: req.query.series });
                matchIdsForSeries = matches.map(m => m.matchId);
                if (matchIdsForSeries.length > 0) {
                    filter.matchId = { $in: matchIdsForSeries };
                } else {
                    // No matches for this series, return empty result
                    return res.json({ tasks: [], total: 0, page: 1, pages: 1 });
                }
            } else {
                // Series not found, return empty result
                return res.json({ tasks: [], total: 0, page: 1, pages: 1 });
            }
        }

        const [tasks, total] = await Promise.all([
            Task.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Task.countDocuments(filter)
        ]);

        // Manually fetch match date for each task using matchId field in Match
        const tasksWithMatchDated = await Promise.all(tasks.map(async (task) => {
            let matchDate = null;
            let clips = 0;
            if (task.matchId) {
                const match = await Match.findOne({ matchId: task.matchId });
                matchDate = match ? match.date : null;
                const firstInnings = await Clip.countDocuments({
                    matchId: task.matchId,
                    clip: /_1\.[^/.]+$/   // ends with _1.<extension>
                });
                const secondInnings = await Clip.countDocuments({
                    matchId: task.matchId,
                    clip: /_2\.[^/.]+$/   // ends with _2.<extension>
                });

                clips = `${firstInnings} + ${secondInnings}`;
            }
            return {
                ...task.toObject(),
                matchDate,
                clips
            };
        }));

        const tasksWithMatchDate = await Promise.all(tasks.map(async (task) => {
            let matchDate = null;
            let clips = "0 + 0";
            let clipProgress = null;
            let expectedTotal = 0;
            if (task.matchId) {
                const match = await Match.findOne({ matchId: task.matchId });
                matchDate = match ? match.date : null;

                // ✅ Count uploaded clips first
                const firstInnings = await Clip.countDocuments({
                    matchId: task.matchId,
                    clip: /_1\.[^/.]+$/
                });

                const secondInnings = await Clip.countDocuments({
                    matchId: task.matchId,
                    clip: /_2\.[^/.]+$/
                });

                const uploadedTotal = firstInnings + secondInnings;
                clips = `${firstInnings + secondInnings}(${firstInnings},${secondInnings})`;

                // ✅ ONLY if finished AND nothing uploaded → check OCR output
                if (task.status === "finished" && uploadedTotal === 0) {
                    try {
                        const filePath = path.join(
                            __dirname,
                            `./../../../pythonocr/cricket_ocr/temporary_overs/overs_with_clips_${task.matchId}.json`
                        );

                        if (fs.existsSync(filePath)) {
                            const raw = fs.readFileSync(filePath, "utf8");
                            const parsed = JSON.parse(raw);

                            expectedTotal = parsed.filter(o =>
                                o.clip || o.hasClip || o.outputClip
                            ).length;
                            let expectedFirst = 0;
                            let expectedSecond = 0;

                            parsed.forEach(o => {
                                const clipName = o.outputClip || o.clip || "";

                                if (/_1\.[^/.]+$/.test(clipName)) {
                                    expectedFirst++;
                                } else if (/_2\.[^/.]+$/.test(clipName)) {
                                    expectedSecond++;
                                }
                            });

                            expectedTotal = `${expectedFirst + expectedSecond}(${expectedFirst},${expectedSecond})`;

                            clipProgress = {
                                expected: expectedTotal,
                                uploaded: 0,
                                pending: expectedTotal,
                                percent: 0,
                                ready: true   // 👈 tells frontend “can upload now”
                            };
                        }
                    } catch (err) {
                        console.log("⚠️ OCR file missing for", task.matchId);
                    }
                }
                if (uploadedTotal == 0) {
                    clips = expectedTotal
                }
            }
            return {
                ...task.toObject(),
                matchDate,
                clips,
                expectedTotal,
                clipProgress
            };
        }));


        res.json({
            tasks: tasksWithMatchDate,
            total,
            page,
            pages: Math.ceil(total / limit)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/matchTasks/:matchId", async (req, res) => {
    try {
        const clips = await Task.find({ matchId: req.params.matchId }).sort({ createdAt: 1 });
        res.json(clips);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/commentaryOutput/:matchId", async (req, res) => {
    try {
        commentary = fs.readFileSync(path.join(__dirname, `./../../../ pythonocr / cricket_ocr / temporary_overs / overs_with_clips_${req.params.matchId}.json`), 'utf8');
        res.json(commentary);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/insertClips/:matchId", async (req, res) => {
    try {
        commentary = fs.readFileSync(path.join(__dirname, `./../../../pythonocr/cricket_ocr/temporary_overs/overs_with_clips_${req.params.matchId}.json`), 'utf8');
        //console.log(JSON.parse(commentary), 'commentary')
        await Clip.insertMany(JSON.parse(commentary));
        await generateLabelsMatch(req.params.matchId);
        await addPlayerHandsMatch(req.params.matchId);
        await findingmatchkeeper(req.params.matchId, true);
        await moveTodayClips();
        res.json({ message: "Clips inserted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/mergeClips/:matchId", async (req, res) => {
    try {
        commentary = fs.readFileSync(path.join(__dirname, `./../../../ pythonocr / cricket_ocr / temporary_overs / overs_with_clips_${req.params.matchId}.json`), 'utf8');
        res.json(commentary);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/cookies", async (req, res) => {
    try {
        const { name, cookies } = req.body;

        let config = await Config.findOne({ name });

        if (!config) {
            config = new Config({
                name,
                cookies
            });
        } else {
            config.cookies = {
                ...config.cookies,
                ...cookies
            };
        }

        await config.save();

        res.json({ message: "Cookies saved", data: config.cookies });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/cookies", async (req, res) => {
    try {
        const { name } = req.query;
        const config = await Config.findOne({ name });

        if (!config) {
            return res.status(404).json({ error: "Config not found" });
        }
        res.json({ cookies: config.cookies });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// GET /tasks/generate-ignore-teams
router.get("/generate-ignore-teams", async (req, res) => {
    try {
        // 1. Teams that have clips (safe)
        const matchIdsWithClips = await Clip.distinct("matchId");
        const matchesWithClips = await Match.find({ matchId: { $in: matchIdsWithClips } }).lean();
        const teamsWithClips = new Set();
        for (const m of matchesWithClips) {
            if (m.teamHomeName) teamsWithClips.add(m.teamHomeName.toLowerCase());
            if (m.teamAwayName) teamsWithClips.add(m.teamAwayName.toLowerCase());
        }

        // 2. Teams from finished tasks with missing videoLink
        const matchIdsFromFailedTasks = await Task.distinct("matchId", {
            videoLink: { $in: [null, "", undefined] },
            status: "finished"
        });
        const matchesFromFailedTasks = await Match.find({ matchId: { $in: matchIdsFromFailedTasks } }).lean();
        const teamsFromFailedTasks = new Set();
        for (const m of matchesFromFailedTasks) {
            if (m.teamHomeName) teamsFromFailedTasks.add(m.teamHomeName.toLowerCase());
            if (m.teamAwayName) teamsFromFailedTasks.add(m.teamAwayName.toLowerCase());
        }

        // 3. Ignore = teams from failed tasks that are NOT in teamsWithClips
        const ignoreTeams = [];
        for (const team of teamsFromFailedTasks) {
            if (!teamsWithClips.has(team)) {
                ignoreTeams.push(team);
            }
        }

        // 4. Write to config/ignoreTeams.json
        const configDir = path.join(__dirname, "./config");
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
        const filePath = path.join(configDir, "ignoreTeams.json");
        fs.writeFileSync(filePath, JSON.stringify(ignoreTeams, null, 2), "utf8");

        res.json({
            success: true,
            message: `Ignore list updated with ${ignoreTeams.length} teams`,
            teamsWithClips: teamsWithClips.size,
            teamsFailed: teamsFromFailedTasks.size,
            ignoreCount: ignoreTeams.length,
            ignoreTeams
        });
    } catch (err) {
        console.error("Error generating ignore list:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;