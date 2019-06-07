var express = require('express');
var router = express.Router();
var path = require('path');

const Fs = require('fs')
const Path = require('path')
const Listr = require('listr')
const Axios = require('axios')
const shell = require('shelljs');
const { exec } = require('child_process');
var hash_name = 'video'

/* GET home page. */
router.get('/', function(req, res, next) {
 res.render('index', {
  title: 'VideoCutTool'
 });
});

function downloadVideo(url, callback) {
  let videoExtension = url.split('.').pop().toLowerCase();
  console.log("=== videoExtension === "+ videoExtension)
  console.log(__dirname + "/videos/");
  var videoPath = Path.join(__dirname, '/videos/', `video_${Date.now()}_${parseInt(Math.random() * 10000)}`+ '.'+ videoExtension);
  console.log("====== Video Path ====== " + videoPath)
  const writer = Fs.createWriteStream(videoPath);

  var cmd=("ffmpeg -y -i " +  url + " -vcodec copy -acodec copy " + videoPath);
  exec(cmd, (err) => {
      if (err) return callback(err);
      console.log("downloading success")
      return callback(null, videoPath);
  })
}

function trimVideos(trims, videoPath, callback) {
  let videoExtension = videoPath.split('.').pop().toLowerCase();

  const trimsLocations = [];
  trims.forEach((element, index) => {
   var hash_name = 'video' + index + Date.now() + '.webm';
   var i=0;
   var out_location = Path.join(__dirname, '/cropped/', `Trimmed_video_${Date.now()}_${parseInt(Math.random() * 10000)}`+ '.'+ videoExtension);

   trimsLocations.push(out_location);
   var cmd = 'ffmpeg -i ' + videoPath + ' -ss ' + element.from + ' -to ' + element.to + ' -async 1 -strict 2 ' + out_location;
   i++;
   console.log("Command" + cmd);

   if ( exec(cmd, (error, stdout, stderr) => {
     console.log(stdout);
     console.info("Program Started");
     console.log(stderr);
     if (error !== null) {
       console.log(error)
       console.log(`Trimming Successuful !`);
     }
     }).code !== 0) {
     shell.echo("==");
   }
  });

  return callback(null, trimsLocations);
}

router.post('/send', function(req, res, next) {
  console.log('Hit Send')
  const url = req.body.inputVideoUrl;
  let videoExtension = url.split('.').pop().toLowerCase();
  var videoPath = Path.join(__dirname, '/videos/', `video_${Date.now()}_${parseInt(Math.random() * 10000)}`+ '.'+ videoExtension);
  downloadVideo(url, (err, videoPath) => {
   if (err || !videoPath || !Fs.existsSync(videoPath)) {
     console.log(err)
     return res.status(400).send('Error downloading video');
   }

   trimVideos(req.body.trims, videoPath, (err, trimmedVideos) => {
    res.render('index', {
      message: "Trimming success"
    });
   })
 })

});

router.get('/insert', function(req, res, next) {
 res.sendFile(path.join(__dirname + "/" + "htmlfiles/insert.html"));
});

module.exports = router;
