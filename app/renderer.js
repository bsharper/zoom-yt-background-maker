const ytdl = require('ytdl-core');
const fs = require('fs');
const dialog = require('electron').remote.dialog;
const path = require('path')
const log = require('electron-log');
const os = require('os');
const dirsep = path.sep;

const debounce = require('lodash/debounce')

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
var fileLocation = false;
var youtubeFileLocation = false;
var isWorking = false;
var ytMetadata = false;
var addlConvertInfo = "";

function toggleLoadingStatus(tf) {
    if (tf) $(".loading-status").fadeIn();
    else $(".loading-status").fadeOut();
}

function _checkURL() {
    var val = $("#yturl").val();
    var valid = ytdl.validateURL(val);
    //console.log(`URL provided: ${val}`)
    //console.log(`URL valid: ${valid}`)
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
    } else {
        $("#start").addClass("disabled");
        $("#start").removeClass("btn-success");
        uicon.removeClass("icon-check").addClass("icon-arrow-right")
        utt.dataset.tooltip = "Enter a valid YouTube URL here"
        st.dataset.tooltip = "Enter a valid YouTube URL before clicking start"
    }
}

const checkURL = debounce(_checkURL, 100);

function updateProgressbar(val) {
    try {
        pbar.value = parseFloat(val);
        $("#status").html(`${curStatus} (${parseInt(val)}%)`);
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
    $(".step-item").removeClass("active");
    $(`#${step}-step`).addClass("active");
}


function convert() {
    status("Converting");
    updateStep('convert');
    var cStartTime;
    var job = ffmpeg(youtubeFileLocation).size('1280x720').noAudio().videoCodec(vcodec).videoBitrate('1000k')
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
    job.save(fileLocation);
}

function justConvert() {
    status("Downloading");
    updateStep("download");
    $("#yturl").addClass("disabled");
    $("#start").addClass("disabled");
    setTimeout(() => {
        errorDone('error')
        //convert();
    }, 2000);
}

function getYTInfo() {
    return new Promise ((resolve, reject) => {
        var url = $("#yturl").val();
        ytdl.getBasicInfo(url).then(r => {
            ytMetadata = r;
            downloadLog.info(`getYTInfo result`, r);
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
    
    youtubeFileLocation = path.join(os.tmpdir(), `${Date.now()}-yt-temp.mp4`); // `${os.tmpdir()} ${Date.now()}-yt-temp.mp4`;
    downloadLog.info(`Temporary YT file location: ${youtubeFileLocation}`)
    var url = $("#yturl").val();
    const video = ytdl(url);
    let starttime;
    video.pipe(fs.createWriteStream(youtubeFileLocation));
    video.once('response', () => {
        starttime = Date.now();
        downloadLog.info(`download started ${starttime}`)
    });
    video.on('info', () => {
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
        downloadLog.error(err)
        console.log(`Error downloading`)
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
    var msgOpts = {type: 'error', message: `Uh oh, there was an error during the ${curStatus.toLowerCase()} step.\nClick "Start again" to try again\n\nLogs are stored under ${logPath}, more information about the error can be found there.`}
    await done('Error', msgOpts);
}

async function done (lstatus, msgOpts) {
    if (typeof msgOpts == 'undefined') msgOpts = {type: 'info', message: `All done! The output file has been saved to ${fileLocation}.\n\nIn Zoom go to Settings, then Virtual Background, then click the + icon and select Add Video, then pick the video file above (${path.basename(fileLocation)}).`}
    if (typeof lstatus == 'undefined') lstatus = 'Done!';
    status(lstatus);
    updateStep("done");
    toggleLoadingStatus(false);
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
    setTimeout(() => {
        $("#yturl").focus();
    }, 200)

    $("#start").click(function () {
        var $this = $(this);

        var wasClicked = $("#start").data("clicked") || false
        $this.data("clicked", true);
        $this.removeClass("tooltip");
        var wd = $this.width();
        $this.width(`${wd}px`)
        $this.html(`<div class="loading"></div>`)
        toggleLoadingStatus(true);

        setTimeout(() => {
            getSaveLocation(() => {
                $("#start").html("Start")
                console.log(`File location ${fileLocation}`);
                download();
            });
        }, 1);
        return false;
    });

    // setTimeout(() => {
    //     $("#yturl").val("https://www.youtube.com/watch?v=rEab0He0wxk").trigger("change");
    // }, 500);


})


