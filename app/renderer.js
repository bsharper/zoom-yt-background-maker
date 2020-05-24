const ytdl = require('ytdl-core');
const fs = require('fs');
const electron = require('electron');
const dialog = electron.remote.dialog;
const path = require('path')
const log = require('electron-log');
const os = require('os')
const bWin = electron.remote.getCurrentWindow();
const dirsep = path.sep;

const debounce = require('lodash/debounce');
const runonce = require('lodash/once');

const moment = require('moment')

const downloadLog = log.create('download');
const convertLog = log.create('convert');
downloadLog.transports.file.fileName = "download.log";
convertLog.transports.file.fileName = "convert.log";

downloadLog.transports.console.level = false;
convertLog.transports.console.level = false;

console.log = log.log;

//const ffmpegPath = require('ffmpeg-static');

var tmpffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
if (tmpffmpegPath.indexOf("app.asar") > -1) {
    var oldffmpegPath = tmpffmpegPath;
    tmpffmpegPath = tmpffmpegPath.replace(/app\.asar/g, 'app.asar.unpacked');
}
const ffmpegPath = tmpffmpegPath;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

const isMac = process.platform === "darwin";
var vcodec = isMac ? "h264_videotoolbox" : "libx264";

var pbar;
var pbarErr = [];
var curStatus = "Idle"
var currentStep = "";
var fileLocation = false;
var youtubeFileLocation = false;
var isWorking = false;
var ytMetadata = false;
var addlConvertInfo = "";
var cancelling = false;
var curYtdlJob = false;
var curFfmpegJob = false;
var ytDownloadURL = false;
var ytSecondsLengthWarning = 600
var seekInput = 0; // false or 0 to disable, number of seconds to skip at the start of the video - any positive # enables

function toggleLoadingStatus(tf) {
    if (tf) $(".loading-status").fadeIn();
    else $(".loading-status").fadeOut();
}

function updateProgressbar(val) {
    try {
        pbar.value = parseFloat(val);
        $("#status").html(`${curStatus} (${parseInt(val)}%)`);
        if (currentStep == "download") {
            bWin.setProgressBar(val/2.0);
        } else {
            bWin.setProgressBar(0.5 + (val/2.0));
        }
    } catch (err) {
        pbarErr.push([err, val]);
    }
}

function updateNonProgressInfo(info) {
    addlConvertInfo = info;
    pbar.value = 0;
    $("#status").html(`${curStatus}${info}`);
}

function updateStep(step) {
    currentStep = step;
    $(".step-item").removeClass("active");
    $(`#${step}-step`).addClass("active");
}


function convert() {
    status("Converting");
    updateStep('convert');
    var cStartTime;
    var job = ffmpeg(youtubeFileLocation).size('1280x720').noAudio().videoCodec(vcodec).videoBitrate('1000k')
    if (seekInput) job.seekInput(seekInput);
    job.on('progress', p => {
        convertLog.info(`progress: ${JSON.stringify(p, null, 4)}`);
        //pbar.value = p.percent;
        if (p.percent) {
            updateProgressbar(p.percent);
        } else {
            if (p.timemark) updateNonProgressInfo(` - ${p.timemark}`);
        }
    })
    
    job.on('start', () => {
        cStartTime = Date.now()
        convertLog.info(`convert started: ${cStartTime}`)
        console.log('convert start')
    })
    job.on('error', err => {
        if (cancelling) {
            return;
        }
        console.log(`convert error`)
        convertLog.error(err)
        if (isMac && vcodec == 'h264_videotoolbox') {
            var msg = `falling back to libx264 encoder on mac`
            console.log(msg)
            convertLog.error(msg)
            vcodec = "libx264"
            setTimeout(() => {
                console.log()
                convert();
            }, 1000)
        } else {
            errorDone();
        }
    })
    job.on('end', () => {
        console.log(`convert done`)
        convertLog.info(`convert done ${Date.now()}`)
        fs.unlink(youtubeFileLocation, () => {
            done();
        });
    })
    curFfmpegJob = job.save(fileLocation);
}

function showYTInfo(r) {
    if (typeof r === 'undefined') r = {'title': 'Test Video Title', 'length_seconds': 120};
    $("#vidtitle_td").html(`${r.title}`);
    $("#vidduration_td").html(`${r.length_seconds} seconds`);
    $("#video-info-table").animate({'opacity': 1})
}

function getYTInfo(url, showTable) {
    return new Promise ((resolve, reject) => {
        if (typeof showTable == 'undefined') showTable = true;
        if (typeof url == 'undefined') url = $("#yturl").val();
        if (showTable) $("#video-info-table").css({'opacity': 0})
        ytdl.getBasicInfo(url).then(r => {
            ytMetadata = r;
            downloadLog.info(`getYTInfo result`, r);
            if (showTable) showYTInfo(r);
            resolve(r);
        }).catch(err => { 
            downloadLog.error(`getYTInfo error`)
            downloadLog.error(err)
            reject(err);
        })
    })
}

function download() {
    status("Downloading");
    updateStep("download");
    $("#yturl").addClass("disabled");
    $("#start").addClass("disabled");
    $("#start").hide();
    $("#cancel").show();
    
    youtubeFileLocation = path.join(os.tmpdir(), `${Date.now()}-yt-temp.mp4`); // `${os.tmpdir()} ${Date.now()}-yt-temp.mp4`;
    downloadLog.info(`Temporary YT file location: ${youtubeFileLocation}`)
    var url = $("#yturl").val();
    const video = ytdl(url);
    curYtdlJob = video;
    let starttime;
    video.pipe(fs.createWriteStream(youtubeFileLocation));
    video.once('response', () => {
        starttime = Date.now();
        downloadLog.info(`download started ${starttime}`)
    });
    video.once('info', () => {
        if (typeof video.videoInfo != 'undefined' && video.videoInfo) download.info(`videoInfo`, video.videoInfo);
        if (typeof video.videoFormat != 'undefined' && video.videoFormat) download.info(`videoFormat`, video.videoFormat);
    })
    video.on('progress', (chunkLength, downloaded, total) => {
        const percent = downloaded / total;
        const downloadedMinutes = (Date.now() - starttime) / 1000 / 60;
        const estimatedDownloadTime = (downloadedMinutes / percent) - downloadedMinutes;
        updateProgressbar(percent*100);

        downloadLog.info(`${(percent * 100).toFixed(2)}% downloaded `);
        downloadLog.info(`(${(downloaded / 1024 / 1024).toFixed(2)}MB of ${(total / 1024 / 1024).toFixed(2)}MB)\n`);
        downloadLog.info(`running for: ${downloadedMinutes.toFixed(2)} minutes, estimated time left: ${estimatedDownloadTime.toFixed(2)} minutes `);
    });
    video.on('error', err => {
        if (cancelling) {
            return;
        }
        downloadLog.error(err)
        console.log(`Error downloading`)
        errorDone(err);
    })
    video.on('end', () => {
        console.log(`download complete`)
        downloadLog.info(`download complete`)
        updateProgressbar(100);
        setTimeout(() => {
            convert();
        }, 500)
    });
}

function status(txt) {
    $("#status").html(txt);
    curStatus = txt;
}

function timeoutPromise(ms) {
    return new Promise ((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, ms)
    });
}

async function errorDone (err) {
    var logPath = path.dirname(log.transports.file.getFile().path);
    var msgOpts = {type: 'error', message: `Uh oh, there was an error during the ${curStatus.toLowerCase()} step.`, detail: `Click "Start again" to try again\n\nLogs are stored under ${logPath}, more information about the error can be found there.`}
    await done('Error', msgOpts);
}

async function done (lstatus, msgOpts) {
    let fn = (fileLocation ? `(${path.basename(fileLocation)})` : "");
    let fp = (fileLocation ? ` to ${fileLocation}` : "");
    if (typeof msgOpts == 'undefined') msgOpts = {type: 'info', message: `All done! The output file has been saved${fp}.`, detail: `In Zoom go to Settings, then Virtual Background, then click the + icon and select Add Video, then pick the video file you created ${fn}.`}
    if (typeof lstatus == 'undefined') lstatus = 'Done!';
    bWin.setProgressBar(-1);
    status(lstatus);
    updateStep("done");
    toggleLoadingStatus(false);
    $("#cancel").hide();
    $("#start").hide();
    $("#reload").fadeIn();
    await timeoutPromise(500);
    await dialog.showMessageBox(msgOpts);
}

async function getSaveLocation (cb) {
    var pr = await dialog.showSaveDialog({title: 'Pick where to save Zoom background movie'});
    var $st = $("#start");
    $st.html(`Start`)

    if (pr.canceled) {
        $st.data("clicked", false);
        toggleLoadingStatus(false);
        return;
    }
    var fn = pr.filePath;
    if (! fn.endsWith(".mp4")) fn = `${fn}.mp4`;
    fileLocation = fn;
    if (cb) try {
        cb();
    } catch (err) {
        toggleLoadingStatus(false);
        console.log(err);
    }
}

function restartApp() {
    window.location.reload();
    // electron.remote.app.relaunch()
    // electron.remote.app.exit(0)
}

function _cancel() {
    cancelling = true;

    setTimeout(() => {
        restartApp()
    }, 1000);
    
    try {
        if (curYtdlJob) curYtdlJob.destroy();
    } catch (err) {
        console.log(`ytdl destroy, error probably ok (raised during cancel): ${err}`);
    }

    try {
        if (curFfmpegJob) curFfmpegJob.kill();
    } catch (err) {
        console.log(`ffmpeg kill, error probably ok (raised during cancel): ${err}`);
    }
    if (youtubeFileLocation) fs.unlink(youtubeFileLocation, (err) => {
        console.log(`unlink yt file, error probably ok (raised during cancel): ${err}`);
    });
}
const cancel = runonce(_cancel);

function cancelConfirm() {
    if (cancelling) return;
    let st = "Cancel process?"
    dialog.showMessageBox({title: st, message: st, detail: "This will stop the download and conversion process", type:"question", buttons: ["Yes, really stop", "Nevermind, continue"], cancelId: 1, defaultId:1}).then(r=> {
        console.log(`cancelConfirm response: ${r.response == 0 ? "really cancelling" : "not cancelling"}`)
        if (r.response == 0) {
            console.log(`cancelling process`);
            cancel();
        }
    })
}

function _checkURL() {
    var val = $("#yturl").val();
    var valid = ytdl.validateURL(val);
    var $st = $("#start")
    var st = $st[0];
    var utt = $("#urltooltip")[0]
    var uicon = $("#urlicon")
    //$st.addClass("tooltip");
    if (valid) {
        $("#start").removeClass("disabled");
        $("#start").addClass("btn-success");
        uicon.removeClass("icon-arrow-right").addClass("icon-check")
        st.dataset.tooltip = "Valid URL found, click to begin"
        utt.dataset.tooltip = "URL valid, click start to begin"
        ytDownloadURL = val;
    } else {
        $("#start").addClass("disabled");
        $("#start").removeClass("btn-success");
        uicon.removeClass("icon-check").addClass("icon-arrow-right")
        utt.dataset.tooltip = "Enter a valid YouTube URL here"
        st.dataset.tooltip = "Enter a valid YouTube URL before clicking start"
        ytDownloadURL = false;
    }
}

const checkURL = debounce(_checkURL, 100);

function _setSeek() {
    var s = parseInt($("#skipseconds").val());
    if ((! Number.isNaN(s)) && Number.isInteger(s) && s > 0) {
        convertLog.info(`Setting converted video start seek to ${s} seconds`)
        seekInput = s;
    }
}

const setSeek = debounce(_setSeek, 50);

function verifyLongVideo (duration) {
    return new Promise((resolve, reject) => {
        let st = "Download long video?"
        let humanize = moment.duration(duration, 'seconds').humanize();
        let detailMsg = `The selected video is ${duration} seconds long (${humanize}). Downloading and converting long duration videos should work, but the download and conversion steps will take a while.`
        console.log(`verifyLongVideo message: ${detailMsg}`);
        dialog.showMessageBox({title: st, message: st, detail: detailMsg, type:"question", buttons: ["Yes, download and convert this video", "No, let me find another video"], cancelId: 1, defaultId:1}).then(r=> {
            console.log(`verifyLongVideo response: ${r.response == 1 ? "stop" : "continue"} (${r.response})`)
            if (r.response == 1) {
                console.log(`cancelling process`);
                resolve(false)
            } else resolve(true)
        })
    })
    
}

async function startClicked () {
    console.log(`startClicked`)
    var $this = $("#start");
    var wasClicked = $this.data("clicked") || false
    $this.data("clicked", true);
    $this.removeClass("tooltip");
    var wd = $this.width();
    $this.width(`${wd}px`)
    $this.html(`<div class="loading"></div>`)
    toggleLoadingStatus(true);
    var lengthSeconds = 0;
    try {
        console.time('getYTInfo')
        var ytinfo = await getYTInfo(ytDownloadURL);
        console.timeEnd('getYTInfo')
        downloadLog.info(ytinfo);
        lengthSeconds = parseInt(ytinfo.length_seconds);
        console.log(`yt video (${ytDownloadURL}) is ${lengthSeconds} seconds long`)
    } catch (err) {
        downloadLog.error(`Error getting video metadata, skipping check\n${err}`)
    }
    
    if (lengthSeconds >= ytSecondsLengthWarning) {
        var keepGoing = await verifyLongVideo(lengthSeconds);
        console.log(`keepGoing: ${keepGoing}`)
        if (! keepGoing) {
            $this.data("clicked", false);
            $this.html(`Start`)
            toggleLoadingStatus(false);
            return;
        }
    }
    
    setTimeout(() => {
        getSaveLocation(() => {
            $("#start").html("Start")
            console.log(`File location ${fileLocation}`);
            download();
        });
    }, 1);
}

$(function () {
    pbar = $("#progress")[0];

    $("#yturl").on("change", function () {
        checkURL();
    })
    $("#yturl").bind("paste", function () {
        checkURL();
    })
    $("#yturl").on("keydown keyup drop", function () {
        checkURL();
    });
    $("#skipseconds").on("change paste keydown drop", function () {
        setSeek();
    })
    $("#reload").click(function () {
        restartApp();
    })
    setTimeout(() => {
        $("#yturl").focus();
    }, 200)

    $("#cancel").click(function () {
        setTimeout(() => {
            cancelConfirm();
        }, 1)
    });

    $("#start").click(function () {
        if ($("#start").hasClass("disabled")) {
            $("#start").addClass("shaker");
            $("#start").one("animationend", () => {
                $("#start").removeClass("shaker")
            })
            return
        }
        setTimeout(() => {
            startClicked();
        }, 1)
        
        return false;
    });

    // setTimeout(() => {
    //     $("#yturl").val("https://www.youtube.com/watch?v=rEab0He0wxk").trigger("change");
    // }, 500);


})


