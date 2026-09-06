const express = require("express");
const RapidApiKey = require("../models/rapidapikeys");
const User = require("../models/user");
const config = require("../models/config");
const ApiRequest = require("../models/apiRequest");
const Clip = require("../models/clips.js");
const partnership = require("../models/partnership.js");
const MatchLiveDetails = require("../models/matchlive.js");

const router = express.Router();

// GET /api/analytics/dropped-catches
router.get("/dropped-catchess", async (req, res) => {
    try {
        const { seriesId, season, format, league, player } = req.query;

        // Build match conditions
        const matchConditions = {
            event: { $regex: /dropped|DROP/i },  // Match dropped events
            "labels.dropped": true,
            "labels.droppedBy": { $exists: true, $ne: null, $ne: "" }
        };
        if (seriesId) matchConditions.seriesId = seriesId;
        if (season) matchConditions.season = season;
        if (format) matchConditions.format = format;
        if (league) matchConditions.league = league;
        if (player) matchConditions["labels.droppedBy"] = { $regex: player, $options: "i" };

        const pipeline = [
            { $match: matchConditions },
            {
                $group: {
                    _id: "$labels.droppedBy",
                    count: { $sum: 1 },
                    matches: { $addToSet: "$matchId" },
                    batsmen: { $addToSet: "$batsman" },
                    bowlers: { $addToSet: "$bowler" }
                }
            },
            {
                $project: {
                    player: "$_id",
                    droppedCatches: "$count",
                    matches: { $size: "$matches" },
                    uniqueBatsmen: { $size: "$batsmen" },
                    uniqueBowlers: { $size: "$bowlers" }
                }
            },
            { $sort: { droppedCatches: -1 } }
        ];

        const result = await Clip.aggregate(pipeline);
        res.json(result);

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/dropped-catches
router.get("/dropped-catches", async (req, res) => {
    try {
        const { seriesId, season, format, league, player, minCatches = 0 } = req.query;

        const baseMatch = {};
        if (seriesId) baseMatch.seriesId = seriesId;
        if (season) baseMatch.season = season;
        if (format) baseMatch.format = format;
        if (league) baseMatch.league = league;

        // ----- 1. Catches taken -----
        const catchMatch = {
            ...baseMatch,
            "labels.catch": true,
            "labels.catchBy": { $exists: true, $ne: "" }
        };
        if (player) catchMatch["labels.catchBy"] = { $regex: player, $options: "i" };

        const catchesPipeline = [
            { $match: catchMatch },
            {
                $group: {
                    _id: "$labels.catchBy",
                    catches: { $sum: 1 },
                    catchMatchIds: { $addToSet: "$matchId" }
                }
            }
        ];

        // ----- 2. Drops -----
        const dropMatch = {
            ...baseMatch,
            "labels.dropped": true,
            "labels.droppedBy": { $exists: true, $ne: "" }
        };
        if (player) dropMatch["labels.droppedBy"] = { $regex: player, $options: "i" };

        const dropsPipeline = [
            { $match: dropMatch },
            {
                $group: {
                    _id: "$labels.droppedBy",
                    drops: { $sum: 1 },
                    dropMatchIds: { $addToSet: "$matchId" }
                }
            }
        ];

        const [catchesResult, dropsResult] = await Promise.all([
            Clip.aggregate(catchesPipeline),
            Clip.aggregate(dropsPipeline)
        ]);

        // Merge results into a Map
        const fielderMap = new Map();

        catchesResult.forEach(c => {
            fielderMap.set(c._id, {
                fielder: c._id,
                catches: c.catches,
                catchMatchIds: c.catchMatchIds,
                drops: 0,
                dropMatchIds: []
            });
        });

        dropsResult.forEach(d => {
            if (fielderMap.has(d._id)) {
                const f = fielderMap.get(d._id);
                f.drops = d.drops;
                f.dropMatchIds = d.dropMatchIds;
            } else {
                fielderMap.set(d._id, {
                    fielder: d._id,
                    fielderId: d.playerId,
                    catches: 0,
                    catchMatchIds: [],
                    drops: d.drops,
                    dropMatchIds: d.dropMatchIds
                });
            }
        });

        // Apply minCatches filter
        let result = Array.from(fielderMap.values())
            .filter(f => f.catches >= parseInt(minCatches))
            .map(f => {
                const allMatchIds = new Set([...f.catchMatchIds, ...f.dropMatchIds]);
                const totalMatches = allMatchIds.size;
                const totalChances = f.catches + f.drops;
                const successRate = totalChances === 0 ? 0 : (f.catches / totalChances) * 100;

                return {
                    fielder: f.fielder,
                    catches: f.catches,
                    drops: f.drops,
                    totalChances,
                    successRate: parseFloat(successRate.toFixed(1)),
                    matches: totalMatches,
                    dropsPerMatch: totalMatches === 0 ? 0 : parseFloat((f.drops / totalMatches).toFixed(2))
                };
            });

        // Sort by most catches first
        result.sort((a, b) => b.catches - a.catches);
        res.json(result);

    } catch (error) {
        console.error("Error in dropped-catches:", error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/boundary-contribution-per-wicket
router.get("/boundary-contribution-per-wicket", async (req, res) => {
    try {
        const { batsman, bowler, seriesId, season, format, league, minWickets = 2 } = req.query;

        // Get boundary runs for each bowler-batsman pair
        const boundaryStats = await Clip.aggregate([
            {
                $match: {
                    event: { $regex: /BOUNDARY|FOUR|SIX/i },
                    batsman: { $exists: true, $ne: null, $ne: "" },
                    bowler: { $exists: true, $ne: null, $ne: "" }
                }
            },
            {
                $match: batsman ? { batsman: { $regex: batsman, $options: "i" } } : {}
            },
            {
                $match: bowler ? { bowler: { $regex: bowler, $options: "i" } } : {}
            },
            {
                $match: seriesId ? { seriesId: seriesId } : {}
            },
            {
                $match: season ? { season: season } : {}
            },
            {
                $match: format ? { format: format } : {}
            },
            {
                $match: league ? { league: league } : {}
            },
            {
                $addFields: {
                    boundaryRuns: {
                        $cond: [
                            { $regexMatch: { input: "$event", regex: /six/i } },
                            6,
                            4
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: {
                        batsman: "$batsman",
                        bowler: "$bowler"
                    },
                    totalBoundaryRuns: { $sum: "$boundaryRuns" },
                    fours: {
                        $sum: {
                            $cond: [
                                { $regexMatch: { input: "$event", regex: /four/i } },
                                1,
                                0
                            ]
                        }
                    },
                    sixes: {
                        $sum: {
                            $cond: [
                                { $regexMatch: { input: "$event", regex: /six/i } },
                                1,
                                0
                            ]
                        }
                    },
                    totalBoundaries: { $sum: 1 }
                }
            }
        ]);

        // Get wicket counts for each bowler-batsman pair
        const wicketStats = await Clip.aggregate([
            {
                $match: {
                    event: { $regex: /WICKET/i },
                    "labels.wicketType": { $exists: true, $ne: null },
                    batsman: { $exists: true, $ne: null, $ne: "" },
                    bowler: { $exists: true, $ne: null, $ne: "" }
                }
            },
            {
                $match: batsman ? { batsman: { $regex: batsman, $options: "i" } } : {}
            },
            {
                $match: bowler ? { bowler: { $regex: bowler, $options: "i" } } : {}
            },
            {
                $match: seriesId ? { seriesId: seriesId } : {}
            },
            {
                $match: season ? { season: season } : {}
            },
            {
                $match: format ? { format: format } : {}
            },
            {
                $match: league ? { league: league } : {}
            },
            {
                $group: {
                    _id: {
                        batsman: "$batsman",
                        bowler: "$bowler"
                    },
                    wickets: { $sum: 1 },
                    wicketTypes: { $push: "$labels.wicketType" }
                }
            }
        ]);

        // Combine boundary runs and wickets
        const combinedStats = [];
        const wicketMap = new Map();

        wicketStats.forEach(w => {
            const key = `${w._id.batsman}|${w._id.bowler}`;
            wicketMap.set(key, {
                wickets: w.wickets,
                wicketTypes: w.wicketTypes
            });
        });

        boundaryStats.forEach(b => {
            const key = `${b._id.batsman}|${b._id.bowler}`;
            const wicketData = wicketMap.get(key) || { wickets: 0, wicketTypes: [] };

            if (wicketData.wickets >= parseInt(minWickets)) {
                combinedStats.push({
                    batsman: b._id.batsman,
                    bowler: b._id.bowler,
                    totalBoundaryRuns: b.totalBoundaryRuns,
                    fours: b.fours,
                    sixes: b.sixes,
                    totalBoundaries: b.totalBoundaries,
                    wickets: wicketData.wickets,
                    wicketTypes: wicketData.wicketTypes,
                    boundaryRunsPerWicket: (b.totalBoundaryRuns / wicketData.wickets).toFixed(2),
                    boundariesPerWicket: (b.totalBoundaries / wicketData.wickets).toFixed(2),
                    sixesPerWicket: (b.sixes / wicketData.wickets).toFixed(2),
                    foursPerWicket: (b.fours / wicketData.wickets).toFixed(2)
                });
            }
        });

        // Sort by boundary runs per wicket (highest first)
        combinedStats.sort((a, b) => parseFloat(b.boundaryRunsPerWicket) - parseFloat(a.boundaryRunsPerWicket));

        res.json(combinedStats);

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/match/bowlers-dismissals
router.get("/bowlers-dismissals", async (req, res) => {
    try {
        const { bowler, seriesId, season, format, bowlerType } = req.query;

        // Build match conditions
        const matchConditions = {
            "labels.wicketType": { $exists: true, $ne: null }
        };
        if (seriesId) matchConditions.seriesId = seriesId;
        if (season) matchConditions.season = season;
        if (format) matchConditions.format = format;
        if (bowlerType) matchConditions.bowlerType = bowlerType;
        if (bowler) matchConditions.bowler = { $regex: bowler, $options: "i" };

        const pipeline = [
            { $match: matchConditions },
            {
                $group: {
                    _id: {
                        bowler: "$bowler",
                        wicketType: "$labels.wicketType"
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: "$_id.bowler",
                    dismissals: {
                        $push: { wicketType: "$_id.wicketType", count: "$count" }
                    },
                    bowlerType: { $first: "$bowlerType" }
                }
            },
            {
                $project: {
                    bowler: "$_id",
                    counts: {
                        $arrayToObject: {
                            $map: {
                                input: "$dismissals",
                                as: "d",
                                in: { k: "$$d.wicketType", v: "$$d.count" }
                            }
                        }
                    },
                    bowlerType: 1,
                    total: { $sum: "$dismissals.count" }
                }
            },
            { $sort: { total: -1 } }
        ];

        const result = await Clip.aggregate(pipeline);
        res.json(result);
    } catch (error) {
        console.error("Error in bowlers-dismissals:", error);
        res.status(500).json({ error: error.message });
    }
});

// Add this to your routes file (e.g., routes/analytics.js or routes/match.js)

/**
 * GET /api/analytics/bowler-batsman-rivalry
 * Query parameters (all optional):
 *   - seriesId    : string, filter by series ID
 *   - season      : string, filter by season (e.g., "2026")
 *   - format      : string, filter by format (t20, odi, test)
 *   - minDismissals : number, minimum dismissals to include (default: 1)
 *   - bowler      : string, filter by bowler name (optional)
 *   - batsman     : string, filter by batsman name (optional)
 * 
 * Returns:
 *   [
 *     {
 *       bowler: "Jasprit Bumrah",
 *       batsman: "Andre Russell",
 *       count: 12,
 *       wicketTypes: {
 *         bowled: 3,
 *         caught: 7,
 *         lbw: 2,
 *         stumped: 0,
 *         runout: 0,
 *         caught_bowled: 0
 *       }
 *     },
 *     ...
 *   ]
 */
router.get("/bowler-batsman-rivalry", async (req, res) => {
    try {
        const {
            seriesId,
            season,
            format,
            league,
            minDismissals = 1,
            bowler,
            batsman
        } = req.query;

        // Build match conditions
        const matchConditions = {
            "labels.wicketType": { $exists: true, $ne: null },
            bowler: { $exists: true, $ne: null, $ne: "" },
            batsman: { $exists: true, $ne: null, $ne: "" }
        };

        if (seriesId) matchConditions.seriesId = seriesId;
        if (season) matchConditions.season = season;
        if (format) matchConditions.format = format;
        if (league) matchConditions.league = { $regex: new RegExp(`^${league}$`, 'i') };
        if (bowler) matchConditions.bowler = { $regex: bowler, $options: "i" };
        if (batsman) matchConditions.batsman = { $regex: batsman, $options: "i" };

        const pipeline = [
            // Step 1: Filter clips
            { $match: matchConditions },

            // Step 2: Group by bowler and batsman pair
            {
                $group: {
                    _id: {
                        bowler: "$bowler",
                        batsman: "$batsman"
                    },
                    count: { $sum: 1 },
                    wicketTypes: { $push: "$labels.wicketType" }
                }
            },

            // Step 3: Filter by minimum dismissals
            { $match: { count: { $gte: parseInt(minDismissals) } } },

            // Step 4: Calculate breakdown of wicket types
            {
                $project: {
                    bowler: "$_id.bowler",
                    batsman: "$_id.batsman",
                    count: 1,
                    wicketTypes: {
                        bowled: {
                            $size: {
                                $filter: {
                                    input: "$wicketTypes",
                                    as: "w",
                                    cond: { $eq: ["$$w", "bowled"] }
                                }
                            }
                        },
                        caught: {
                            $size: {
                                $filter: {
                                    input: "$wicketTypes",
                                    as: "w",
                                    cond: { $in: ["$$w", ["caught", "caught_bowled"]] }
                                }
                            }
                        },
                        lbw: {
                            $size: {
                                $filter: {
                                    input: "$wicketTypes",
                                    as: "w",
                                    cond: { $eq: ["$$w", "lbw"] }
                                }
                            }
                        },
                        stumped: {
                            $size: {
                                $filter: {
                                    input: "$wicketTypes",
                                    as: "w",
                                    cond: { $eq: ["$$w", "stumped"] }
                                }
                            }
                        },
                        runout: {
                            $size: {
                                $filter: {
                                    input: "$wicketTypes",
                                    as: "w",
                                    cond: { $eq: ["$$w", "runout"] }
                                }
                            }
                        },
                        caught_bowled: {
                            $size: {
                                $filter: {
                                    input: "$wicketTypes",
                                    as: "w",
                                    cond: { $eq: ["$$w", "caught_bowled"] }
                                }
                            }
                        },
                        hitwicket: {
                            $size: {
                                $filter: {
                                    input: "$wicketTypes",
                                    as: "w",
                                    cond: { $eq: ["$$w", "hitwicket"] }
                                }
                            }
                        }
                    }
                }
            },

            // Step 5: Sort by count (highest first)
            { $sort: { count: -1 } }
        ];

        const result = await Clip.aggregate(pipeline);
        res.json(result);

    } catch (error) {
        console.error("Error in /bowler-batsman-rivalry:", error);
        res.status(500).json({
            error: "Internal server error",
            message: error.message
        });
    }
});

// GET /api/match/batting-weakness - Works with partial data
router.get("/batting-weakness", async (req, res) => {
    try {
        const {
            seriesId,
            season,
            format,
            league,
            batsman,
            bowlerType,
            minDismissals = 2,
            type = "lengthType"
        } = req.query;

        // Build match conditions for WICKET events
        const matchConditions = {
            event: "WICKET",
            batsman: { $exists: true, $ne: null, $ne: "" }
        };

        if (seriesId) matchConditions.seriesId = seriesId;
        if (season) matchConditions.season = season;
        if (format) matchConditions.format = format;
        if (league) matchConditions.league = league;
        if (batsman) matchConditions.batsman = { $regex: batsman, $options: "i" };
        if (bowlerType) matchConditions.bowlerType = bowlerType;

        // Determine which field to analyze - DON'T filter out missing fields
        let fieldPath;
        if (type === "lengthType") {
            fieldPath = "$labels.lengthType";
        } else if (type === "direction") {
            fieldPath = "$labels.direction";
        } else if (type === "bowlerType") {
            fieldPath = "$bowlerType";
        } else {
            fieldPath = "$labels.lengthType";
        }

        const pipeline = [
            { $match: matchConditions },
            {
                $group: {
                    _id: {
                        batsman: "$batsman",
                        weakness: { $ifNull: [fieldPath, "unknown"] }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: "$_id.batsman",
                    weaknesses: {
                        $push: { type: "$_id.weakness", count: "$count" }
                    },
                    total: { $sum: "$count" }
                }
            },
            { $match: { total: { $gte: parseInt(minDismissals) } } },
            {
                $project: {
                    batsman: "$_id",
                    counts: {
                        $arrayToObject: {
                            $map: {
                                input: "$weaknesses",
                                as: "w",
                                in: { k: "$$w.type", v: "$$w.count" }
                            }
                        }
                    },
                    total: 1
                }
            },
            { $sort: { total: -1 } }
        ];

        const result = await Clip.aggregate(pipeline);

        // If no results and type is ballType, suggest trying lengthType
        if (result.length === 0 && type === "ballType") {
            console.log("No ball type data found. Try using lengthType instead.");
        }

        res.json(result);

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/boundaries-by-area
// GET /api/analytics/boundaries-by-area
router.get("/boundaries-by-area", async (req, res) => {
    try {
        const { batsman, seriesId, season, format, league, bowlerType, bowlerHand } = req.query;

        const matchConditions = {
            batsman: { $exists: true, $ne: null, $ne: "" },
            event: { $regex: /BOUNDARY|FOUR|SIX/i },
            "labels.direction": { $exists: true, $ne: null, $ne: "" }
        };

        if (batsman) matchConditions.batsman = { $regex: batsman, $options: "i" };
        if (seriesId) matchConditions.seriesId = seriesId;
        if (season) matchConditions.season = season;
        if (format) matchConditions.format = format;
        if (league) matchConditions.league = league;
        if (bowlerType) matchConditions.bowlerType = bowlerType;
        if (bowlerHand) matchConditions.bowlingHand = bowlerHand;

        // Load direction synonyms from your JSON file
        const directionSynonyms = cricketSynonyms.direction || {};

        // Build reverse mapping: all synonym variations -> main category
        const directionMap = {};
        for (const [category, synonyms] of Object.entries(directionSynonyms)) {
            // Add the main category name itself
            directionMap[category.toLowerCase()] = category;
            // Add all synonyms
            if (Array.isArray(synonyms)) {
                for (const syn of synonyms) {
                    directionMap[syn.toLowerCase()] = category;
                }
            }
        }

        const pipeline = [
            { $match: matchConditions },
            {
                $addFields: {
                    isSix: { $regexMatch: { input: { $toLower: "$event" }, regex: "six" } },
                    isFour: { $regexMatch: { input: { $toLower: "$event" }, regex: "four" } },
                    directionLower: { $toLower: "$labels.direction" },
                    // Map direction to category using your synonyms
                    mappedCategory: {
                        $let: {
                            vars: {
                                matchedCategory: {
                                    $getField: {
                                        field: { $toLower: "$labels.direction" },
                                        input: directionMap
                                    }
                                }
                            },
                            in: { $ifNull: ["$$matchedCategory", "other"] }
                        }
                    }
                }
            },
            // Group and project (same as before, but use mappedCategory)
            {
                $group: {
                    _id: {
                        batsman: "$batsman",
                        area: "$mappedCategory",
                        isSix: "$isSix"
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: {
                        batsman: "$_id.batsman",
                        area: "$_id.area"
                    },
                    fours: { $sum: { $cond: [{ $eq: ["$_id.isSix", false] }, "$count", 0] } },
                    sixes: { $sum: { $cond: ["$_id.isSix", "$count", 0] } },
                    totalBoundaries: { $sum: "$count" }
                }
            },
            {
                $group: {
                    _id: "$_id.batsman",
                    areas: { $push: { area: "$_id.area", fours: "$fours", sixes: "$sixes", totalBoundaries: "$totalBoundaries" } },
                    totalBoundaries: { $sum: "$totalBoundaries" },
                    totalFours: { $sum: "$fours" },
                    totalSixes: { $sum: "$sixes" }
                }
            },
            {
                $project: {
                    batsman: "$_id",
                    totalBoundaries: 1,
                    totalFours: 1,
                    totalSixes: 1,
                    totalRuns: { $add: [{ $multiply: ["$totalFours", 4] }, { $multiply: ["$totalSixes", 6] }] },
                    areas: {
                        $map: {
                            input: "$areas",
                            as: "area",
                            in: {
                                area: "$$area.area",
                                fours: "$$area.fours",
                                sixes: "$$area.sixes",
                                totalBoundaries: "$$area.totalBoundaries",
                                totalRuns: { $add: [{ $multiply: ["$$area.fours", 4] }, { $multiply: ["$$area.sixes", 6] }] },
                                percentageOfBoundaries: {
                                    $round: [{ $multiply: [{ $divide: ["$$area.totalBoundaries", "$totalBoundaries"] }, 100] }, 1]
                                }
                            }
                        }
                    }
                }
            },
            { $sort: { totalBoundaries: -1 } }
        ];

        const result = await Clip.aggregate(pipeline);
        res.json(result);

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/batsman-hand-type-weakness
router.get("/batsman-hand-type-weakness", async (req, res) => {
    try {
        const { batsman, seriesId, bowlerType, battingHand, bowlingHand, season, format, league, minBalls = 10 } = req.query;

        const matchConditions = {
            batsman: { $exists: true, $ne: null, $ne: "" },
            bowler: { $exists: true, $ne: null, $ne: "" },
            battingHand: { $exists: true, $ne: null, $ne: "" },
            bowlingHand: { $exists: true, $ne: null, $ne: "" },
            bowlerType: { $exists: true, $ne: null, $ne: "" }
        };

        if (batsman) matchConditions.batsman = { $regex: batsman, $options: "i" };
        if (seriesId) matchConditions.seriesId = seriesId;
        if (season) matchConditions.season = season;
        if (format) matchConditions.format = format;
        if (league) matchConditions.league = league;
        if (bowlerType) matchConditions.bowlerType = bowlerType;
        if (battingHand) matchConditions.battingHand = battingHand;
        if (bowlingHand) matchConditions.bowlingHand = bowlingHand;

        const pipeline = [
            { $match: matchConditions },
            {
                $addFields: {
                    // Calculate runs from event
                    runs: {
                        $switch: {
                            branches: [
                                { case: { $regexMatch: { input: "$event", regex: /six/i } }, then: 6 },
                                { case: { $regexMatch: { input: "$event", regex: /four/i } }, then: 4 }
                            ],
                            default: 0
                        }
                    },
                    isWicket: {
                        $cond: [
                            { $regexMatch: { input: "$event", regex: /wicket/i } },
                            1,
                            0
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: {
                        batsman: "$batsman",
                        bowlerHand: "$bowlingHand",
                        bowlerType: "$bowlerType"
                    },
                    deliveries: { $sum: 1 },
                    runs: { $sum: "$runs" },
                    wickets: { $sum: "$isWicket" },
                    boundaries: {
                        $sum: {
                            $cond: [
                                { $regexMatch: { input: "$event", regex: /four|six|boundary/i } },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {
                $match: {
                    deliveries: { $gte: parseInt(minBalls) }
                }
            },
            {
                $project: {
                    batsman: "$_id.batsman",
                    bowlerHand: "$_id.bowlerHand",
                    bowlerType: "$_id.bowlerType",
                    deliveries: 1,
                    runs: 1,
                    wickets: 1,
                    boundaries: 1,
                    average: {
                        $cond: [
                            { $eq: ["$wickets", 0] },
                            "$runs",
                            { $divide: ["$runs", "$wickets"] }
                        ]
                    },
                    strikeRate: {
                        $cond: [
                            { $eq: ["$deliveries", 0] },
                            0,
                            { $multiply: [{ $divide: ["$runs", "$deliveries"] }, 100] }
                        ]
                    },
                    boundaryPercentage: {
                        $multiply: [{ $divide: ["$boundaries", "$deliveries"] }, 100]
                    }
                }
            },
            {
                $group: {
                    _id: "$batsman",
                    categories: {
                        $push: {
                            bowlerHand: "$bowlerHand",
                            bowlerType: "$bowlerType",
                            deliveries: "$deliveries",
                            runs: "$runs",
                            wickets: "$wickets",
                            average: { $round: ["$average", 2] },
                            strikeRate: { $round: ["$strikeRate", 2] },
                            boundaryPercentage: { $round: ["$boundaryPercentage", 2] }
                        }
                    },
                    totalDeliveries: { $sum: "$deliveries" },
                    totalRuns: { $sum: "$runs" },
                    totalWickets: { $sum: "$wickets" }
                }
            },
            {
                $project: {
                    batsman: "$_id",
                    categories: 1,
                    overallAverage: {
                        $cond: [
                            { $eq: ["$totalWickets", 0] },
                            "$totalRuns",
                            { $divide: ["$totalRuns", "$totalWickets"] }
                        ]
                    },
                    overallStrikeRate: {
                        $multiply: [{ $divide: ["$totalRuns", "$totalDeliveries"] }, 100]
                    }
                }
            },
            { $sort: { batsman: 1 } }
        ];

        const result = await Clip.aggregate(pipeline);
        res.json(result);

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/bowler-hand-type-weakness
router.get("/bowler-hand-type-weakness", async (req, res) => {
    try {
        const {
            bowler,
            seriesId,
            season,
            format,
            league,
            battingHand,  // filter by batsman's hand (left/right)
            minBalls = 10
        } = req.query;

        const matchConditions = {
            bowler: { $exists: true, $ne: null, $ne: "" },
            batsman: { $exists: true, $ne: null, $ne: "" },
            battingHand: { $exists: true, $ne: null, $ne: "" },
            bowlingHand: { $exists: true, $ne: null, $ne: "" },
            event: { $exists: true, $ne: null, $ne: "" }
        };

        if (bowler) matchConditions.bowler = { $regex: bowler, $options: "i" };
        if (seriesId) matchConditions.seriesId = seriesId;
        if (season) matchConditions.season = season;
        if (format) matchConditions.format = format;
        if (league) matchConditions.league = league;
        if (battingHand) matchConditions.battingHand = battingHand;

        const pipeline = [
            { $match: matchConditions },
            {
                $addFields: {
                    // Extract runs from 'event' field
                    runs: {
                        $switch: {
                            branches: [
                                { case: { $regexMatch: { input: "$event", regex: /six|6 runs?/i } }, then: 6 },
                                { case: { $regexMatch: { input: "$event", regex: /four|4 runs?/i } }, then: 4 },
                                { case: { $regexMatch: { input: "$event", regex: /3 runs?/i } }, then: 3 },
                                { case: { $regexMatch: { input: "$event", regex: /2 runs?/i } }, then: 2 },
                                { case: { $regexMatch: { input: "$event", regex: /1 run/ } }, then: 1 }
                            ],
                            default: 0
                        }
                    },
                    // Detect wicket (excluding dropped catches)
                    isWicket: {
                        $and: [
                            { $not: { $regexMatch: { input: "$event", regex: /dropped/i } } },
                            { $regexMatch: { input: "$event", regex: /wicket|caught|bowled|lbw|stumped|run out/i } }
                        ]
                    },
                    // Detect boundary
                    isBoundary: {
                        $regexMatch: { input: "$event", regex: /four|six|4 runs?|6 runs?/i }
                    }
                }
            },
            {
                $group: {
                    _id: {
                        bowler: "$bowler",
                        battingHand: "$battingHand"
                    },
                    deliveries: { $sum: 1 },
                    runs: { $sum: "$runs" },
                    wickets: { $sum: { $cond: ["$isWicket", 1, 0] } },
                    boundaries: { $sum: { $cond: ["$isBoundary", 1, 0] } }
                }
            },
            {
                $match: {
                    deliveries: { $gte: parseInt(minBalls) }
                }
            },
            {
                $project: {
                    bowler: "$_id.bowler",
                    battingHand: "$_id.battingHand",
                    deliveries: 1,
                    runs: 1,
                    wickets: 1,
                    boundaries: 1,
                    average: {
                        $cond: [
                            { $eq: ["$wickets", 0] },
                            "$runs",
                            { $divide: ["$runs", "$wickets"] }
                        ]
                    },
                    economy: {
                        $multiply: [{ $divide: ["$runs", "$deliveries"] }, 6]
                    },
                    strikeRate: {
                        $cond: [
                            { $eq: ["$wickets", 0] },
                            0,
                            { $multiply: [{ $divide: ["$deliveries", "$wickets"] }, 100] }
                        ]
                    },
                    boundaryPercentage: {
                        $multiply: [{ $divide: ["$boundaries", "$deliveries"] }, 100]
                    }
                }
            },
            {
                $group: {
                    _id: "$bowler",
                    categories: {
                        $push: {
                            battingHand: "$battingHand",
                            deliveries: "$deliveries",
                            runs: "$runs",
                            wickets: "$wickets",
                            average: { $round: ["$average", 2] },
                            economy: { $round: ["$economy", 2] },
                            strikeRate: { $round: ["$strikeRate", 2] },
                            boundaryPercentage: { $round: ["$boundaryPercentage", 2] }
                        }
                    },
                    totalDeliveries: { $sum: "$deliveries" },
                    totalRuns: { $sum: "$runs" },
                    totalWickets: { $sum: "$wickets" }
                }
            },
            {
                $project: {
                    bowler: "$_id",
                    categories: 1,
                    overallAverage: {
                        $cond: [
                            { $eq: ["$totalWickets", 0] },
                            "$totalRuns",
                            { $divide: ["$totalRuns", "$totalWickets"] }
                        ]
                    },
                    overallEconomy: {
                        $multiply: [{ $divide: ["$totalRuns", "$totalDeliveries"] }, 6]
                    },
                    overallStrikeRate: {
                        $cond: [
                            { $eq: ["$totalWickets", 0] },
                            0,
                            { $multiply: [{ $divide: ["$totalDeliveries", "$totalWickets"] }, 100] }
                        ]
                    }
                }
            },
            { $sort: { bowler: 1 } }
        ];

        const result = await Clip.aggregate(pipeline);
        res.json(result);

    } catch (error) {
        console.error("Error in bowler-hand-type-weakness:", error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/runouts
router.get("/runouts", async (req, res) => {
    try {
        const { seriesId, season, format, league, player, minRunouts = 0 } = req.query;

        const matchConditions = {
            "labels.runout": true,
            "labels.runoutBy": { $exists: true, $ne: "" }
        };
        if (seriesId) matchConditions.seriesId = seriesId;
        if (season) matchConditions.season = season;
        if (format) matchConditions.format = format;
        if (league) matchConditions.league = league;
        if (player) matchConditions["labels.runoutBy"] = { $regex: player, $options: "i" };

        const pipeline = [
            { $match: matchConditions },
            {
                $group: {
                    _id: "$labels.runoutBy",
                    runouts: { $sum: 1 },
                    matches: { $addToSet: "$matchId" },
                    uniqueBatsmen: { $addToSet: "$batsman" }   // who they ran out
                }
            },
            {
                $match: {
                    runouts: { $gte: parseInt(minRunouts) }
                }
            },
            {
                $project: {
                    player: "$_id",
                    runouts: 1,
                    matches: { $size: "$matches" },
                    uniqueBatsmen: { $size: "$uniqueBatsmen" },
                    runoutsPerMatch: { $divide: ["$runouts", { $size: "$matches" }] }
                }
            },
            { $sort: { runouts: -1 } }
        ];

        const result = await Clip.aggregate(pipeline);
        res.json(result);

    } catch (error) {
        console.error("Error in runouts:", error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/partnerships
router.get("/partnerships", async (req, res) => {
    try {
        const {
            batsman,
            seriesId,
            season,
            format,
            league,
            minRuns = 0,
            minBalls = 0,
            limit = 100
        } = req.query;
        console.log(req.query, "qury")
        // Build match conditions for filtering
        const matchConditions = {};
        if (seriesId) matchConditions.seriesId = seriesId.toString();
        if (season) matchConditions.season = season;
        if (format) matchConditions.format = format;
        if (league) matchConditions.league = league;

        // First, get matching matchIds from MatchLiveDetails
        let matchIds = [];
        if (Object.keys(matchConditions).length > 0) {
            console.log(matchConditions, "conditions")
            const matches = await MatchLiveDetails.find(matchConditions);
            console.log(matches.length)
            matchIds = matches.map(m => m.matchId);
            if (matchIds.length === 0) return res.json([]);
        }

        // Build partnership aggregation pipeline
        console.log(matchIds, "ids")
        const pipeline = [
            // Optionally filter by matchIds
            ...(matchIds.length > 0 ? [{ $match: { matchId: { $in: matchIds } } }] : []),
            { $unwind: "$partnerships" },
            // Filter by batsman (if provided)
            ...(batsman ? [{ $match: { "partnerships.batsmen": { $regex: batsman, $options: "i" } } }] : []),
            {
                $match: {
                    "partnerships.runs": { $gte: parseInt(minRuns) },
                    "partnerships.balls": { $gte: parseInt(minBalls) }
                }
            },
            { $sort: { "partnerships.runs": -1 } },
            { $limit: parseInt(limit) },
            // Lookup match details
            {
                $lookup: {
                    from: "matchlivedetails",
                    localField: "matchId",
                    foreignField: "matchId",
                    as: "match"
                }
            },
            { $unwind: { path: "$match", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    matchId: 1,
                    innings: 1,
                    partnership: "$partnerships",
                    match: {
                        teamHomeCode: 1,
                        teamAwayCode: 1,
                        format: 1,
                        season: 1,
                        league: 1,
                        seriesId: 1,
                        date: 1
                    }
                }
            }
        ];

        const result = await partnership.aggregate(pipeline);
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/partnership-clips
router.get("/partnership-clipsu", async (req, res) => {
    try {
        const { matchId, batsman1, batsman2, innings } = req.query;
        const conditions = {
            matchId: matchId,
            batsman: { $in: [batsman1, batsman2] }
        };
        if (innings) conditions.innings = parseInt(innings);
        const clips = await Clip.find(conditions)
            .sort({ over: 1, _id: 1 })
            .limit(100)
            .lean();
        res.json(clips);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/analytics/partnerships
router.get("/partnership-clips", async (req, res) => {
    try {
        const { batsman, seriesId, season, format, league, minRuns, minBalls } = req.query;

        const pipeline = [];

        // 1. Unwind the partnerships array (create one doc per partnership)
        pipeline.push({ $unwind: "$partnerships" });

        // 2. Optional: filter by batsman (case‑insensitive)
        if (batsman && batsman !== "") {
            pipeline.push({
                $match: {
                    $or: [
                        { "partnerships.batsmen.0": { $regex: batsman, $options: "i" } },
                        { "partnerships.batsmen.1": { $regex: batsman, $options: "i" } }
                    ]
                }
            });
        }

        // 3. Lookup match details
        pipeline.push({
            $lookup: {
                from: "matches",          // your Match collection name
                localField: "matchId",
                foreignField: "matchId",
                as: "matchInfo"
            }
        });

        pipeline.push({ $unwind: { path: "$matchInfo", preserveNullAndEmptyArrays: false } });

        // 4. Apply match filters (seriesId, season, format, league)
        const matchFilters = {};
        if (seriesId && seriesId !== "all") matchFilters["matchInfo.seriesId"] = seriesId;
        if (season && season !== "") matchFilters["matchInfo.season"] = season;
        if (format && format !== "") matchFilters["matchInfo.format"] = format;
        if (league && league !== "") matchFilters["matchInfo.league"] = league;

        if (Object.keys(matchFilters).length > 0) {
            pipeline.push({ $match: matchFilters });
        }

        // 5. Apply runs and balls filters
        pipeline.push({
            $match: {
                "partnerships.runs": { $gte: parseInt(minRuns) || 0 },
                "partnerships.balls": { $gte: parseInt(minBalls) || 0 }
            }
        });

        // 6. Add vs field and reorganize the output
        pipeline.push({
            $addFields: {
                vs: {
                    $concat: [
                        { $ifNull: ["$matchInfo.teamHomeCode", "?"] },
                        " vs ",
                        { $ifNull: ["$matchInfo.teamAwayCode", "?"] }
                    ]
                },
                match: {
                    teamHomeCode: "$matchInfo.teamHomeCode",
                    teamAwayCode: "$matchInfo.teamAwayCode",
                    format: "$matchInfo.format",
                    date: "$matchInfo.date",
                    seriesId: "$matchInfo.seriesId",
                    season: "$matchInfo.season"
                },
                // Rename partnership sub‑field to "partnership" (singular) for frontend convenience
                partnership: "$partnerships"
            }
        });

        // 7. Optional: remove fields you don't need
        pipeline.push({
            $project: {
                partnerships: 0,       // remove the original array
                matchInfo: 0          // remove the raw lookup data
            }
        });

        // 8. Sort and limit
        pipeline.push(
            { $sort: { "partnership.runs": -1 } },
            { $limit: 500 }
        );

        const partnerships = await partnership.aggregate(pipeline);
        res.json(partnerships);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
module.exports = router;