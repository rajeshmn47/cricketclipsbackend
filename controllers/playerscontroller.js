const express = require("express");
const Matches = require("../models/match");
const LiveMatches = require("../models/matchlive");
const CricketTeam = require("../models/cricketteam");
const Players = require("../models/players");
const { capitalize } = require("../utils/capitalize");
const Squad = require("../models/squad");
const Clip = require("../models/clips");
const Player = require("../models/players");
const router = express.Router();

router.get("/getplayers/:id", async (req, res) => {
  // const matchdetails = await MatchLiveDetails.findOne({ matchId: req.params.id });
  const livedetails = await LiveMatches.findOne({ matchId: req.params.id });
  const matchdetails = await Matches.findOne({ matchId: req.params.id });
  console.log(matchdetails, 'line 12');
  if (livedetails) {
    let data = {};
    livedetails.teamHomePlayers = livedetails.teamHomePlayers;
    data = {
      ...livedetails._doc,
      teamHomeCode: matchdetails.teamHomeCode,
      teamAwayCode: matchdetails.teamAwayCode,
    };
    matchdetails.teamAwayPlayers = livedetails.teamAwayPlayers;
    res.status(200).json({
      players: livedetails,
      matchdetails: data,
      live: true,
    });
  } else if (matchdetails) {
    res.status(200).json({
      players: matchdetails,
      matchdetails,
      live: false,
    });
  }
});

router.get("/getplayers_new/:id", async (req, res) => {
  // const matchdetails = await MatchLiveDetails.findOne({ matchId: req.params.id });
  const livedetails = await LiveMatches.findOne({ matchId: req.params.id });
  const matchdetails = await Matches.findOne({ matchId: req.params.id });
  let th = await Squad.findOne({ teamId: matchdetails?.teamHomeId, seriesId: parseInt(matchdetails?.seriesId) })
  let ta = await Squad.findOne({ teamId: matchdetails?.teamAwayId, seriesId: matchdetails?.seriesId })
  console.log(matchdetails?.teamHomeId, th, 'line 12');
  if (livedetails) {
    let data = {};
    livedetails.teamHomePlayers = livedetails.teamHomePlayers;
    data = {
      ...livedetails._doc,
      teamHomeCode: matchdetails.teamHomeCode,
      teamAwayCode: matchdetails.teamAwayCode,
    };
    matchdetails.teamAwayPlayers = livedetails.teamAwayPlayers;
    res.status(200).json({
      players: livedetails,
      matchdetails: data,
      live: true,
    });
  } else if (matchdetails && th?.players?.length) {
    matchdetails.teamHomePlayers = th.players;
    matchdetails.teamAwayPlayers = ta.players;
    res.status(200).json({
      players: matchdetails,
      matchdetails,
      live: false,
    });
  }
  else {
    res.status(200).json({
      players: matchdetails,
      matchdetails,
      live: false,
    });
  }
});

router.get("/getplayersom/:id", async (req, res) => {
  // const matchdetails = await MatchLiveDetails.findOne({ matchId: req.params.id });
  const matchdetails = await Matches.findOne({ matchId: req.params.id });
  res.status(200).json({
    players: matchdetails,
    matchdetails,
    live: false,
  });
});

router.get("/getteam/:homeid/:awayid", async (req, res) => {
  console.log(req.params, "params");
  //const allmatches = await MatchLiveDetails.find();
  const homematch = await LiveMatches.find({
    teamHomeId: req.params.homeid
  },
  ).sort({ date: -1 })
  const homematch1 = await LiveMatches.find({
    teamHomeId: req.params.awayid
  },
  ).sort({ date: -1 })
  const awaymatch = await LiveMatches.find({
    teamAwayId: req.params.awayid
  },
  ).sort({ date: -1 })
  const awaymatch1 = await LiveMatches.find({
    teamAwayId: req.params.homeid
  },
  ).sort({ date: -1 })
  let ho = [];
  let aw = [];
  let x = [];
  let y = [];

  if (homematch[0]?.date > awaymatch1[0]?.date) {
    if (homematch[0]?.teamHomePlayers.length > 0) {
      ho = homematch[0]?.teamHomePlayers;
    }
  } else {
    if (awaymatch1[0]?.teamAwayPlayers.length > 0) {
      aw = awaymatch1[0]?.teamAwayPlayers
    }
  }

  if (awaymatch[0]?.date > homematch1[0]?.date) {
    if (awaymatch[0]?.teamAwayPlayers.length > 0) {
      x = awaymatch[0]?.teamAwayPlayers;
    }
  } else {
    if (homematch1[0]?.teamHomePlayers.length > 0) {
      y = homematch1[0]?.teamHomePlayers;
    }
  }
  let lmplayers = []
  let lmplayersdata = ho?.slice(0, 11).concat(aw?.slice(0, 11)).concat(x?.slice(0, 11)).concat(y?.slice(0, 11))
  if (lmplayersdata?.length > 0) {
    lmplayers = lmplayersdata
  }
  res.status(200).json({
    lmplayers: lmplayers,
    h: ho,
    h1: aw,
    a: x,
    a1: y
  });
});

router.get("/getplayers", async (req, res) => {
  console.log("getplayers");
  const players = await Players.find();
  res.status(200).json({
    players,
  });
});

// Helper to auto‑compute role (same as frontend)
function computeRole(battingHand, bowlingHand, bowlerType) {
  if (bowlingHand && bowlerType && bowlerType !== 'none') return 'Bowler';
  if (battingHand && !bowlingHand) return 'Batsman';
  if (battingHand && bowlingHand) return 'All-rounder';
  return 'Unknown';
}

// GET /api/players/all_players?inClips=true&league=IPL
router.get("/players/all_players", async (req, res) => {
  try {
    const { inClips, league } = req.query;

    // 1. If league is specified, get all team IDs for that league
    let leagueTeamIds = [];
    if (league) {
      const teams = await CricketTeam.find({ league }).select("id").lean();
      leagueTeamIds = teams.map(t => t.id.toString());
    }

    // 2. Build the player query: if league, filter by teamIds
    let playerQuery = {};
    if (league && leagueTeamIds.length) {
      playerQuery.teamIds = { $in: leagueTeamIds };
    }
    let players = await Players.find(playerQuery).sort({ name: 1 }).lean();

    if (inClips === "true") {
      // 3. Build clip filter: if league, only consider clips with that league
      const clipFilter = league ? { league } : {};

      // 4. Get distinct batsman & bowler names from filtered clips
      const batsmen = await Clip.distinct("batsman", clipFilter);
      const bowlers = await Clip.distinct("bowler", clipFilter);

      const batsmanSet = new Set(batsmen.map(n => n?.trim().toLowerCase()).filter(Boolean));
      const bowlerSet = new Set(bowlers.map(n => n?.trim().toLowerCase()).filter(Boolean));

      // 5. Filter players who appear in any of those clips
      players = players.filter(p =>
        batsmanSet.has(p.name?.trim().toLowerCase()) ||
        bowlerSet.has(p.name?.trim().toLowerCase())
      );

      // 6. For each player, decide if they are pure batsman/bowler in THIS LEAGUE
      players = players.map(p => {
        const pName = p.name?.trim().toLowerCase();
        const isBatsman = batsmanSet.has(pName);
        const isBowler = bowlerSet.has(pName);
        const plain = { ...p }; // already lean, so create a copy

        if (isBatsman && !isBowler) {
          // Pure batsman – bowling not required in this league
          if (!plain.bowlingHand) plain.bowlingHand = "none";
          if (!plain.bowlerType) plain.bowlerType = "none";
        }
        else if (!isBatsman && isBowler) {
          // Pure bowler – batting not required in this league
          if (!plain.battingHand) plain.battingHand = "none";
        }
        // All-rounders (both true) – leave fields as they are (could be missing)

        plain.isBatsman = isBatsman;
        plain.isBowler = isBowler;
        return plain;
      });
    }

    res.status(200).json(players);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/players – create a new player
router.post("/players/create", async (req, res) => {
  try {
    const { playerName, battingHand, bowlingHand, bowlerType } = req.body;
    if (!playerName) {
      return res.status(400).json({ message: "Player name is required" });
    }
    const role = computeRole(battingHand, bowlingHand, bowlerType);
    const newPlayer = new Players({
      playerName,
      battingHand: battingHand || "",
      bowlingHand: bowlingHand || "",
      bowlerType: bowlerType || "",
      role,
    });
    const saved = await newPlayer.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
});

router.put("/players/:id", async (req, res) => {
  try {
    const { battingHand, bowlingHand, bowlerType } = req.body;
    const update = {};
    if (battingHand !== undefined) update.battingHand = battingHand;
    if (bowlingHand !== undefined) update.bowlingHand = bowlingHand;
    if (bowlerType !== undefined) update.bowlerType = bowlerType;

    const updated = await Player.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/players/:id – delete a player
router.delete("/players/:id", async (req, res) => {
  try {
    const deleted = await Players.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Player not found" });
    }
    res.status(200).json({ message: "Player deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /players/missing-hands?league=IPL
router.get("/players/missing-hands", async (req, res) => {
  try {
    const { league } = req.query;
    const clipFilter = league ? { league } : {};

    // Get all distinct batsmen and bowlers from clips
    const batsmen = await Clip.distinct("batsman", clipFilter);
    const bowlers = await Clip.distinct("bowler", clipFilter);

    // Helper to get player and check missing fields
    const result = { batsmen: [], bowlers: [] };

    for (const name of batsmen) {
      const player = await Player.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
      if (player && !player.battingHand) {
        const count = await Clip.countDocuments({ batsman: name, ...clipFilter });
        result.batsmen.push({
          _id: player._id,
          name: player.name,
          battingHand: player.battingHand || "",
          count
        });
      }
    }

    for (const name of bowlers) {
      const player = await Players.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
      if (player && (!player.bowlingHand || !player.bowlerType)) {
        const count = await Clip.countDocuments({ bowler: name, ...clipFilter });
        result.bowlers.push({
          _id: player._id,
          name: player.name,
          bowlingHand: player.bowlingHand || "",
          bowlerType: player.bowlerType || "",
          count
        });
      }
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
