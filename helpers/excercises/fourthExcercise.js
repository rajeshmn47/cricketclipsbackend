const mongoose = require('mongoose');
const Clip = require('../../models/clips');      // adjust path if needed
const Player = require('../../models/players');  // adjust path if needed
const connectDB = require('../../config/db');    // adjust path if needed

// 🔧 Corrections mapping (wrong name → correct name)
const corrections = {
    // Pant variants → Rishabh Pant
    "pant": "Rishabh Pant",
    "r pant": "Rishabh Pant",
    "pranav pant": "Rishabh Pant",

    // Rayudu
    "madhav rayudu": "Ambati Rayudu",

    // Kohli
    "aryaveer kohli": "Virat Kohli",

    // Tripathi
    "rahul tripthi": "Rahul Tripathi",
    "rahul tripathi": "Rahul Tripathi",

    // Samson
    "samson sola": "Sanju Samson",

    // Dubey
    "praveen dubey": "Praveen Dubey",

    // Rohit Sharma / Yuvraj Singh
    "rohit yadav": "Rohit Sharma",
    "sahab yuvraj": "Yuvraj Singh",
    "tishant dabla": "Ishan Kishan",
    "prithvi raj": "prithvi Shaw",
    "karthik raman": "Dinesh Karthik",
    "rahul chaudhary": "KL Rahul",
    "manish sehrawat": "Manish Pandey",
    "hardik sharma": "Hardik Pandya",
    "jitesh singh": "Jitesh Sharma",
    "Nadeem Khan": "Shahbaz Nadeem",
    "pranshu vijayran": "Vijay Shankar",
    "aadi agarwal": "Mayank agarwal",
    "sarfaraz ahmed": "sarfaraz khan",
    "deepak khatri": "deepak hooda"
};

// Escape regex special characters in the "wrong" name
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function renamePlayers() {
    try {
        await connectDB();
        console.log('🚀 Starting player rename script...\n');

        let totalClips = 0;
        let totalPlayers = 0;

        for (const [wrong, correct] of Object.entries(corrections)) {
            const regex = new RegExp(`^${escapeRegex(wrong)}$`, 'i');

            // 1. Update batsman field in clips
            const batsmanRes = await Clip.updateMany(
                { batsman: regex ,league: "IPL" },
                { $set: { batsman: correct } }
            );

            // 2. Update bowler field in clips
            const bowlerRes = await Clip.updateMany(
                { bowler: regex , league: "IPL" },
                { $set: { bowler: correct } }
            );

            const clipCount = batsmanRes.modifiedCount + bowlerRes.modifiedCount;
            totalClips += clipCount;



            if (clipCount > 0) {
                console.log(`✅ "${wrong}" → "${correct}" (clips: ${clipCount})`);
            }
        }

        console.log(`\n🎉 Completed! Updated ${totalClips} clips and ${totalPlayers} player documents.`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

// Run the script
renamePlayers();