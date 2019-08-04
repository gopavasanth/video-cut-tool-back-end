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
var out_location = 'nothing';
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

function downloadVideo(url, callback) {
	  let videoExtension = url.split('.').pop().toLowerCase();
	  var videoDownloadPath = Path.join(__dirname, '/videos/', `video_${Date.now()}_${parseInt(Math.random() * 10000)}`+ '.'+ videoExtension);
	  const writer = fs.createWriteStream(videoDownloadPath);
	  var cmd=("truncate -s 0 myfile; ffmpeg -y -i " +  url + " -vcodec copy -acodec copy " + videoDownloadPath);
	  exec(cmd, (err) => {
	      if (err) return callback(err);
	      console.log("downloading success")
	      return callback(null, videoDownloadPath);
	  })
	// setTimeout(() => {
	// 	callback(null, Path.join(__dirname, '/videos/', 'video_1564869357637_6257.webm'))
	// }, 100);
}

function trimVideos(upload, trimmedVideos, SinglevideoName, disableAudio, mode, trims, videoPath, callback) {
	console.log("==Mode== " + mode)
	console.log("===disableAudio===" + disableAudio)
	let videoExtension = videoPath.split('.').pop().toLowerCase();
	const trimFuncArray = [];
	const trimsLocations = [];
	const videosListFileName = Path.join(__dirname, `filelist-${Date.now()}`);

	trims.forEach((element, index) => {
		trimFuncArray.push((callback) => {
			var hash_name = 'video' + index + Date.now() + '.webm';
			var videoName = `Trimmed_video_${Date.now()}_${parseInt(Math.random() * 10000)}`
			var out_location = Path.join(__dirname, '/trimmed/', videoName + '.' + videoExtension);
			var trimmedvideoName = '/trimmed/' + videoName + '.' + videoExtension;
			trimsLocations.push(out_location);
			trimmedVideos.push(trimmedvideoName);

			fs.appendFile(videosListFileName, "file '" + out_location + "'\n", (err) => {
				if (err) throw err;
				if (disableAudio) {
					var cmd = 'ffmpeg -i ' + videoPath + ' -ss ' + element.from + ' -to ' + element.to + ' -async 1 -strict 2 ' + '-an ' + out_location;
				} else {
					var cmd = 'ffmpeg -i ' + videoPath + ' -ss ' + element.from + ' -to ' + element.to + ' -async 1 -strict 2 ' + out_location;
				}
				console.log("Command: " + cmd);
				exec(cmd, (error, stdout, stderr) => {
					if (error !== null) {
						console.log(error)
						console.log(`Trimminng Process error !`);
						return callback(error);
					}
					console.log('trimmed single video', out_location)
					callback(null, trimmedvideoName)
				})
			})
		})

	})

	async.series(trimFuncArray, () => {
		console.log('mode from trim', mode)
		if (mode === "single") {
			console.log("I got into Concataion");
			var out_location = Path.join(__dirname, '/trimmed/', SinglevideoName + '.' + videoExtension);
			var cmd = `ffmpeg -f concat -safe 0 -i ${videosListFileName} -c copy ${out_location}`;
			exec(cmd, (err, stdout, stderr) => {
				if (err) return callback(err);
				trimsLocations.forEach((loc) => {
					fs.unlink(loc, () => { });
				})
				return callback(null, out_location);
			})
		} else {
			return callback(null, trimsLocations[0]);
		}
	})

}

function rotateVideos(upload, RotatedvideoName, disableAudio, RotateValue, videoPath, callback) {
	console.log("I'm Rotatted ");
	const rotatesLocations = [];
	let videoExtension = videoPath.split('.').pop().toLowerCase();
	var out_location = Path.join(__dirname, '/rotate/', RotatedvideoName + '.' + videoExtension);
	console.log("Out location: " + out_location)
	rotatesLocations.push(out_location);

	if (RotateValue == 0 || RotateValue == 1 || RotateValue == 2 || RotateValue == 3) {
		// I'm justing changing RotateValue here and assigning to 1 as for now the 
		// the video should rotate only 90 degreee clock wise
		RotateValue == '1';
		console.log("Disable Audio: " + disableAudio)
		if (disableAudio) {
			var cmd = 'ffmpeg -i ' + videoPath + ' -vf "transpose=' + RotateValue + '" ' + " -an " + out_location;
		} else {
			var cmd = 'ffmpeg -i ' + videoPath + ' -vf "transpose=' + RotateValue + '" ' + out_location;
		}
	}
	console.log("Command" + cmd);
	exec(cmd, (err) => {
		if (err) return callback(err);
		console.log("Rotating success")
	})
	return (callback(null, rotatesLocations));
}

function cropVideos(upload, CroppedVideoName, disableAudio, req, res, videoPath, callback) {
	const cropsLocations = [];
	let videoExtension = videoPath.split('.').pop().toLowerCase();
	var out_location = Path.join(__dirname, '/cropped/' + CroppedVideoName + '.' + videoExtension);

	var out_width = req.body.out_width;
	var out_height = req.body.out_height;
	var x_value = req.body.x_value;
	var y_value = req.body.y_value;
	cropsLocations.push(out_location);

	if (disableAudio) {
		var cmd = `ffmpeg -i ${videoPath} -filter:v "crop=${out_width / 100}*in_w:${out_height / 100}*in_h:${x_value / 100}*in_w:${y_value / 100}*in_h" -c:a copy -an ${out_location}`
	} else {
		var cmd = `ffmpeg -i ${videoPath} -filter:v "crop=${out_width / 100}*in_w:${out_height / 100}*in_h:${x_value / 100}*in_w:${y_value / 100}*in_h" -c:a copy ${out_location}`
	}
	console.log("Command" + cmd);
	exec(cmd, (err) => {
		if (err) return callback(err);
		console.log("Cropping success")
		return callback(null, cropsLocations);
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

	console.log("New video Title: " + title)

	// I'm justing changing RotateValue here and assigning to 1 as for now the 
	// the video should rotate only 90 degreee clock wise
	let RotateValue = 1;

	console.log("==Your Video Mode is == " + mode);
	console.log("Your video upload to commons is " + upload);
	console.log("==You Video Audio Disablity is == " + disableAudio)

	if (mode == "single" || mode == "multiple") {
		videoSettings = "trim";
		console.log("Hey I'm trimmed")
	}

	downloadVideo(url, (err, videoPath) => {
		if (err || !videoPath || !fs.existsSync(videoPath)) {
			console.log(err)
			return res.status(400).send('Error downloading video');
		}
		
		if (videoSettings == "trim") {
			console.log('starting trim')
			const trimmedVideos = [];
			var SinglevideoName = `Concated_video_${Date.now()}_${parseInt(Math.random() * 10000)}`;
			trimVideos(upload, trimmedVideos, SinglevideoName, disableAudio, mode, trims, videoPath, (err, trimmedVideos) => {
				console.log('done trimming')

				if (mode === "multiple") {
					var response = JSON.stringify({
						message: "Trimming Sucess",
						status: "Completed"
					});
					console.log("Response: " + response);
					// console.log("Hello");
					// console.log("===Trim Locations==: " + trimmedVideos);

					// if (false) {
					if (upload == true) {
						console.log('starting upload')
						wikiUpload.uploadFileToMediawiki(
							user.mediawikiToken,
							user.mediawikiSecret,
							fs.createReadStream(videoPath),
							{
								filename: 'Dengue fever symptoms video.' + videoExtension,
								text: 'New Text'
							},
							(err, response) => {
								if (err) {
									console.log(err);
									return res.status(400).send('Something went wrong while uploading the video')
								}
								res.send(response);
							}
						)
					} else {
						res.send(response);
					}
				} else if (mode === "single") {
					var response = JSON.stringify({
						message: "Trimming Sucess",
						status: "Completed",
						videoName: videoPath,
					});
					// if (false) {
					if (upload == true) {
						wikiUpload.uploadFileToMediawiki(
							user.mediawikiToken,
							user.mediawikiSecret,
							fs.createReadStream(videoPath),
							{
								filename: 'Dengue fever symptoms video.' + videoExtension,
								text: 'New Text'
							},
							(err, response) => {
								if (err) {
									console.log(err);
									return res.status(400).send('Something went wrong while uploading the video')
								}
								res.send(response);
							}
						)
					} else {
						res.send(response);
					}
				}
			})
		} else if (mode == "rotate") {
			console.log("1" + upload);
			var RotatedvideoName = `Rotatted_video_${Date.now()}_${parseInt(Math.random() * 10000)}`;
			rotateVideos(upload, RotatedvideoName, disableAudio, RotateValue, videoPath, (err, trimmedVideos) => {
				var response = JSON.stringify({
					message: "Rotating Sucess",
					status: "Completed",
					videoName: 'rotate/' + RotatedvideoName + '.' + videoExtension,
				});
				console.log("2", upload);
				if (upload == true) {
					console.log("Upload is going on")
					wikiUpload.uploadFileToMediawiki(
						user.mediawikiToken,
						user.mediawikiSecret,
						// fs.createWriteStream('rotate/' + RotatedvideoName + '.' + videoExtension),
						fs.createWriteStream('/home/gopavasanth/Desktop/GSoC19/VideoCutTool-Back-End/routes/rotate/rotate_video.mp4'),
						{
							filename: 'Dengue fever symptoms video.' + videoExtension,
							text: 'New Text'
						},
						(err, response) => {
							if (err) {
								console.log(err);
								return res.status(400).send('Something went wrong while uploading the video')
							}
							res.send(response);
						}
					)
				} else {
					res.send(response);
				}
			})
		} else if (mode == "crop") {
			var CroppedVideoName = `Cropped_video_${Date.now()}_${parseInt(Math.random() * 10000)}`;
			cropVideos(upload, CroppedVideoName, disableAudio, req, res, videoPath, (err, trimmedVideos) => {
				var response = JSON.stringify({
					message: "Cropping Sucess",
					status: "Completed",
					videoName: 'cropped/' + CroppedVideoName + '.' + videoExtension,
				});
				// if (false) {
				if (upload == true) {
					wikiUpload.uploadFileToMediawiki(
						user.mediawikiToken,
						user.mediawikiSecret,
						fs.createWriteStream('cropped/' + CroppedVideoName + '.' + videoExtension),
						{
							filename: 'Dengue fever symptoms video.' + videoExtension,
							text: 'New Text'
						},
						(err, response) => {
							if (err) {
								console.log(err);
								return res.status(400).send('Something went wrong while uploading the video')
							}
							res.send(response)
						}
					)
				} else {
					res.send(response);
				}
			})
		}
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