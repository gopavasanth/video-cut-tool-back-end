var express = require("express"),
	session = require("express-session"),
	passport = require("passport"),
	MediaWikiStrategy = require("passport-mediawiki-oauth").OAuthStrategy,
	series = require("async-series"),
	async = require('async'),
	app = express(),
	router = express.Router(),
	path = require('path');
const http = require('http');
var mongoose = require('mongoose');
let ejs = require('ejs');
const PopupTools = require('popup-tools')

var config = require('../config');
const OAuth = require('oauth-1.0a');
const wikiUpload = require('../models/wikiUploadUtils');
const User = require('../models/User');
const baseUrl = 'https://commons.wikimedia.org/w/api.php';

app.set("views", __dirname + "/public/views");
app.set("view engine", "ejs");

const fs = require('fs');
const Path = require('path');
const Listr = require('listr');
const Axios = require('axios');
const shell = require('shelljs');
const { exec } = require('child_process');
const BASE_URL = 'https://commons.wikimedia.org/w/api.php';

const oauth = OAuth({
	consumer: {
		key: config.consumer_key,
		secret: config.consumer_secret,
	},
})

app.use('/routes', express.static(__dirname + '/routes'));

app.use(passport.initialize());
app.use(passport.session());
app.use(session({
	secret: "OAuth Session",
	saveUninitialized: true,
	resave: true
}));

// mongoose.connect('localhost:4000/video-cut-tool-back-end', function (err) {

//    if (err) throw err;

//    console.log('Successfully connected');

// });

// passport.use(
// 	new MediaWikiStrategy({
// 		consumerKey: config.consumer_key,
// 		consumerSecret: config.consumer_secret
// 	},
// 	function ( token, tokenSecret, profile, done ) {
// 		profile.oauth = {
// 			consumer_key: config.consumer_key,
// 			consumer_secret: config.consumer_secret,
// 			token: token,
// 			token_secret: tokenSecret
// 		};
// 		const userProfile = {
// 			...profile,
// 			oauth: {
// 				token: token,
// 				token_secret: tokenSecret
// 			}
// 		}
// 		return done( null, userProfile );
// 	}
// 	) );

passport.serializeUser(function (user, done) {
	done(null, user);
});

passport.deserializeUser(function (obj, done) {
	done(null, obj);
});
/* GET home page. */
router.get('/video-cut-tool-back-end', function (req, res, next) {
	res.render('index', {
		title: 'VideoCutTool',
		user: req && req.session && req.session.user,
		url: req.baseUrl
	});
});

function deleteFiles(files) {
	files.forEach((file) => {
		fs.unlink(file, () => { });
	})
}

function downloadVideo(url, callback) {
	let videoExtension = url.split('.').pop().toLowerCase();
	var videoDownloadPath = Path.join(__dirname, '/videos/', `video_${Date.now()}_${parseInt(Math.random() * 10000)}` + '.' + videoExtension);
	const writer = fs.createWriteStream(videoDownloadPath);
	var cmd = ("truncate -s 0 myfile; ffmpeg -y -i " + url + " -vcodec copy -acodec copy " + videoDownloadPath);
	exec(cmd, (err) => {
		if (err) return callback(err);
		console.log("downloading success")
		return callback(null, videoDownloadPath);
	})
	// setTimeout(() => {
	// 	callback(null, Path.join(__dirname, '/videos/', 'video_1565168938329_2992.webm'))
	// }, 100);
}

function trimVideos(videoPath, trims, mode, callback) {
	const trimFuncArray = [];
	const trimsLocations = [];
	const videoExtension = videoPath.split('.').pop().toLowerCase();
	// A list to concat the videos in
	const videosListFileName = Path.join(__dirname, `filelist-${Date.now()}`);

	trims.forEach((element, index) => {
		trimFuncArray.push((callback) => {
			const videoLocation = Path.join(__dirname, `trimmed-video-${Date.now()}.${videoExtension}`);
			trimsLocations.push(videoLocation);
			var cmd = 'ffmpeg -i ' + videoPath + ' -ss ' + element.from + ' -to ' + element.to + ' -async 1 -strict 2 ' + videoLocation;
			console.log("Command: " + cmd);
			exec(cmd, (error, stdout, stderr) => {
				if (error !== null) {
					console.log(error)
					console.log(`Trimminng Process error !`);
					return callback(error);
				}
				// console.log('trimmed single video', single_trimmed_video)
				callback(null, videoLocation);
			})
		})

	})

	async.series(trimFuncArray, () => {
		console.log('mode from trim', mode)
		return callback(null, trimsLocations);
	})

}

function concatVideos(videoPaths, callback) {
	const videosListFileName = Path.join(__dirname, `filelist-${Date.now()}`);
	videoPaths.forEach((videoLocation) => {
		fs.appendFileSync(videosListFileName, "file '" + videoLocation + "'\n");
	})

	const concatedLocation = Path.join(__dirname, `concated-video-${Date.now()}.${videoPaths[0].split('.').pop()}`);
	var cmd = `ffmpeg -f concat -safe 0 -i ${videosListFileName} -c copy ${concatedLocation}`;
	exec(cmd, (err, stdout, stderr) => {
		fs.unlink(videosListFileName, () => { });
		if (err) return callback(err);
		return callback(null, concatedLocation);
	})
}

function rotateVideos(videosPaths, RotateValue, callback) {
	console.log("I'm Rotatted ");
	const rotatesLocations = [];
	const rotateFuncArray = [];

	videosPaths.forEach((videoPath) => {
		rotateFuncArray.push((cb) => {
			const videoExtension = videoPath.split('.').pop().toLowerCase();
			const rotatedLocation = Path.join(__dirname, `rotated-video-${Date.now()}.${videoExtension}`);
			rotatesLocations.push(rotatedLocation);
			if (RotateValue == 0 || RotateValue == 1 || RotateValue == 2 || RotateValue == 3) {
				// I'm justing changing RotateValue here and assigning to 1 as for now the 
				// the video should rotate only 90 degreee clock wise
				RotateValue == '1';
				var cmd = 'ffmpeg -i ' + videoPath + ' -vf "transpose=' + RotateValue + '" ' + rotatedLocation;
			}
			console.log("Command" + cmd);
			exec(cmd, (err) => {
				if (err) return cb(err);
				console.log("Rotating success")
				return cb(null);
			})
		})
	})

	async.series(rotateFuncArray, (err) => {
		if (err) return callback(err);
		return callback(null, rotatesLocations);
	})
}

function cropVideos(videosPaths, out_width, out_height, x_value, y_value, callback) {
	const cropsLocations = [];
	const cropsFuncArray = [];
	videosPaths.forEach((videoPath) => {
		cropsFuncArray.push((cb) => {
			const videoExtension = videoPath.split('.').pop().toLowerCase();
			const croppedLocation = Path.join(__dirname, `cropped-video-${Date.now()}.${videoExtension}`);
			cropsLocations.push(croppedLocation);

			var cmd = `ffmpeg -i ${videoPath} -filter:v "crop=${out_width / 100}*in_w:${out_height / 100}*in_h:${x_value / 100}*in_w:${y_value / 100}*in_h" -c:a copy ${croppedLocation}`
			console.log("Command" + cmd);
			exec(cmd, (err) => {
				if (err) return cb(err);
				console.log("Cropping success")
				return cb(null);
			})
		})

	})

	async.series(cropsFuncArray, (err) => {
		if (err) return callback(err);
		return callback(null, cropsLocations);
	})

}

function removeAudioFromVideos(videosPaths, callback) {
	const removeAudioFunc = [];
	const clearedLocations = [];
	videosPaths.forEach((videoPath) => {
		removeAudioFunc.push((cb) => {
			const videoExtension = videoPath.split('.').pop().toLowerCase();
			const clearedLocation = Path.join(__dirname, `cleared-video-${Date.now()}.${videoExtension}`);
			clearedLocations.push(clearedLocation);
			const cmd = `ffmpeg -i ${videoPath} -an ${clearedLocation}`;
			exec(cmd, (err) => {
				if (err) return cb(err);
				return cb();
			})
		})
	})
	async.series(removeAudioFunc, (err) => {
		if (err) return callback(err);
		return callback(null, clearedLocations);
	})
}

router.post('/video-cut-tool-back-end/send', function (req, res, next) {
	console.log('Hit Send')
	const disableAudio = req.body.disableAudio;
	var out_width = req.body.out_width;
	var out_height = req.body.out_height;
	var x_value = req.body.x_value;
	var y_value = req.body.y_value;
	const url = req.body.inputVideoUrl;
	var mode = req.body.trimMode;
	var trims = req.body.trims;
	var user = req.body.user;
	let videoExtension = url.split('.').pop().toLowerCase();
	let videoName = `video_${Date.now()}_${parseInt(Math.random() * 10000)}`
	var videoPath = Path.join(__dirname, '/videos/', videoName + '.' + videoExtension);
	var videoSettings;
	var upload = true;
	var title = req.body.title;

	// Video Settings
	var rotateVideo = req.body.rotateVideo;
	var trimIntoMultipleVideos = req.body.trimIntoMultipleVideos;
	var trimIntoSingleVideo = req.body.trimIntoSingleVideo;
	var cropVideo = req.body.cropVideo;
	var upload = req.body.upload;

	// I'm justing changing RotateValue here and assigning to 1 as for now the 
	// the video should rotate only 90 degreee clock wise
	let RotateValue = 1;

	console.log("Your Video Mode is : " + mode);
	console.log("Your video upload to commons is : " + upload);
	console.log("You Video Audio Disablity is : " + disableAudio);
	console.log("Video Rotation : " + rotateVideo);
	console.log("Video Crop : " + cropVideo);
	console.log("Video trim into multiple videos : " + trimIntoMultipleVideos);
	console.log("Video trim in to single video : " + trimIntoSingleVideo);
	console.log("New video Title : " + title)

	if (mode == "single" || mode == "multiple") {
		videoSettings = "trim";
		console.log("Hey I'm trimmed")
	}

	var out_location = Path.join(__dirname, '/new_videos/', videoName + '.' + videoExtension);
	const tmpFiles = [];
	downloadVideo(url, (err, videoPath) => {
		if (err || !videoPath || !fs.existsSync(videoPath)) {
			console.log(err)
			return res.status(400).send('Error downloading video');
		}
		const processFuncArray = [];
		// Initialize video path with the downloaded path

		if (videoSettings === 'trim') {
			processFuncArray.push((cb) => {
				console.log('trimming')
				trimVideos(videoPath, trims, mode, (err, videosLocation) => {
					// deleteFiles([videoPath]);
					if (err) return cb(err);
					return cb(null, videosLocation);
				})
			})
		} else {
			// Just map to an array of paths
			processFuncArray.push((cb) => {
				setTimeout(() => {
					return cb(null, [videoPath]);
				}, 100);
			})
		}
		if (rotateVideo) {
			processFuncArray.push((videoPaths, cb) => {
				rotateVideos(videoPaths, RotateValue, (err, rotatedVideos) => {
					deleteFiles(videoPaths);
					if (err) return cb(err);
					return cb(null, rotatedVideos);
				})
			})
		}
		if (cropVideo) {
			processFuncArray.push((videoPaths, cb) => {
				console.log('cropping')
				cropVideos(videoPaths, out_width, out_height, x_value, y_value, (err, croppedPaths) => {
					deleteFiles(videoPaths);
					if (err) return cb(err);
					return cb(null, croppedPaths)
				})
			})
		}
		if (mode === "single" && trims.length > 1) {
			processFuncArray.push((videoPaths, cb) => {
				concatVideos(videoPaths, (err, concatedPath) => {
					deleteFiles(videoPaths);
					if (err) return cb(err);
					return cb(null, [concatedPath]);
				})
			})
		}
		if (disableAudio) {
			processFuncArray.push((videoPaths, cb) => {
				console.log('remove audio')
				removeAudioFromVideos(videoPaths, (err, clearedPaths) => {
					deleteFiles(videoPaths);
					if (err) return cb(err);
					return cb(null, clearedPaths);
				})
			})
		}
		async.waterfall(processFuncArray, (err, result) => {
			console.log(err, result)
			console.log('=================== result ==================');
			return res.json({ videos: result });
			// if (!upload || result.length > 1) {
			// 	return res.json({ videos: result });
			// }
			// wikiUpload.uploadFileToMediawiki(
			// 	user.mediawikiToken,
			// 	user.mediawikiSecret,
			// 	// fs.createWriteStream('rotate/' + RotatedvideoName + '.' + videoExtension),
			// 	fs.createReadStream(result[0]),
			// 	{
			// 		filename: title,
			// 		// text: 'New Text'
			// 	},
			// 	(err, response) => {
			// 		if (err) {
			// 			console.log(err);
			// 			return res.status(400).send('Something went wrong while uploading the video')
			// 		}
			// 		res.send(response);
			// 	}
			// )
		})
	})
});

router.get('/insert', function (req, res, next) {
	res.render('index', {
		message: "Trimming success"
	});
});

router.get("/video-cut-tool-back-end/login", function (req, res) {
	res.redirect(req.baseUrl + "/auth/mediawiki");
});

router.get("/", function (req, res) {
	res.redirect(req.baseUrl + '/video-cut-tool-back-end/');
});


router.get('/auth/mediawiki', passport.authenticate("mediawiki"), () => {

});

router.get('/auth/mediawiki/callback', passport.authenticate('mediawiki', {
	failureRedirect: '/login',
}), (req, res) => {
	const user = JSON.parse(JSON.stringify(req.user));

	res.end(PopupTools.popupResponse({ user }));

})

module.exports = router;