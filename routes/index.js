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
  const videoExtension = url.split('.').pop().toLowerCase();
  const videoPath = Path.resolve(__dirname, 'videos', `video_${Date.now()}_${parseInt(Math.random() * 10000)}.${videoExtension}`);
  const writer = Fs.createWriteStream(videoPath)
  exec(`ffmpeg -y -i ${url} -vcodec copy -acodec copy ${videoPath}`, (err) => {
    if (err) return callback(err);
    return callback(null, videoPath);
  })
}

function trimVideos(trims, videoPath, callback) {
  const videoExtension = videoPath.split('.').pop().toLowerCase();
  const trimsLocations = [];

  trims.forEach((element, index) => {
    var hash_name = 'video' + index + Date.now() + '.' + videoExtension;
    console.log(element, index)
    var out_location = Path.resolve(__dirname, 'cropped', hash_name + '_trimmed.webm')
    trimsLocations.push(out_location);
    var cmd = 'ffmpeg -i ' + videoPath + ' -ss ' + element.from + ' -to ' + element.to + ' -async 1 -strict 2 ' + out_location;
    console.log("Command" + cmd);

   if (shell.exec(cmd, (error, stdout, stderr) => {
     console.log(stdout);
     console.info("Program Started");
     console.log(stderr);
     if (error !== null) {
       console.log(error)
       console.log(`Trimming Successuful !`);
     }
     }).code !== 0) {
     shell.echo("Error");
   }
  });

  return callback(null, trimsLocations);
}

router.post('/send', function(req, res, next) {
 console.log('Hit Send')
 const url = req.body.inputVideoUrl;

 downloadVideo(url, (err, videoPath) => {
   if (err || !videoPath || !Fs.existsSync(videoPath)) {
     return res.status(400).send('Error downloading video');
   } else {
     res.render('index', {
       message: "successfully video downloaded"
     });
   }
   console.log("video-downloaded successfully")
   trimVideos(req.body.trims, videoPath, (err, trimmedVideos) => {
    res.render('index', {
      message: "Trimming success"
    });
   })
 })
//  start(req, res);

});

router.get('/insert', function(req, res, next) {
 res.sendFile(path.join(__dirname + "/" + "htmlfiles/insert.html"));
});

module.exports = router;
