
const { exec } = require("child_process");
const { spawn } = require("child_process");
const Task = require("../models/task");
const { createMatchesList } = require("../utils/createMatches");
const { generateLabels } = require("../helperfunctions/generateLabels");
const { addPlayerHands } = require("../helperfunctions/updateClips");
const Config = require("../models/config");
const fs = require("fs");

async function updateTask(id, updates) {
  await Task.findByIdAndUpdate(id, updates, { new: true });
}

function runCmd(id, status, cmd) {
  return new Promise((resolve, reject) => {
    updateTask(id, { status, logs: [`Running: ${cmd}`] });
    console.log(cmd, 'run')
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        updateTask(id, { status: "error", logs: [`Error: ${stderr}`] });
        return reject(error);
      }

      updateTask(id, { logs: [`OK: ${stdout}`] });
      resolve();
    });
  });
}

function runCmde(id, status, cmd, args = []) {
  return new Promise((resolve, reject) => {
    updateTask(id, { status, logs: [`Running: ${cmd} ${args.join(" ")}`] });

    const child = spawn(cmd, args, { shell: true });

    child.stdout.on("data", (data) => console.log(data.toString()));
    child.stderr.on("data", (data) => console.error(data.toString()));

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        updateTask(id, { status: "error", logs: [`Error code: ${code}`] });
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}


async function runPipeline() {
  try {
    const tasks = await Task.find({ status: { $ne: "finished" } });
    console.log(tasks, 'tasks')
    const cookies = await Config.findOne({ name: "fango11" })
    hotstar_cookies = cookies.cookies.hotstar
    icc_cookies = cookies.cookies.icc
    console.log(hotstar_cookies, 'hotstar')
    console.log(icc_cookies, 'icc')
    fs.writeFileSync("C:/Users/Lenovo/dream11/dreamelevenclonebackend/helperfunctions/cookies/hotstar_cookies.txt", hotstar_cookies);
    console.log("is it running")
    for (const task of tasks) {
      const { matchId, videoLink, year, format, youtubeFormat } = task;
      const taskId = task._id;
      // 1. Download video
      console.log(taskId, 'id', matchId, videoLink, youtubeFormat);

      // Accommodate bcci.tv links: no format argument for bcci.tv
      if (videoLink.includes("bcci.tv")) {
        await runCmd(taskId, "downloading", `node ./helperfunctions/video_download.js "${videoLink}" ${matchId}`);
      } else {
        const ytFormat = youtubeFormat || "298";
        await runCmd(taskId, "downloading", `node ./helperfunctions/video_download.js "${videoLink}" ${matchId} ${ytFormat}`);
      }

      // 2. Create matches list
      //await runCmd(taskId, "creating-matches-list", `node ./helperfunctions/createMatches.js ${matchId}`);
      await createMatchesList()
      //await runCmd(taskId, "commentary", `python ./../../pythonocr/cricket_ocr/commentary_pipeline_temporary.py ${matchId}`);

      // 3. Crop frames
      await runCmde(taskId, "cropping", `python ./../../pythonocr/cricket_ocr/extract_clips_pipeline_temporary.py ${matchId}`);

      // 4. OCR
      const OCR_PYTHON = "C:\\Users\\Lenovo\\pythonocr\\cricket_ocr\\cricket_env\\Scripts\\python.exe";
      await runCmde(taskId, "ocr", `"${OCR_PYTHON}" ./../../pythonocr/cricket_ocr/ocr_over_temporary.py ${matchId}`);

      // 5. Commentary
      await runCmd(taskId, "commentary", `python ./../../pythonocr/cricket_ocr/commentary_pipeline_temporary.py ${matchId}`);
      // 6. Cut clips
      //await runCmd(taskId, "cutting", `python cutClips.js ${matchid}`);
      await runCmd(taskId, "cutting", `python ./../../pythonocr/cricket_ocr/extract_clips_pipeline_temporary.py ${matchId}`);
      await runCmd(taskId, "cutting", `python ./../../pythonocr/cricket_ocr/compress_to_240p_temporary.py ${matchId}`);
      // 7. Mark task as finished
      await updateTask(taskId, { status: "finished" });
    }
  } catch (err) {
    console.error(`❌ Pipeline error:`, err);
    //await updateTask(taskId, { status: "error", logs: [err.message] });
  }
}

module.exports = { runPipeline };
