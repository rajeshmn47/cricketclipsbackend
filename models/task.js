const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema({
  matchId: String,
  videoLink: String,
  format: String, // for match format (e.g., T20, ODI)
  youtubeFormat: String, // for YouTube video format code
  year: Number,
  teamHomeName: String,
  status: {
    type: String,
    enum: [
      "created",
      "downloading",
      "creating-matches-list",
      "cropping",
      "ocr",
      "commentary",
      "cutting",
      "finished",
      "error"
    ],
    default: "created"
  },
  progress: { type: Number, default: 0 }, // optional 0–100 progress
  logs: [String], // step-by-step logs for UI
  createdAt: { type: Date, default: Date.now }
});

const Task = mongoose.model("Task", TaskSchema);
module.exports = Task;
