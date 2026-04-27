const mongoose = require("mongoose");

const clipSchema = new mongoose.Schema({
  over: String,
  commentary: String,
  event: String,
  subEvent: String,
  clip: String,
  batsman: String,
  bowler: String,
  shotType: String,
  bowlerType: { type: String, default: "" },
  battingHand: { type: String, default: "" },
  bowlingHand: { type: String, default: "" },
  batting_team: String,
  bowling_team: String,
  matchType: String,
  series: String,
  seriesId: String,
  matchId: String,
  format: String,
  league: String,
  season: String,
  duration: Number,
  embedding: {
    type: [Number],   // vector stored here
    default: undefined,
  },
  reported: { type: Boolean, default: false }, // simple true/false
  flag: {
    isFlagged: { type: Boolean, default: false },
    reason: { type: String, trim: true }, // e.g. label_conflict, video_mismatch, manual
    details: { type: String, trim: true }, // optional free-text info
    conflictFields: [{ type: String, trim: true }], // which label fields conflicted
    flaggedAt: { type: Date },
    reviewStatus: {
      type: String,
      enum: ["pending", "fixed", "dismissed"],
      default: "pending",
    },
    reviewedAt: { type: Date },
    reviewNotes: { type: String, trim: true },
  },
  conditionsCount: { type: Number, default: 0 },
  passesTwoConditions: { type: Boolean, default: false },
  hasAnyDuplicate: { type: Boolean, default: false },
  duplicateDetails: {
    shotType: [String],
    direction: [String],
    ballType: [String],
    lengthType: [String]
  },
  labels: {
    shotType: { type: String },
    direction: { type: String },
    ballType: { type: String },
    lengthType: { type: String },
    connection: { type: String },
    slowball: { type: String },
    lofted: { type: Boolean, default: false },
    comesDown: { type: String },
    powerplay: { type: String },
    dropped: { type: Boolean, default: false },
    droppedBy: { type: String, default: '' },
    runout: { type: Boolean, default: false },
    runoutBy: { type: String, default: '' },
    catch: { type: Boolean, default: false },
    catchBy: { type: String, default: '' },
    stumpedBy: { type: String, default: '' },
    shotElevation: { type: String, default: '' },
    variation: { type: String, default: 'normal', enum: ['normal', 'slow', 'fast'] },
    wicketType: { type: String, enum: ['bowled', 'caught', 'caught_bowled', 'runout', 'stumped', 'lbw', 'hitwicket', 'obstructingthefield', 'retiredhurt', 'timedout', 'keeperCatch'] }
  },
  createdAt: { type: Date, default: Date.now }
});

const Clip = mongoose.model("Clip", clipSchema);
module.exports = Clip;
