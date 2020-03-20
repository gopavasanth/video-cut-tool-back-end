
const async = require('async');
const fs = require('fs');
const Queue = require('bull');
const PopupTools = require('popup-tools');

const wikiUpload = require('../models/wikiUploadUtils');
const UserModel = require('../models/User');
const VideoModel = require('../models/Video');
const utils = require('./utils');
const config = require('../config');

const REDIS_CONFIG = { host: config.REDIS_HOST, port: config.REDIS_PORT, password: config.REDIS_PASSWORD }

const PROCESS_VIDEO_QUEUE = 'PROCESS_VIDEO_QUEUE';
const PROCESS_VIDEO_PROGRESS_QUEUE = 'PROCESS_VIDEO_PROGRESS_QUEUE';
const PROCESS_VIDEO_FINISH_QUEUE = 'PROCESS_VIDEO_FINISH_QUEUE';

const processVideoQueue = new Queue(PROCESS_VIDEO_QUEUE, { redis: REDIS_CONFIG });
const processVideoProgressQueue = new Queue(PROCESS_VIDEO_PROGRESS_QUEUE, { redis: REDIS_CONFIG });
const processVideoFinishQueue = new Queue(PROCESS_VIDEO_FINISH_QUEUE, { redis: REDIS_CONFIG });

processVideoProgressQueue.process((job, done) => {
    console.log('progress', job.data);
    const io = require('../websockets')();
    const { videoId, stage, ...rest } = job.data;
    VideoModel.updateOne({ _id: videoId }, { $set: { stage, status: 'processing' } })
        .then((r) => {
            return VideoModel.findById(videoId).populate('uploadedBy')
        })
        .then((video) => {
            if (video && video.uploadedBy) {
                io.to(video.uploadedBy.socketId).emit('progress:update', { stage, status: 'processing', ...rest });
            }
        })
        .catch(err => {
            console.log(err);
        })
    done();
})

function processVideo(data) {
    processVideoQueue.add(data)
}


function registerUser(user, callback) {
    UserModel.update({ mediawikiId: user.mediawikiId }, user, { upsert: true })
        .then((r) => {
            return UserModel.findOne({ mediawikiId: user.mediawikiId })
        })
        .then(userDoc => {
            callback(null, userDoc.toObject())
        })
        .catch(err => {
            console.log('err', err)
            callback(err)
        })
}


module.exports = {

    sendCallback: (req, res) => {
        console.log('Hit Send')
        const disableAudio = req.body.disableAudio;
        var out_width = req.body.out_width;
        var out_height = req.body.out_height;
        var x_value = req.body.x_value;
        var y_value = req.body.y_value;
        const url = req.body.inputVideoUrl;
        var mode = req.body.trimMode;
        var trims = req.body.trims;
        const trimVideo = req.body.trimVideo;
        var user = req.body.user;
        var RotateValue = req.body.RotateValue;
        const videoName = req.body.videoName; // used for uploads
        const publicVideos = req.body.videos;

        // Video Settings
        let {
            rotateVideo,
            trimIntoMultipleVideos,
            trimIntoSingleVideo,
            cropVideo,
            upload,
        } = req.body;

        //This is to log the outting video 
        console.log("Your Video Mode is : " + mode);
        console.log("Your video upload to commons is : " + upload);
        console.log("You Video Audio Disablity is : " + disableAudio);
        console.log("Video Rotation : " + rotateVideo);
        console.log("Video Crop : " + cropVideo);
        console.log("Video trim into multiple videos : " + trimIntoMultipleVideos);
        console.log("Video trim in to single video : " + trimIntoSingleVideo);
        console.log("Rotate Video : " + RotateValue);
        // console.log('downloading video ' + url)

        // This fetches the video into the server.
        // Params: videoURL -> videoPath
        if (!upload) {
            const videoData = {
                url,
                status: 'queued',
                videoName,
                uploadedBy: user ? user._id : null,
                settings: {
                    trimVideo,
                    trims,
                    mode,
                    cropVideo,
                    out_width,
                    out_height,
                    x_value,
                    y_value,
                    rotateVideo,
                    rotateValue: RotateValue,
                    disableAudio,
                }
            }
            VideoModel.create(videoData)
                .then((videoDoc) => {
                    console.log('vidoe doc', videoDoc)
                    processVideo(videoDoc);
                    return res.json({ queued: true, video: videoDoc });
                }).catch(err => {
                    console.log(err);
                    return res.status(400).send('Something went wrong');
                })
        }
        else {
            let responses = []
            publicVideos.map(video => {
                // This modules supports to upload the result of the operations to the Commons
                wikiUpload.uploadFileToMediawiki(
                    user.mediawikiToken,
                    user.mediawikiTokenSecret,
                    fs.createReadStream(video.path),
                    {
                        filename: video.title,
                        text: video.text,
                        comment: video.comment
                    },
                    (err, response) => {
                        if (err) {
                            console.log(err);
                            return res.status(400).send('Something went wrong while uploading the video')
                        }
                        responses.push(response);
                    }
                )
            });
            res.send(responses);
        }
    },


    uploadFileSendCallback: (req, res) => {
        console.log('Upload sent')
        if ('video' in req.files) {
            let data;
            try {
                data = JSON.parse(req.body.data);
            } catch (SyntaxError) {
                console.log("There was an issue with the data sent.");
                console.log(req.body.data);
                return res.status(500).send('Something has gone wrong with the video you uploaded. Please try again.')
            }
            for (let key in data) {
                req.body[key] = data[key]
            }
            req.body.inputVideoUrl = req.files.video.tempFilePath
            req.body.videoName = req.files.video.name
            utils.moveVideosToPublic([{path: `../${req.body.inputVideoUrl}`, name: req.body.videoName}], (err, results) => {
                if (err) {
                    console.log(err);
                    return res.status(400).send('Something went wrong');
                }
                req.body.inputVideoUrl = results[0];
                sendCallback(req, res)
            })
        } else {
            return res.status(400).send('There was no video specified.')
        }
    },


    onVideoProcessed: (req, res) => {
        const { videoId } = req.body;
        const videos = Array.isArray(req.files.videos) ? req.files.videos : [req.files.videos];
        utils.moveVideosToPublic(videos.map(v => ({...v, path: `../${v.tempFilePath}`})), (err, results) => {
            VideoModel.updateOne({ _id: videoId }, { $set: { outputs: results.map(p => `public/${p.split('public/').pop()}`), status: 'done' } }, (err) => {
                if (err) {
                    console.log(err);
                }
                let video;
                VideoModel.findById(videoId)
                    .populate('uploadedBy')
                    .then(video => {
                        if (video.uploadedBy) {
                            processVideoProgressQueue.add({ videoId: video._id, status: 'done', ...video.toObject(), videos: video.outputs })
                        }
                    })
                    .catch(err => {
                        console.log(err);
                    })
            })

        })
        res.send('done')
    },

    downloadFile: function (req, res) {
        const file = 'public/' + req.params.videopath;
        res.download(file); // Set disposition and send it.
    },

    authCallback: (req, res) => {
        const user = JSON.parse(JSON.stringify(req.user));
        registerUser(user, (err, user) => {
            res.end(PopupTools.popupResponse({ user }));
        })

    }
}