var express = require('express');
var router = express.Router();
var path = require('path');

const Fs = require('fs')
const Path = require('path')
const Listr = require('listr')
const Axios = require('axios')
const shell = require('shelljs');
var hash_name = 'video'

if( typeof trim.counter == 'undefined' && typeof tasks.counter == 'undefined' ){
    trim.counter = 0;
    tasks.counter = 0;
}

/* GET home page. */
router.get('/', function(req, res, next) {
 res.render('index', {
  title: 'VideoCutTool'
 });
});

/* Trims the Video using ffmpeg */
function trim(req, res) {
 const id = e.target.id;
 const index = id.match(/\d+/g).map(Number)[0];

 console.log("From"+req.body.trims[index].from);
 console.log("to"+req.body.trims[index].to);

 var hash_name = 'video'+trim.counter++;

 var in_location = Path.resolve(__dirname, 'videos', hash_name + '.mp4')
 var out_location = Path.resolve(__dirname, 'cropped', hash_name + '_trimmed.mp4')

 shell.echo(" " + trims[index].from + " " + trims[index].to + " " + in_location + " " + out_location);
 var count = index;
 while( count != 0 ) {
   var cmd = 'ffmpeg -i ' + in_location + ' -ss ' + req.body.trims[index].from + ' -t ' + req.body.trims[index].from + ' -async 1 ' + out_location;
   index++;
   count--;
 }
 // var cmd = 'ffmpeg -i ' + in_location + ' -ss ' + from_time + ' -t ' + to_time + ' -async 1 ' + out_location;
 console.log("Command" + cmd);

 if (shell.exec(cmd, (error, stdout, stderr) => {
   console.log(stdout);
   console.info("Program Started");
   console.log(stderr);
   if (error !== null) {
    console.log(`Trimming Successuful !`);
   }
  }).code !== 0) {
  shell.echo("Error");
 }
 res.render('index', {
  message: "success"
 });
}

/* Downloads the video. */
async function tasks(req) {
 const url = req.body.inputVideoUrl
 var hash_name = 'video'+tasks.counter++;
 const path = Path.resolve(__dirname, 'videos', hash_name + '.mp4')
 const writer = Fs.createWriteStream(path)

 const response = await Axios({
  url,
  method: 'GET',
  responseType: 'stream'
 })

 response.data.pipe(writer)
 console.log("downloaded")
 return new Promise((resolve, reject) => {
  writer.on('finish', resolve)
  writer.on('error', reject)
 })
}

/* Main function to start tasks(downloading the video and trimming the video)*/
async function start(req) {
 await tasks(req);
 trim(req);
}

router.post('/send', function(req, res, next) {
 console.log('Hit Send')

 start(req);

});

router.get('/insert', function(req, res, next) {
 res.sendFile(path.join(__dirname + "/" + "htmlfiles/insert.html"));
});

module.exports = router;
