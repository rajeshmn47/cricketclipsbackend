const mongoose = require('mongoose');
const CricketTeam = require('../../models/cricketteam');
const connectDB = require('../../config/db');

// Strict mapping: exact team name (or short name) to league
// Only include known franchise teams.
const teamLeagueMap = new Map([
    // IPL
    ['Mumbai Indians', 'IPL'], ['MI', 'IPL'],
    ['Chennai Super Kings', 'IPL'], ['CSK', 'IPL'],
    ['Royal Challengers Bangalore', 'IPL'], ['RCB', 'IPL'],
    ['Kolkata Knight Riders', 'IPL'], ['KKR', 'IPL'],
    ['Delhi Capitals', 'IPL'], ['DC', 'IPL'],
    ['Sunrisers Hyderabad', 'IPL'], ['SRH', 'IPL'],
    ['Rajasthan Royals', 'IPL'], ['RR', 'IPL'],
    ['Punjab Kings', 'IPL'], ['PBKS', 'IPL'], ['Kings XI Punjab', 'IPL'],
    ['Lucknow Super Giants', 'IPL'], ['LSG', 'IPL'],
    ['Gujarat Titans', 'IPL'], ['GT', 'IPL'],
    // BBL
    ['Sydney Sixers', 'BBL'], ['Sixers', 'BBL'],
    ['Perth Scorchers', 'BBL'], ['Scorchers', 'BBL'],
    ['Melbourne Stars', 'BBL'], ['Stars', 'BBL'],
    ['Adelaide Strikers', 'BBL'], ['Strikers', 'BBL'],
    ['Brisbane Heat', 'BBL'], ['Heat', 'BBL'],
    ['Hobart Hurricanes', 'BBL'], ['Hurricanes', 'BBL'],
    ['Melbourne Renegades', 'BBL'], ['Renegades', 'BBL'],
    ['Sydney Thunder', 'BBL'], ['Thunder', 'BBL'],
    // PSL
    ['Peshawar Zalmi', 'PSL'], ['Zalmi', 'PSL'],
    ['Quetta Gladiators', 'PSL'], ['Gladiators', 'PSL'],
    ['Karachi Kings', 'PSL'], ['Kings', 'PSL'],
    ['Lahore Qalandars', 'PSL'], ['Qalandars', 'PSL'],
    ['Islamabad United', 'PSL'], ['United', 'PSL'],
    ['Multan Sultans', 'PSL'], ['Sultans', 'PSL'],
    // CPL
    ['Trinbago Knight Riders', 'CPL'], ['TKR', 'CPL'],
    ['Jamaica Tallawahs', 'CPL'], ['Tallawahs', 'CPL'],
    ['Barbados Royals', 'CPL'], ['Royals', 'CPL'],
    ['Guyana Amazon Warriors', 'CPL'], ['Warriors', 'CPL'],
    ['St Kitts & Nevis Patriots', 'CPL'], ['Patriots', 'CPL'],
    ['St Lucia Kings', 'CPL'], ['Kings', 'CPL'],
]);

async function fixTeams() {
    await connectDB();
    console.log('🔧 Fixing team classifications...');
    await CricketTeam.updateMany({}, { $set: { league: "" } })
    const allTeams = await CricketTeam.find({});
    let updated = 0;

    for (const team of allTeams) {
        const name = team.teamName;
        const short = team.shortName;
        let league = null;

        // Exact match (case‑insensitive)
        const exactMatch = (str) => {
            if (!str) return false;
            const lower = str.toLowerCase();
            for (let [key, val] of teamLeagueMap) {
                if (key.toLowerCase() === lower) {
                    league = val;
                    return true;
                }
            }
            return false;
        };

        if (!exactMatch(name) && !exactMatch(short)) {
            // Not a known franchise team → international or domestic
            if (team.country && team.country !== '') {
                team.type = 'international';
            } else if (team.region && team.region !== '') {
                team.type = 'domestic';
            } else {
                // Default to international if nothing else
                team.type = 'international';
            }
            if (team.league !== '') {
                team.league = '';
                updated++;
            }
            if (team.type !== (team.type)) { /* no change needed */ }
            await team.save();
            continue;
        }

        // Known franchise team
        if (team.type !== 'league') {
            team.type = 'league';
            updated++;
        }
        if (team.league !== league) {
            team.league = league;
            updated++;
        }
        await team.save();
        console.log(`✅ ${team.teamName} (${team.shortName}) → ${league}`);
    }

    console.log(`🎉 Updated ${updated} teams.`);
    process.exit(0);
}

fixTeams().catch(err => {
    console.error(err);
    process.exit(1);
});