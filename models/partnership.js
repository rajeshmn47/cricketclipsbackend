// models/partnership.js
const mongoose = require('mongoose');

const partnershipSchema = new mongoose.Schema({
    matchId: { type: String, required: true },
    innings: { type: Number, required: true },
    partnerships: [{
        partnershipNumber: { type: Number, required: true },
        batsmen: [{ type: String, required: true }],   // two names (sorted)
        runs: { type: Number, default: 0 },
        balls: { type: Number, default: 0 },
        startOver: { type: String },
        endOver: { type: String },
        howOut: { type: String, default: 'not out' }
    }]
}, { timestamps: true });

// Compound unique index
partnershipSchema.index({ matchId: 1, innings: 1 }, { unique: true });

module.exports = mongoose.model('Partnership', partnershipSchema);