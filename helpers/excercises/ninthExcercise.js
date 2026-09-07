const mongoose = require('mongoose');
const CricketTeam = require('../../models/cricketteam');
const connectDB = require('../../config/db');
const { default: axios } = require('axios');

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

const routes = [
    "/api/auth/verify",
    "/api/user/profile",
    "/api/user/wallet",
    "/api/user/transactions",
    "/api/matches/upcoming",
    "/api/matches/live",
    "/api/matches/:matchId",
    "/api/contests/by-match/:matchId",
    "/api/contests/:contestId",
    "/api/my-contests",
    "/api/contest/:contestId/leaderboard",
    "/api/contest/:contestId/teams",
    "/api/match/:matchId/players",
    "/api/teams/by-match/:matchId",
    "/api/teams/:teamId",
    "/api/teams/points/:teamId",
    "/api/live/match/:matchId",
    "/api/live/player-stats/:matchId",
    "/api/live/fantasy-points/:matchId",
    "/api/results/contest/:contestId",
    "/api/results/user/:userId/contest/:contestId",
    "/api/winnings/history",
    "/api/notifications",
    "/api/config/points-rules",
    "/auth/getallusers"
]

async function findingBugs() {
    await connectDB();
    const logindata = await axios.post('http://127.0.0.1:8000/auth/logine', {
        myform: {
            email: "rajeshmn47@gmail.com",
            password: "bengaluru"
        }
    });
    console.log(logindata.data, "token")
    let token = "fVPa06YyZNpOmOzy0i690s:APA91bE_5xJcts5fghWAa_ivYUtaA2Se_yolk6m-FqunBEejZKcXRJCtRLAY4D85aVTDRgnJsp-0mR1u2hqClY7o1brKIp6-7MjbdFqW2AIhleEDGZwAFsQ"
    axios.defaults.headers.common['Authorization'] = `Bearer ${logindata.data.token}`;
    const data = await axios.get('http://127.0.0.1:8000/admin/dashboard-data', { headers: { servertoken: `Bearer ${token}` } });
    //console.log(data.data, "data")
    for (let route of routes) {
        try {
            const response = await axios.get(`http://127.0.0.1:8000${route}`, {headers: { Authorization: `Bearer ${logindata.data.token}` } });
            console.log(data, "data")
        }
        catch (err) {
            console.error(`Error accessing ${route}:`, err.message);
        }
    }
    mongoose.connection.close();
}

findingBugs().catch(err => {
    console.error(err);
    process.exit(1);
});

