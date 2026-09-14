const Clip = require("../models/clips");
const cricketSynonyms = require("../utils/cricket_synonyms.json");
const exclusionMap = require("../utils/exclusion_map.json");

/**
 * Generate labels for all clips of a match based on their commentary.
 * @param {string} matchId - The match ID to process.
 * @param {boolean} force - If true, regenerate labels even if they exist.
 */
async function generateLabelsMatch(matchId, force = false) {
    console.log(`🏷️  Generating labels for match: ${matchId}`);

    // 1. Fetch all clips for this match
    const clips = await Clip.find({ matchId });

    if (!clips.length) {
        console.log(`⚠️  No clips found for match ${matchId}`);
        return { success: false, updated: 0 };
    }

    let updated = 0;
    let skipped = 0;

    for (const clip of clips) {
        const commentary = (clip.commentary || "").toLowerCase();

        // Skip if labels already exist (unless force is true)
        if (!force && clip.labels && Object.values(clip.labels).some(v => v)) {
            skipped++;
            continue;
        }

        // Build the new labels object
        const labels = {
            shotType: detectShotType(commentary),
            ballType: detectBallType(commentary),
            lengthType: detectLengthType(commentary),
            direction: detectDirection(commentary),
            connection: detectConnection(commentary),
            variation: detectVariation(commentary),
            shotElevation: detectShotElevation(commentary),
            lofted: detectLofted(commentary),
            comesDown: detectComesDown(commentary),
            powerplay: detectPowerplay(clip.over, matchId),
            dropped: detectDropped(commentary),
            droppedBy: detectFielder(commentary, "dropped"),
            runout: detectRunout(commentary),
            runoutBy: detectFielder(commentary, "runout"),
            catch: detectCatch(commentary),
            catchBy: detectFielder(commentary, "catch"),
            stumpedBy: detectFielder(commentary, "stumped"),
            wicketType: detectWicketType(commentary, clip.event),
        };

        // Update clip in DB
        clip.labels = labels;
        await clip.save();
        updated++;
    }

    console.log(`✅ Labels generated: ${updated} updated, ${skipped} skipped`);
    return { success: true, updated, skipped, total: clips.length };
}

// ------------------------------------------------------------
// 🎯 Detection helpers
// ------------------------------------------------------------

/**
 * Detects shot type by matching commentary against synonyms.
 * e.g., "cover drive", "pull shot", "sweep"
 */
function detectShotType(commentary) {
    const shotMap = {
        cover_drive: ["cover drive", "driven through cover", "covers"],
        straight_drive: ["straight drive", "down the ground", "straight"],
        on_drive: ["on drive", "through mid wicket"],
        off_drive: ["off drive", "through extra cover"],
        square_drive: ["square drive", "square of the wicket"],
        pull: ["pull", "pulled"],
        hook: ["hook", "hooked"],
        cut: ["cut", "cut shot", "cutting"],
        upper_cut: ["upper cut", "upper-cut"],
        sweep: ["swept", "sweep", "sweeping"],
        reverse_sweep: ["reverse sweep", "reverse-swept"],
        paddle_sweep: ["paddle sweep", "paddle-sweep"],
        switch_hit: ["switch hit", "switch-hit"],
        helicopter_shot: ["helicopter shot", "helicopter"],
        glance: ["glance", "glanced", "glancing"],
        flick: ["flick", "flicked", "flicking"],
        dab: ["dab", "dabbed"],
        defensive_shot: ["defended", "defensive", "blocked", "block"],
        reverse_hit: ["reverse hit", "reverse-hit"],
        scoop: ["scoop", "scooped"],
        ramp_shot: ["ramp", "ramped"],
        uppercut: ["uppercut"],
        inside_out: ["inside out", "inside-out"],
    };

    return matchFirst(commentary, shotMap);
}

/**
 * Detects ball type.
 */
function detectBallType(commentary) {
    const ballMap = {
        yorker: ["yorker", "yorked"],
        full_toss: ["full toss", "full-toss"],
        good_length: ["good length", "good-length"],
        short_of_length: ["short of length", "short of a length"],
        bouncer: ["bouncer", "bounched", "short ball"],
        slow_ball: ["slow ball", "slowball", "slower ball"],
        off_cutter: ["off cutter", "off-cutter"],
        leg_cutter: ["leg cutter", "leg-cutter"],
        slower_bouncer: ["slower bouncer"],
        wide: ["wide", "wide ball"],
        no_ball: ["no ball", "no-ball"],
        beamer: ["beamer"],
        length_ball: ["length ball"],
        full_length: ["full length", "full-length"],
        half_volley: ["half volley", "half-volley"],
        short_ball: ["short ball"],
        back_of_length: ["back of length", "back of a length"],
        overpitched: ["overpitched", "over-pitched"],
        inswinger: ["inswinger", "in-swinger"],
        outswinger: ["outswinger", "out-swinger"],
        reverse_swing: ["reverse swing", "reverse-swing"],
        googly: ["googly"],
        doosra: ["doosra"],
        carrom_ball: ["carrom ball", "carrom-ball"],
        top_spin: ["top spin", "topspin"],
        flipper: ["flipper"],
        arm_ball: ["arm ball"],
        seam_up: ["seam up", "seam-up"],
        cross_seam: ["cross seam", "cross-seam"],
        leg_break: ["leg break", "leg-break", "legbreak"],
        off_break: ["off break", "off-break", "offbreak"],
        knuckle_ball: ["knuckle ball", "knuckle-ball"],
        split_finger: ["split finger", "split-finger"],
        reverse_swing_yorker: ["reverse swing yorker"],
    };

    return matchFirst(commentary, ballMap);
}

/**
 * Detects length type.
 */
function detectLengthType(commentary) {
    const lengthMap = {
        yorker: ["yorker"],
        full_toss: ["full toss"],
        good_length: ["good length"],
        short_of_length: ["short of length", "short of a length"],
        bouncer: ["bouncer"],
        wide: ["wide"],
        no_ball: ["no ball"],
        beamer: ["beamer"],
        length_ball: ["length ball"],
        full_length: ["full length"],
        half_volley: ["half volley"],
        short_ball: ["short ball"],
        back_of_length: ["back of a length", "back of length"],
        overpitched: ["overpitched"],
    };

    return matchFirst(commentary, lengthMap);
}

/**
 * Detects shot direction.
 */
function detectDirection(commentary) {
    const directionMap = {
        long_on: ["long on", "long-on"],
        long_off: ["long off", "long-off"],
        straight: ["straight", "down the ground"],
        mid_on: ["mid on", "mid-on"],
        mid_off: ["mid off", "mid-off"],
        deep_mid_wicket: ["deep mid wicket", "deep midwicket"],
        deep_cover: ["deep cover"],
        deep_square_leg: ["deep square leg"],
        deep_fine_leg: ["deep fine leg"],
        deep_point: ["deep point"],
        third_man: ["third man", "third-man"],
        slip: ["slip"],
        gully: ["gully"],
        cover: ["cover", "covers"],
        extra_cover: ["extra cover"],
        point: ["point"],
        square_leg: ["square leg"],
        fine_leg: ["fine leg"],
        short_leg: ["short leg"],
        mid_wicket: ["mid wicket", "midwicket"],
        backward_point: ["backward point"],
        backward_square_leg: ["backward square leg"],
        leg_slip: ["leg slip"],
        silly_point: ["silly point"],
    };

    return matchFirst(commentary, directionMap);
}

/**
 * Detects connection type (how the ball met the bat).
 */
function detectConnection(commentary) {
    const connectionMap = {
        well_timed: ["well timed", "well-timed", "timed beautifully", "sweetly timed"],
        miscue: ["miscued", "miscue"],
        mistimed: ["mistimed", "mis-timed"],
        toe_end: ["toe end", "toe-end", "off the toe"],
        splice: ["splice", "off the splice"],
        top_edge: ["top edge", "top-edge", "top-edged"],
        bottom_edge: ["bottom edge"],
        inside_edge: ["inside edge", "inside-edge"],
        outside_edge: ["outside edge", "outside-edge"],
        nick: ["nick", "nicked", "thick edge"],
        air_shot: ["air shot", "no contact", "swing and a miss"],
        beaten: ["beaten", "beats the bat"],
        defensive_block: ["defensive block", "blocked"],
    };

    return matchFirst(commentary, connectionMap);
}

/**
 * Detects variation (bowler's pace variation).
 */
function detectVariation(commentary) {
    if (/slower|slow ball|slow delivery|off.?cutter|leg.?cutter/.test(commentary)) return "slow";
    if (/faster|quick|fast ball|fired in/.test(commentary)) return "fast";
    return "normal";
}

/**
 * Detects shot elevation.
 */
function detectShotElevation(commentary) {
    if (/lofted|in the air|aerial|over the top|up and over/.test(commentary)) return "lofted";
    if (/along the ground|kept it down|grounded/.test(commentary)) return "grounded";
    return "";
}

/**
 * Detects if the ball was lofted.
 */
function detectLofted(commentary) {
    return /lofted|in the air|aerial|over the top|up and over|skied|into the stands/.test(commentary);
}

/**
 * Detects if the batsman came down the track.
 */
function detectComesDown(commentary) {
    if (/came down the track|comes down|stepped out|down the wicket|danced down/.test(commentary)) {
        return "yes";
    }
    return "";
}

/**
 * Detects if the ball was in the powerplay (based on over number).
 */
function detectPowerplay(over, matchId) {
    if (!over) return "";
    const overNum = parseInt(over.split(".")[0], 10);
    if (isNaN(overNum)) return "";
    // Powerplay for T20: overs 1-6, ODI: 1-10
    // For simplicity, we assume T20 unless we know the format.
    // You can fetch the match format if needed.
    return overNum <= 6 ? "powerplay" : "";
}

/**
 * Detects a dropped catch.
 */
function detectDropped(commentary) {
    return /dropped|puts it down|spilled|grassed|missed the catch|shelled/.test(commentary);
}

/**
 * Detects a runout.
 */
function detectRunout(commentary) {
    return /run ?out|run-out|runout|direct hit|shy at the stumps/.test(commentary);
}

/**
 * Detects a catch.
 */
function detectCatch(commentary) {
    return /caught|catch|c&b|caught and bowled|taken by/.test(commentary);
}

/**
 * Detects wicket type from commentary and event.
 */
function detectWicketType(commentary, event) {
    if (!event || !event.toLowerCase().includes("wicket")) return null;

    if (/bowled/.test(commentary)) return "bowled";
    if (/lbw|leg before/.test(commentary)) return "lbw";
    if (/stumped/.test(commentary)) return "stumped";
    if (/run ?out|run-out|runout/.test(commentary)) return "runout";
    if (/caught and bowled|c&b/.test(commentary)) return "caught_bowled";
    if (/caught|catch/.test(commentary)) return "caught";
    if (/hit wicket|hitwicket/.test(commentary)) return "hitwicket";
    if (/obstructing/.test(commentary)) return "obstructingthefield";
    if (/retired out/.test(commentary)) return "retiredout";
    if (/timed out/.test(commentary)) return "timedout";
    if (/keeper catch|caught behind|caught by keeper/.test(commentary)) return "keeperCatch";

    return null;
}

/**
 * Attempts to extract the fielder involved in a dismissal.
 */
function detectFielder(commentary, type) {
    // Attempt to match "caught by <fielder>" or "run out by <fielder>" etc.
    const patterns = {
        catch: /caught by ([a-z\s]+?)(?:,|!|\.|$)/,
        runout: /run ?out by ([a-z\s]+?)(?:,|!|\.|$)/,
        dropped: /dropped by ([a-z\s]+?)(?:,|!|\.|$)/,
        stumped: /stumped by ([a-z\s]+?)(?:,|!|\.|$)/,
    };

    const regex = patterns[type];
    if (!regex) return "";

    const match = commentary.match(regex);
    if (match && match[1]) {
        return match[1].trim();
    }

    // Alternative patterns
    const altPatterns = {
        catch: /caught at [a-z\s]+ by ([a-z\s]+?)(?:,|!|\.|$)/,
        runout: /(direct hit|shy) by ([a-z\s]+?)(?:,|!|\.|$)/,
    };

    const altRegex = altPatterns[type];
    if (altRegex) {
        const altMatch = commentary.match(altRegex);
        if (altMatch && altMatch[2]) {
            return altMatch[2].trim();
        }
    }

    return "";
}

// ------------------------------------------------------------
// 🧩 Utility
// ------------------------------------------------------------

/**
 * Iterates through a map and returns the first matching key.
 * @param {string} commentary - Lowercased commentary.
 * @param {Object} map - { key: [synonym1, synonym2, ...] }.
 * @returns {string|null} - The matched key, or null.
 */
function matchFirst(commentary, map) {
    for (const [key, synonyms] of Object.entries(map)) {
        for (const syn of synonyms) {
            if (commentary.includes(syn)) {
                return key;
            }
        }
    }
    return null;
}

module.exports = { generateLabelsMatch };