var express = require("express"),
	session = require("express-session"),
	passport = require("passport"),
	async = require('async'),
	app = express(),
	router = express.Router();

const PopupTools = require('popup-tools');
const utils = require('./utils');

const wikiUpload = require('../models/wikiUploadUtils');

app.set("views", __dirname + "/public/views");
app.set("view engine", "ejs");

const fs = require('fs');

app.use('/routes', express.static(__dirname + '/routes'));

app.use(passport.initialize());
app.use(passport.session());
app.use(session({
	secret: "OAuth Session",
	saveUninitialized: true,
	resave: true
}));

passport.serializeUser(function (user, done) {
	done(null, user);
});

passport.deserializeUser(function (obj, done) {
	done(null, obj);
});
/* GET home page. */
router.get('/video-cut-tool-back-end', function (req, res) {
	res.render('index');
});

function sendCallback (req, res) {
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
	var upload = true;
	var RotateValue = req.body.RotateValue;
	const videoName = req.body.videoName; // used for uploads
	const publicVideos = req.body.videos;

	// Video Settings
	var rotateVideo = req.body.rotateVideo;
	var trimIntoMultipleVideos = req.body.trimIntoMultipleVideos;
	var trimIntoSingleVideo = req.body.trimIntoSingleVideo;
	var cropVideo = req.body.cropVideo;
	var upload = req.body.upload;

	//This is to log the outting video 
	console.log("Your Video Mode is : " + mode);
	console.log("Your video upload to commons is : " + upload);
	console.log("You Video Audio Disablity is : " + disableAudio);
	console.log("Video Rotation : " + rotateVideo);
	console.log("Video Crop : " + cropVideo);
	console.log("Video trim into multiple videos : " + trimIntoMultipleVideos);
	console.log("Video trim in to single video : " + trimIntoSingleVideo);
	console.log("Rotate Video : " + RotateValue);
	console.log('downloading video ' + url)

	// This fetches the video into the server.
	// Params: videoURL -> videoPath
	if (!upload) {
		utils.downloadVideo(url, videoName, (err, videoPath, videoDuration) => {
			if (err || !videoPath || !fs.existsSync(videoPath)) {
				console.log(err)
				return res.status(400).send('Error downloading video');
			}
			const processFuncArray = [];
			let currentTimecode = 0;
			let endVideoDuration = 0;

			// if the trimVideo is true, this function trims video based on trims array
			// Params: videoPath, trims[]
			if (trimVideo) {
				processFuncArray.push((cb) => {
					console.log('trimming')
					const processNum = processFuncArray.length;
					utils.trimVideos(videoPath, processNum, trims, mode, (err, videosLocation, newCurrentTimecode) => {
						utils.deleteFiles([videoPath]);
						if (err) return cb(err);
						endVideoDuration = newCurrentTimecode * processFuncArray.length;
						currentTimecode = newCurrentTimecode;
						return cb(null, videosLocation);
					})
				})
			} else {
				// Just map to an array of paths
				processFuncArray.push((cb) => {
					setTimeout(() => {
						endVideoDuration = videoDuration * (processFuncArray.length-1);
						return cb(null, [videoPath]);
					}, 100);
				})
			}

			// if the CropVideo is true, 
			// Params: videoPaths, out_width, out_height, x_value, y_value
			if (cropVideo) {
				processFuncArray.push((videoPaths, cb) => {
					console.log('cropping')
					utils.cropVideos(videoPaths, processFuncArray.length-1, endVideoDuration, currentTimecode, out_width, out_height, x_value, y_value, (err, croppedPaths, newCurrentTimecode) => {
						utils.deleteFiles(videoPaths);
						if (err) return cb(err);
						currentTimecode = newCurrentTimecode;
						return cb(null, croppedPaths)
					})
				})
			}

			// if the rotateVideo is true, this rotates the video to 90 degree clock-wise
			// Params: videoPaths, RotateValue
			if (rotateVideo) {
				processFuncArray.push((videoPaths, cb) => {
					console.log('rotating');
					utils.rotateVideos(videoPaths, processFuncArray.length-1, endVideoDuration, currentTimecode, RotateValue, (err, rotatedVideos, newCurrentTimecode) => {
						utils.deleteFiles(videoPaths);
						if (err) return cb(err);
						currentTimecode = newCurrentTimecode;
						return cb(null, rotatedVideos);
					})
				})
			}

			// Based on the video mode, If single this concatinates the trimmed videos into one.
			// Params: videoPaths
			if (mode === "single" && trims.length > 1) {
				processFuncArray.push((videoPaths, cb) => {
					console.log('doing concat');
					utils.concatVideos(videoPaths, processFuncArray.length-1, endVideoDuration, currentTimecode, (err, concatedPath, newCurrentTimecode) => {
						utils.deleteFiles(videoPaths);
						if (err) return cb(err);
						currentTimecode = newCurrentTimecode;
						return cb(null, [concatedPath]);
					})
				})
			}

			// This disables the audio in the video.
			// Params: videoPaths
			if (disableAudio) {
				processFuncArray.push((videoPaths, cb) => {
					console.log('remove audio')
					utils.removeAudioFromVideos(videoPaths, processFuncArray.length-1, endVideoDuration, currentTimecode, (err, clearedPaths) => {
						utils.deleteFiles(videoPaths);
						if (err) return cb(err);
						return cb(null, clearedPaths);
					})
				})
			}
			console.log('starting processing')

			// With Async Waterfall method all the required operations will start
			async.waterfall(processFuncArray, (err, result) => {
				console.log(err, result)
				console.log('=================== result ==================');
				utils.moveVideosToPublic(result, (err, newPaths) => {
					console.log('moved to public', newPaths)
					if (err) return res.status(400).send('something went wrong');
					return res.json({ videos: newPaths.map((p) => `public/${p.split('public/').pop()}`) });
				})
			})
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
}

function uploadFileSendCallback(req, res){
	console.log('Upload sent')
	if('video' in req.files){
		let data;
		try {
			data = JSON.parse(req.body.data);
		} catch(SyntaxError){
			console.log("There was an issue with the data sent.");
			console.log(req.body.data);
			return res.status(500).send('Something has gone wrong with the video you uploaded. Please try again.')
		}
		for(let key in data){
			req.body[key] = data[key]
		}
		req.body.inputVideoUrl = req.files.video.tempFilePath
		req.body.videoName = req.files.video.name
		sendCallback(req, res)
	} else {
		return res.status(400).send('There was no video specified.')
	}
}

router.post('/video-cut-tool-back-end/video-cut-tool-back-end/send', sendCallback);
router.post('/video-cut-tool-back-end/video-cut-tool-back-end/send/upload', uploadFileSendCallback);
router.post('/video-cut-tool-back-end/send', sendCallback);
router.post('/video-cut-tool-back-end/send/upload', uploadFileSendCallback)
router.post('/send', sendCallback);
router.post('/send/upload', uploadFileSendCallback);

router.get('/download/public/:videopath', function(req, res){
	const file = 'public/'+req.params.videopath;
	res.download(file); // Set disposition and send it.
});

router.get('/video-cut-tool-back-end/download/public/:videopath', function(req, res){
	const file = 'public/'+req.params.videopath;
	res.download(file); // Set disposition and send it.
});

router.get('/insert', function (req, res) {
	res.render('index');
});

router.get('/video-cut-tool-back-end/insert', function (req, res) {
	res.render('index');
});

router.get(['/video-cut-tool-back-end/video-cut-tool-back-end/login', '/video-cut-tool-back-end/login'], passport.authenticate('mediawiki'), () => {});

router.get("/", function (req, res) {
	res.redirect(req.baseUrl + '/video-cut-tool-back-end/');
});

router.get('/video-cut-tool-back-end/video-cut-tool-back-end/auth/mediawiki/callback', passport.authenticate('mediawiki', {
	failureRedirect: '/login',
}), (req, res) => {
	const user = JSON.parse(JSON.stringify(req.user));
	console.log(user);
	res.end(PopupTools.popupResponse({ user }));
})

router.get('/video-cut-tool-back-end/auth/mediawiki/callback', passport.authenticate('mediawiki', {
	failureRedirect: '/login',
}), (req, res) => {
	const user = JSON.parse(JSON.stringify(req.user));
	console.log(user);
	res.end(PopupTools.popupResponse({ user }));
})

router.get('/auth/mediawiki/callback', passport.authenticate('mediawiki', {
	failureRedirect: '/login',
}), (req, res) => {
	const user = JSON.parse(JSON.stringify(req.user));
	console.log(user);
	res.end(PopupTools.popupResponse({ user }));
})

module.exports = router;
