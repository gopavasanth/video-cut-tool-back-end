const fs = require('fs');
const path = require('path');
const async = require('async');

const { exec } = require('child_process');

function move(oldPath, newPath, callback) {
    fs.rename(oldPath, newPath, function (err) {
        if (err) {
            if (err.code === 'EXDEV') {
                copy();
            } else {
                callback(err);
            }
            return;
        }
        callback();
    });

    function copy() {
        var readStream = fs.createReadStream(oldPath);
        var writeStream = fs.createWriteStream(newPath);

        readStream.on('error', callback);
        writeStream.on('error', callback);

        readStream.on('close', function () {
            fs.unlink(oldPath, callback);
        });

        readStream.pipe(writeStream);
    }
}

function moveVideosToPublic(videoPaths, callback) {
    const moveFuncArray = [];
    const newPaths = [];
    videoPaths.forEach(video => {
        moveFuncArray.push((cb) => {
            const newPath = path.join(__dirname, '../', 'public', `publicVideo-${Date.now()}.${video.split('.').pop()}`);
            newPaths.push(newPath);
            move(video, newPath, (err) => {
                if (err) return cb(err);      
                return cb();
            })
        })
    });
    async.parallel(moveFuncArray, (err) => {
        if (err) return callback(err);
        return callback(null, newPaths);
    })
}

function deleteFiles(files) {
	files.forEach((file) => {
		fs.unlink(file, () => { });
	})
}

function downloadVideo(url, name, callback) {
	if ( name == null ){
		name = url;
	}
	let videoExtension = name.split('.').pop().toLowerCase();
	var videoDownloadPath = path.join(__dirname,`video_${Date.now()}_${parseInt(Math.random() * 10000)}` + '.' + videoExtension);
	var cmd = `ffmpeg -y -i "${url}" -vcodec copy -acodec copy "${videoDownloadPath}"`
	exec(cmd, (err) => {
		console.error(err)
		if (err) return callback(err);
		console.log("downloading success")
		return callback(null, videoDownloadPath);
	})
}

function trimVideos(videoPath, trims, mode, callback) {
	const trimFuncArray = [];
	const trimsLocations = [];
	const videoExtension = videoPath.split('.').pop().toLowerCase();

	trims.forEach((element) => {
		trimFuncArray.push((callback) => {
			const videoLocation = path.join(__dirname, `trimmed-video-${Date.now()}.${videoExtension}`);
			trimsLocations.push(videoLocation);
			var cmd = `ffmpeg -i "${videoPath}" -ss ${element.from} -to ${element.to} -async 1 -strict 2 "${videoLocation}"`;
			console.log("Command: " + cmd);
			exec(cmd, (error) => {
				if (error !== null) {
					console.log(error)
					console.log(`Trimminng Process error !`);
					return callback(error);
				}
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
	const videosListFileName = path.join(__dirname, `filelist-${Date.now()}`);
	videoPaths.forEach((videoLocation) => {
		fs.appendFileSync(videosListFileName, "file '" + videoLocation + "'\n");
	})

	const concatedLocation = path.join(__dirname, `concated-video-${Date.now()}.${videoPaths[0].split('.').pop()}`);
	var cmd = `ffmpeg -f concat -safe 0 -i "${videosListFileName}" -c copy "${concatedLocation}"`;
	exec(cmd, (err) => {
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
			const rotatedLocation = path.join(__dirname, `rotated-video-${Date.now()}.${videoExtension}`);
			rotatesLocations.push(rotatedLocation);
			if (RotateValue == 0){
				// 90 degree clock wise rotate
				var cmd = `ffmpeg -i "${videoPath}" -vf "transpose=1" "${rotatedLocation}"`;	
			} else if (RotateValue==1) {
				// 180 degree rotate
				var cmd = `ffmpeg -i "${videoPath}" -vf "transpose=2,transpose=2" "${rotatedLocation}"`;
			} else if (RotateValue ==2){
				// 270 degree rotate
				var cmd = `ffmpeg -i "${videoPath}" -vf "transpose=${RotateValue}" "${rotatedLocation}"`;
			} else {
				// 360 degree (Same as intial video)
				var cmd = `ffmpeg -i "${videoPath}" -vf "transpose=4" "${rotatedLocation}"`;
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
			const croppedLocation = path.join(__dirname, `cropped-video-${Date.now()}.${videoExtension}`);
			cropsLocations.push(croppedLocation);

			var cmd = `ffmpeg -i "${videoPath}" -filter:v "crop=${out_width / 100}*in_w:${out_height / 100}*in_h:${x_value / 100}*in_w:${y_value / 100}*in_h" -c:a copy "${croppedLocation}"`
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
			const clearedLocation = path.join(__dirname, `cleared-video-${Date.now()}.${videoExtension}`);
			clearedLocations.push(clearedLocation);
			const cmd = `ffmpeg -i "${videoPath}" -an "${clearedLocation}"`;
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

module.exports = {
    move,
    moveVideosToPublic,
    deleteFiles,
    downloadVideo,
    removeAudioFromVideos,
    cropVideos,
    rotateVideos,
    concatVideos,
    trimVideos,
}
