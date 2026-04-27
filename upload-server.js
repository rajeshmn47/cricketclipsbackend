const express = require("express");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const fs = require("fs");

const app = express();
const PORT = 5000;

// Allow all origins
app.use(cors());

// Ensure upload folder exists
const uploadDir = "D:/cricketvideos/match_videos";
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage: always save with a temp name first
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext);
        cb(null, `${base}_${Date.now()}${ext}`);
    },
});
const upload = multer({ storage });

// POST /upload - upload a video file, then rename if videoName provided
app.post("/upload", upload.single("video"), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No video file uploaded" });
        }

        let finalName = req.file.filename;
        const ext = path.extname(req.file.originalname);

        // Rename file if videoName provided in form-data
        if (req.body.videoName) {
            let videoName = req.body.videoName;
            if (!videoName.endsWith(ext)) videoName += ext;
            const oldPath = req.file.path;
            const newPath = path.join(uploadDir, videoName);

            // If file with same name exists, add a timestamp
            let uniquePath = newPath;
            let counter = 1;
            while (fs.existsSync(uniquePath)) {
                uniquePath = path.join(
                    uploadDir,
                    `${path.basename(videoName, ext)}_${Date.now()}${ext}`
                );
                counter++;
            }

            fs.renameSync(oldPath, uniquePath);
            finalName = path.basename(uniquePath);
        }

        res.json({
            success: true,
            filename: finalName,
            path: path.join(uploadDir, finalName),
            url: `/match_videos/${finalName}`,
        });
    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ success: false, message: "Upload failed", error: err.message });
    }
});

app.get("/", (req, res) => {
    res.send("Video upload server is running.");
});

// Serve uploaded files statically
app.use("/match_videos", express.static(uploadDir));

// Start server
app.listen(PORT, () => {
    console.log(`Video upload server running on http://localhost:${PORT}`);
});