var express = require( "express" ),
	session = require( "express-session" ),
	passport = require( "passport" ),
	MediaWikiStrategy = require( "passport-mediawiki-oauth" ).OAuthStrategy,
	config = require( "./config" ),
	series = require("async-series"),
	async = require('async'),
	app = express(),
	router = express.Router(),
	path = require('path');

app.set( "views", __dirname + "/public/views" );
app.set( "view engine", "ejs" );

const Fs = require('fs');
const Path = require('path');
const Listr = require('listr');
const Axios = require('axios');
const shell = require('shelljs');
const { exec } = require('child_process');

var hash_name = 'video';

// app.use( express.static(__dirname + "/public/views") );
app.use( passport.initialize() );
app.use( passport.session() );
app.use( session({ secret: "OAuth Session",
	saveUninitialized: true,
	resave: true
}) );

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
  title: 'VideoCutTool'
 });
});

function downloadVideo(url, callback) {
  let videoExtension = url.split('.').pop().toLowerCase();
  var videoDownloadPath = Path.join(__dirname, '/videos/', `video_${Date.now()}_${parseInt(Math.random() * 10000)}`+ '.'+ videoExtension);
  const writer = Fs.createWriteStream(videoDownloadPath);
  var cmd=("ffmpeg -y -i " +  url + " -vcodec copy -acodec copy " + videoDownloadPath);
  exec(cmd, (err) => {
      if (err) return callback(err);
      console.log("downloading success")
      return callback(null, videoDownloadPath);
  })
}

function trimVideos( disableAudio, mode, trims, videoPath, callback ) {
	console.log("==Mode== " + mode)
	console.log("===disableAudio==="+disableAudio)
  let videoExtension = videoPath.split('.').pop().toLowerCase();
  const trimsLocations = [];
  trims.forEach((element, index) => {
	   var hash_name = 'video' + index + Date.now() + '.webm';
	   var out_location = Path.join(__dirname, '/trimmed/', `Trimmed_video_${Date.now()}_${parseInt(Math.random() * 10000)}`+ '.'+ videoExtension);
	   trimsLocations.push(out_location);

		 Fs.appendFile( 'myfile', "file '" + out_location + "'\n", (err) => {
					if (err) throw err;
			})
		 async.series([
			 async function one (callback){
				 if (disableAudio){
						var cmd = 'ffmpeg -i ' + videoPath + ' -ss ' + element.from + ' -to ' + element.to + ' -async 1 -strict 2 ' + '-an ' + out_location;
				 } else {
						var cmd = 'ffmpeg -i ' + videoPath + ' -ss ' + element.from + ' -to ' + element.to + ' -async 1 -strict 2 ' + out_location;
				 }
				 console.log("Command: " + cmd);
				 exec(cmd, (err) => {
						 if (err) return callback(err);
						 console.log("downloading success")
						 return callback(null, videoDownloadPath);
				 })

				 if ( await exec(cmd, (error, stdout, stderr) => {
					 console.log(stdout);
					 console.info("Program Started");
					 console.log(stderr);
					 if (error !== null) {
						 console.log(error)
						 console.log(`Trimminng Process Completed !`);
					 }
					 }).code !== 0) {
					 shell.echo("==");
				 }
				 callback(null, trimsLocations)
			 },

			function two (callback){
				 console.log("Trimming is done and I'm starting Concataion");

				 if ( mode == "single" ) {
					 console.log("I got into Concataion");
					 var command	= 'ffmpeg -f concat -safe 0 -i myfile -c copy ' + './routes/trimmed/outputvideo.webm';
					 if ( exec(command, (error, stdout, stderr) => {
						 console.log(stdout);
						 console.info("Program Started");
						 console.log(stderr);
						 if ( error !== null ) {
							 console.log(error)
							 console.log(`Concatatining Process Completed !`);
						 }
						 }).code !== 0) {
						 shell.echo("==");
					 }
				 }
			 }

		 ])
  });
  return callback(null, trimsLocations);
}

function rotateVideos(disableAudio, RotateValue, videoPath, callback){
	console.log("I'm Rotatted ");
	const rotatesLocations = [];
	let videoExtension = videoPath.split('.').pop().toLowerCase();
	var out_location = Path.join(__dirname, '/rotate/', `Rotatted_video_${Date.now()}_${parseInt(Math.random() * 10000)}`+ '.'+ videoExtension);
	rotatesLocations.push(out_location);

	if (RotateValue == 0 || RotateValue == 1 || RotateValue == 2 || RotateValue == 3 ){
		console.log("Disable Audio: " + disableAudio)
		if (disableAudio) {
			var cmd = 'ffmpeg -i ' + videoPath + ' -vf "transpose=' + RotateValue + '" ' + " -an " + out_location;
		} else {
			var cmd = 'ffmpeg -i ' + videoPath + ' -vf "transpose=' + RotateValue + '" '  + out_location;
		}
	}
	console.log("Command" + cmd);
	if ( exec(cmd, (error, stdout, stderr) => {
		console.log(stdout);
		console.info("Program Started");
		console.log(stderr);
		if (error !== null) {
			console.log(error)
			console.log(`Cropping Process Completed !`);
		}
		}).code !== 0) {
		shell.echo("==");
	}
 return callback( null, rotatesLocations);
}

function cropVideos(disableAudio, req, res, videoPath, callback) {
	const cropsLocations = [];
	let videoExtension = videoPath.split('.').pop().toLowerCase();
   var hash_name = 'video' + Date.now() + '.webm';
   var out_location = Path.join(__dirname, '/cropped/', `Cropped_video_${Date.now()}_${parseInt(Math.random() * 10000)}`+ '.'+ videoExtension);
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
   if ( exec(cmd, (error, stdout, stderr) => {
     console.log(stdout);
     console.info("Program Started");
     console.log(stderr);
     if ( error !== null ) {
       console.log( error )
       console.log( `Cropping Process Completed !` );
     }
     }).code !== 0) {
     shell.echo("==");
   }

  return callback(req, res, null, cropsLocations);
}

router.post('/send', function(req, res, next) {
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
  var videoPath = Path.join(__dirname, '/videos/', `video_${Date.now()}_${parseInt(Math.random() * 10000)}`+ '.'+ videoExtension);
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
				trimVideos(disableAudio, mode, trims, videoPath, (err, trimmedVideos) => {
				 res.render('index', {
					 message: "Trimming success"
				 });
				})
			}

			if (mode == "rotate"){
				rotateVideos(disableAudio, RotateValue, videoPath, (err, trimmedVideos) => {
					res.render('index',{
						message: "Rotating Sucess"
					});
				})
			}

			if (mode == "crop") {
				cropVideos( disableAudio, req, res, videoPath, (err, trimmedVideos) => {
		 		res.render('index', {
		 			message: "Cropping success"
		 		});
		 	 })
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
