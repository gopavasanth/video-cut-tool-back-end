var express = require( "express" ),
	session = require( "express-session" ),
	passport = require( "passport" ),
	MediaWikiStrategy = require( "passport-mediawiki-oauth" ).OAuthStrategy,
	series = require("async-series"),
	async = require('async'),
	app = express(),
	router = express.Router(),
	path = require('path');
	const http = require('http');
	var mongoose = require('mongoose');
	let ejs = require('ejs');
const OAuth = require('oauth-1.0a');
const wikiUpload = require('../models/wikiUploadUtils');
const User = require('../models/User');
const baseUrl = 'https://commons.wikimedia.org/w/api.php';

app.set( "views", __dirname + "/public/views" );
app.set( "view engine", "ejs" );

const Fs = require('fs');
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


app.use( passport.initialize() );
app.use( passport.session() );
app.use( session({ secret: "OAuth Session",
	saveUninitialized: true,
	resave: true
}) );

// mongoose.connect('localhost:4000/video-cut-tool-back-end', function (err) {
 
//    if (err) throw err;
 
//    console.log('Successfully connected');
 
// });

passport.use(
	new MediaWikiStrategy({
		consumerKey: config.consumer_key,
		consumerSecret: config.consumer_secret
	},
	function ( token, tokenSecret, profile, done ) {
		profile.oauth = {
			consumer_key: config.consumer_key,
			consumer_secret: config.consumer_secret,
			token: token,
			token_secret: tokenSecret
		};
		return done( null, profile );
	}
	) );

passport.serializeUser(	function ( user, done ) {
	done( null, user );
});

passport.deserializeUser( function ( obj, done ) {
	done( null, obj );
});
/* GET home page. */
router.get('/video-cut-tool-back-end', function(req, res, next) {
 res.render('index', {
	title: 'VideoCutTool',
	user: req && req.session && req.session.user,
	url: req.baseUrl
 });
});

function downloadVideo(url, callback) {
  let videoExtension = url.split('.').pop().toLowerCase();
  var videoDownloadPath = Path.join(__dirname, '/videos/', `video_${Date.now()}_${parseInt(Math.random() * 10000)}`+ '.'+ videoExtension);
  const writer = Fs.createWriteStream(videoDownloadPath);
  var cmd=("truncate -s 0 myfile; ffmpeg -y -i " +  url + " -vcodec copy -acodec copy " + videoDownloadPath);
  exec(cmd, (err) => {
      if (err) return callback(err);
      console.log("downloading success")
      return callback(null, videoDownloadPath);
  })
}

function trimVideos( trimmedVideos, SinglevideoName, disableAudio, mode, trims, videoPath, callback ) {
	console.log("==Mode== " + mode)
	console.log("===disableAudio===" + disableAudio)
	let videoExtension = videoPath.split('.').pop().toLowerCase();
	const trimFuncArray = [];
	const trimsLocations = [];
	trims.forEach((element, index) => {

			trimFuncArray.push(function one(callback) {
					var hash_name = 'video' + index + Date.now() + '.webm';
					var videoName = `Trimmed_video_${Date.now()}_${parseInt(Math.random() * 10000)}`
					var out_location = Path.join(__dirname, '/trimmed/', videoName + '.' + videoExtension);
					var trimmedvideoName = '/trimmed/' + videoName + '.' + videoExtension;
					trimsLocations.push(out_location);
					trimmedVideos.push(trimmedvideoName);
					Fs.appendFile('myfile', "file '" + out_location + "'\n", (err) => {
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
											console.log(`Trimminng Process Completed !`);
									}
									console.log("Trimmed Video Names: " + trimmedVideos);
									callback(null, trimmedvideoName)
							})
					})
			})
	});

	async.series(trimFuncArray, () => {
			if (mode === "single") {
					console.log("I got into Concataion");
					var out_location = Path.join(__dirname, '/trimmed/', SinglevideoName + '.' + videoExtension);
					var cmd = 'ffmpeg -f concat -safe 0 -i myfile -c copy ' + out_location;
					if (exec(cmd, (error, stdout, stderr) => {
							if (error !== null) {
									console.log(error)
									console.log(`Trimminng Process Completed !`);
							}
					}).code !== 0) {
							shell.echo("==");
					}
					callback(null, trimsLocations)
			}
	})

}

function rotateVideos(RotatedvideoName, disableAudio, RotateValue, videoPath, callback){
	console.log("I'm Rotatted ");
	const rotatesLocations = [];
	let videoExtension = videoPath.split('.').pop().toLowerCase();
	var out_location = Path.join(__dirname, '/rotate/', RotatedvideoName + '.'+ videoExtension);
	console.log("OutLocation: "  + out_location)
	rotatesLocations.push(out_location);

	if (RotateValue == 0 || RotateValue == 1 || RotateValue == 2 || RotateValue == 3 ){
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

function cropVideos( CroppedVideoName, disableAudio, req, res, videoPath, callback) {
	const cropsLocations = [];
	let videoExtension = videoPath.split('.').pop().toLowerCase();
   var out_location = Path.join(__dirname, '/cropped/' + CroppedVideoName + '.'+ videoExtension);
	 var out_width = req.body.out_width;
	 var out_height = req.body.out_height;
	 var x_value = req.body.x_value;
	 var y_value = req.body.y_value;
   cropsLocations.push(out_location);

	if ( disableAudio ) {
			var cmd = 'ffmpeg -i ' + videoPath + ' -filter:v ' + '"crop=' + out_width + ':' + out_height + ':' + x_value + ':' + y_value + '" -c:a copy ' + '-an ' + out_location;
	} else {
			var cmd = 'ffmpeg -i ' + videoPath + ' -filter:v ' + '"crop=' + out_width + ':' + out_height + ':' + x_value + ':' + y_value + '" -c:a copy ' + out_location;
	}
   console.log("Command" + cmd);
	 exec(cmd, (err) => {
		if (err) return callback(err);
		console.log("Cropping success")
	})
	return callback(null, cropsLocations);
}

router.post('/video-cut-tool-back-end/send', function(req, res, next) {
  console.log('Hit Send')
	let RotateValue = req.body.value;
	const disableAudio = req.body.disableAudio;
	var out_width = req.body.out_width;
	var out_height = req.body.out_height;
	var x_value = req.body.x_value;
	var y_value = req.body.y_value;
  const url = req.body.inputVideoUrl;
	var mode = req.body.trimMode;
	var trims = req.body.trims;
	let videoExtension = url.split('.').pop().toLowerCase();
	let videoName = `video_${Date.now()}_${parseInt(Math.random() * 10000)}`
  var videoPath = Path.join(__dirname, '/videos/' , videoName + '.'+ videoExtension);
	var videoSettings;

	console.log("==Your Video Mode is == " + mode );
	console.log("==You Video Audio Disablity is == " + disableAudio)

	if ( mode == "single" || mode == "multiple" ) {
			videoSettings = "trim";
			console.log("Hey I'm trimmed")
	}

	downloadVideo(url, (err, videoPath) => {
	   if (err || !videoPath || !Fs.existsSync(videoPath)) {
	     console.log(err)
	     return res.status(400).send('Error downloading video');
	   }

			if (videoSettings == "trim") {
				const trimmedVideos = [];
				var SinglevideoName = `Concated_video_${Date.now()}_${parseInt(Math.random() * 10000)}`;
				trimVideos( trimmedVideos, SinglevideoName, disableAudio, mode, trims, videoPath, (err, trimmedVideos) => {
					if (mode === "multiple"){
						var response = JSON.stringify({ 
							message: "Trimming Sucess", 
							status: "Completed"
						});
						console.log("Response: " + response);
						console.log("Hello");
						console.log("===Trim Locations==: " + trimmedVideos);
						res.send(response);
					}
					if (mode === "single"){
						var response = JSON.stringify({ 
							message: "Trimming Sucess", 
							status: "Completed",
							videoName: 'trimmed/' + SinglevideoName + '.' + videoExtension,
						});
						res.send(response);
					}
				})
			}

			if (mode == "rotate"){
				var RotatedvideoName = `Rotatted_video_${Date.now()}_${parseInt(Math.random() * 10000)}`;
				rotateVideos(RotatedvideoName, disableAudio, RotateValue, videoPath, (err, trimmedVideos) => {
					var response = JSON.stringify({ 
						message: "Rotating Sucess",
						status: "Completed", 
						videoName: 'rotate/' + RotatedvideoName + '.' + videoExtension,
					});
					res.send(response);
				})
			}

			if (mode == "crop") {
				var CroppedVideoName =  `Cropped_video_${Date.now()}_${parseInt(Math.random() * 10000)}`;
				cropVideos( CroppedVideoName, disableAudio, req, res, videoPath, (err, trimmedVideos) => {
					var response = JSON.stringify({
						message: "Cropping Sucess",
						status: "Completed",
						videoName: 'cropped/' + CroppedVideoName + '.' + videoExtension,
					});
					res.send(response);
				})
			}

			if (mode == "upload"){
				function uploadFileToCommons(fileUrl, user, formFields, callback) {
					const {
					  fileTitle,
					  description,
					  categories,
					  licence,
					  source,
					  sourceUrl,
					  sourceAuthors,
					  comment,
					  date,
					  customLicence,
					} = formFields
					let file;
					const errors = []
				  
					if (!user) {
					  errors.push('Invalid user');
					}
					if (fileUrl) {
					  file = fs.createReadStream(fileUrl);
					} else {
					  errors.push('File is required')
					}
				  
					if (!fileTitle) {
					  errors.push('File title is required')
					}
					if (!description) {
					  errors.push('Description is required')
					}
					if (!categories || categories.length === 0) {
					  errors.push('At least one category is required')
					}
					if (!source) {
					  errors.push('Source field is required')
					}
					if (!date) {
					  errors.push('Date field is required')
					}
					if (!licence) {
					  errors.push('Licence field is required')
					}
					if (source && source === 'others' && !sourceUrl) {
					  errors.push('Please specify the source of the file')
					}
					if (errors.length > 0) {
					  console.log(errors)
					  return callback(errors.join(', '))
					}
				  
					if (file) {
					  const uploadFuncArray = []
					  let token, tokenSecret
					  // convert file
					  uploadFuncArray.push((cb) => {
						console.log('Logging in wikimedia')
						User
						  .findOne({ mediawikiId: user.mediawikiId })
						  .select('mediawikiToken mediawikiTokenSecret')
						  .exec((err, userInfo) => {
							if (err) {
							  return callback('Something went wrong, please try again')
							}
							if (!userInfo || !userInfo.mediawikiToken || !userInfo.mediawikiTokenSecret) {
							  return callback('You need to login first');
							}
							token = userInfo.mediawikiToken
							tokenSecret = userInfo.mediawikiTokenSecret
							cb()
						  })
					  })
				  
					  uploadFuncArray.push((cb) => {
						console.log(' starting upload, the file is ')
						let licenceInfo;
						if (customLicence) {
						  licenceInfo = licence;
						} else {
						  licenceInfo = licence === 'none' ? 'none' : `{{${source === 'own' ? 'self|' : ''}${licence}}}`;
						}
				  
						const fileDescription = `{{Information|description=${description}|date=${date}|source=${source === 'own' ? `{{${source}}}` : sourceUrl}|author=${source === 'own' ? `[[User:${user.username}]]` : sourceAuthors}}}`;
						// upload file to mediawiki
						wikiUpload.uploadFileToMediawiki(
						  token,
						  tokenSecret,
						  file,
						  {
							filename: fileTitle,
							comment: comment || '',
							text: `${description} \n${categories.map((category) => `[[${category}]]`).join(' ')}`,
						  },
						).then((result) => {
						  if (result.result && result.result.toLowerCase() === 'success') {
							// update file licencing data
							console.log('uploaded', result)
							const wikiFileUrl = result.imageinfo.url;
							const fileInfo = result.imageinfo;
							const uploadedFileName = result.filename;
							const wikiFileName = `File:${result.filename}`;
							const pageText = `== {{int:filedesc}} == \n${fileDescription}\n\n=={{int:license-header}}== \n ${licenceInfo} \n\n${categories.map((category) => `[[${category}]]`).join(' ')}\n`;
				  
							wikiUpload.updateWikiArticleText(token, tokenSecret, wikiFileName, pageText, (err, result) => {
							  if (err) {
								console.log('error updating file info', err);
							  }
							  console.log('updated text ', result);
							  return callback(null, { success: true, url: wikiFileUrl, fileInfo, filename: uploadedFileName });
							})
						  } else {
							return callback('Something went wrong!')
						  }
						})
						.catch((err) => {
						  console.log('error uploading file ', err)
						  const reason = err && err.code ? `Error [${err.code}]${!err.info ? '' : `: ${err.info}`}` : 'Something went wrong'
						  cb()
						  return callback(reason)
						})
					  })
				  
					  async.series(uploadFuncArray, (err, result) => {
						console.log(err, result)
					  })
					} else {
					  return callback('Error while uploading file')
					}
				  }
				}	

		})
});

router.get('/insert', function(req, res, next) {
  res.render('index', {
    message: "Trimming success"
  });
  });

router.get( "/video-cut-tool-back-end/login", function ( req, res ) {
	res.redirect( req.baseUrl + "/auth/mediawiki/callback" );
} );

router.get( "/", function ( req, res ) {
	res.redirect(req.baseUrl+'/video-cut-tool-back-end/');
} );

router.get('/auth/mediawiki/callback', function(req, res, next) {
  passport.authenticate( "mediawiki", function( err, user ) {
 		if ( err ) {
 			return next( err );
 		}

 		if ( !user ) {
 			return res.redirect( req.baseUrl + "/login" );
 		}

 	} )( req, res, next );
});

module.exports = router;
