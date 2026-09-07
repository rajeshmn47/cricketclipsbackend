const connectDB = require("../../config/db");
const Clip = require("../../models/clips");

async function clipsexcercise() {
    await connectDB();
    const clips = await Clip.find({ commentary: {}, "flag.isFlagged": true, "flag.conflictFields": { $in: ["direction"] } });
    console.log(clips.length, "clips")
    for (let i = 0; i < clips.length; i++) {

    }
}

clipsexcercise();