const fs = require('fs');
const path = require('path');
const async = require('async');

const { exec, spawn } = require('child_process');

const eventEmitter = require('../eventEmitter');

function convertTimeToMs(timeArr) {
	let hour = timeArr[0] * 60 * 60 * 1000;
	let minute = timeArr[1] * 60 * 1000;
	let sec = timeArr[2].split('.')[0] * 1000;
	let ms = timeArr[2].split('.')[1] * 10;

	return hour + minute + sec + ms;
}

function updateProgressEmit(current, total, task) {
	eventEmitter.emit(
		'progress:update', 
		JSON.stringify({
			duration: total,
			time: current,
			currentTask: task
		})
	);
}

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
	const currentDate = Date.now();
    videoPaths.forEach((video,index) => {
        moveFuncArray.push((cb) => {
			const videoName = `${currentDate}-${index}.${video.split('.').pop()}`;
            const newPath = path.join(__dirname, '../', 'public', `publicVideo-${videoName}`);
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
	exec(cmd, (err, stderr, stdout) => {
		console.error(err)
		if (err) return callback(err);
		console.log("downloading success")

		const durationRegExp = new RegExp(/Duration: (\d{2}:\d{2}:\d{2}.\d{2})/);
		let videoDuration = stderr.length === 0
			? convertTimeToMs(stdout.match(durationRegExp)[1].split(':'))
			: convertTimeToMs(stderr.match(durationRegExp)[1].split(':'));

		return callback(null, videoDownloadPath, videoDuration);
	})
}

function trimVideos(videoPath, taskNum, trims, mode, callback) {
	const trimFuncArray = [];
	const trimsLocations = [];
	const videoExtension = videoPath.split('.').pop().toLowerCase();
	let newVideoDuration = 0;
	let time = 0;
	let newCurrentTimecode = 0;

	function getTrimmedTime(elem) {
		return (elem.to - elem.from) * 1000;
	}

	if (trims.length > 1) {
		let videoFrom = trims.reduce((from, b) => Math.min(from, b.from), trims[0].from);
		let videoTo = trims.reduce((to, b) => Math.max(to, b.to), trims[0].to);

		newVideoDuration = (videoTo - videoFrom) * 1000;
	}
	else {
		newVideoDuration = getTrimmedTime(trims[0]);
	}

	trims.forEach((element,index) => {
		trimFuncArray.push((callback) => {
			const videoLocation = path.join(__dirname, `trimmed-video-${Date.now()}.${videoExtension}`);
			trimsLocations.push(videoLocation);
			const cmd = spawn('ffmpeg', ['-i', videoPath, '-ss', element.from, '-to', element.to, '-async', 1, '-strict', 2, videoLocation, '-loglevel', 'info']);
			const timeRegExp = new RegExp(/time=(\d{2}:\d{2}:\d{2}.\d{2})/);

			cmd.stderr.on('data', (data) => {
				const decodedData = new Buffer.from(data, 'base64').toString('utf8');
				console.log(decodedData);
				if (timeRegExp.test(decodedData)) {
					if (trims.length === 1 || trims.length > 1 && index === 0) {
						time = convertTimeToMs(decodedData.match(timeRegExp)[1].split(':'));
					}
					if (trims.length > 1 && index > 0) {
						time = newCurrentTimecode + convertTimeToMs(decodedData.match(timeRegExp)[1].split(':'));
					}
					updateProgressEmit(time, newVideoDuration * taskNum, 'trimming');
				}
			});
			cmd.on('error', (err) => callback(err));
			cmd.on('close', (code) => {
				if (code === 0) {
					console.log("Trimming success");
					newCurrentTimecode = time;
					return callback(null, videoLocation);
				}
				console.log("Something happened with trimming");
				return callback(code);
			});
		});
	})

	async.series(trimFuncArray, () => {
		console.log('mode from trim', mode)
		return callback(null, trimsLocations, newVideoDuration);
	})
}

function concatVideos(videoPaths, videoDuration, currentTimecode, callback) {
	const videosListFileName = path.join(__dirname, `filelist-${Date.now()}`);
	videoPaths.forEach((videoLocation) => {
		fs.appendFileSync(videosListFileName, "file '" + videoLocation + "'\n");
	})

	const concatedLocation = path.join(__dirname, `concated-video-${Date.now()}.${videoPaths[0].split('.').pop()}`);
	const cmd = spawn('ffmpeg', ['-f', 'concat', '-safe', 0, '-i', videosListFileName, '-c', 'copy', concatedLocation, '-loglevel', 'info']);
	
	const timeRegExp = new RegExp(/time=(\d{2}:\d{2}:\d{2}.\d{2})/);
	let newCurrentTimecode = 0;

	cmd.stderr.on('data', (data) => {
		const decodedData = new Buffer.from(data, 'base64').toString('utf8');
		console.log(decodedData);
		if (timeRegExp.test(decodedData)) {
			let time = convertTimeToMs(decodedData.match(timeRegExp)[1].split(':'));
			newCurrentTimecode = time + currentTimecode;
			updateProgressEmit(newCurrentTimecode, videoDuration, 'concating');
		}
	});
	cmd.on('error', (err) => callback(err));
	cmd.on('close', (code) => {
		fs.unlink(videosListFileName, () => { });
		if (code === 0) {
			console.log("Concating success");
			return callback(null, concatedLocation, newCurrentTimecode);
		}
		console.log("Something happened with concating");
		return callback(code);
	});
}

function rotateVideos(videosPaths, videoDuration, currentTimecode, RotateValue, callback) {
	const rotatesLocations = [];
	const rotateFuncArray = [];
	let newCurrentTimecode = 0;
	
	videosPaths.forEach((videoPath) => {
		rotateFuncArray.push((cb) => {
			const videoExtension = videoPath.split('.').pop().toLowerCase();
			const rotatedLocation = path.join(__dirname, `rotated-video-${Date.now()}.${videoExtension}`);
			rotatesLocations.push(rotatedLocation);

			let commandArguments = [
				['-i', videoPath, '-vf', 'transpose=1', rotatedLocation, '-loglevel', 'info'],
				['-i', videoPath, '-vf', 'transpose=2,transpose=2', rotatedLocation, '-loglevel', 'info'],
				['-i', videoPath, '-vf', `transpose=${RotateValue}`, rotatedLocation, '-loglevel', 'info'],
				['-i', videoPath, '-vf', 'transpose=4', rotatedLocation, '-loglevel', 'info']
			];
			let cmd;

			switch (RotateValue) {
				case 0:
					cmd = spawn('ffmpeg', commandArguments[0]);
					break;
				case 1:
					cmd = spawn('ffmpeg', commandArguments[1]);
					break;
				case 2:
					cmd = spawn('ffmpeg', commandArguments[2]);
					break;
				default:
					cmd = spawn('ffmpeg', commandArguments[3]);
					break;
			}

			const timeRegExp = new RegExp(/time=(\d{2}:\d{2}:\d{2}.\d{2})/);

			cmd.stderr.on('data', (data) => {
				const decodedData = new Buffer.from(data, 'base64').toString('utf8');
				console.log(decodedData);
				if (timeRegExp.test(decodedData)) {
					let time = convertTimeToMs(decodedData.match(timeRegExp)[1].split(':'));
					newCurrentTimecode = time + currentTimecode;
					updateProgressEmit(newCurrentTimecode, videoDuration, 'rotating');
				}
			});
			cmd.on('error', (err) => cb(err));
			cmd.on('close', (code) => {
				if (code === 0) {
					console.log("Rotating success");
					return cb(null);
				}
				console.log("Something happened with rotating");
				return cb(code);
			});
		})
	})

	async.series(rotateFuncArray, (err) => {
		if (err) return callback(err);
		return callback(null, rotatesLocations, newCurrentTimecode);
	})
}

function cropVideos(videosPaths, videoDuration, currentTimecode, out_width, out_height, x_value, y_value, callback) {
	const cropsLocations = [];
	const cropsFuncArray = [];
	let newCurrentTimecode = 0;
	videosPaths.forEach((videoPath) => {
		cropsFuncArray.push((cb) => {
			const videoExtension = videoPath.split('.').pop().toLowerCase();
			const croppedLocation = path.join(__dirname, `cropped-video-${Date.now()}.${videoExtension}`);
			cropsLocations.push(croppedLocation);

			const cmd = spawn('ffmpeg', ['-i', videoPath, '-filter:v', `crop=${out_width / 100}*in_w:${out_height / 100}*in_h:${x_value / 100}*in_w:${y_value / 100}*in_h`, '-c:a', 'copy', croppedLocation, '-loglevel', 'info']);

			const timeRegExp = new RegExp(/time=(\d{2}:\d{2}:\d{2}.\d{2})/);

			cmd.stderr.on('data', (data) => {
				const decodedData = new Buffer.from(data, 'base64').toString('utf8');
				console.log(decodedData)
				if (timeRegExp.test(decodedData)) {
					let time = convertTimeToMs(decodedData.match(timeRegExp)[1].split(':'));
					newCurrentTimecode = time + currentTimecode;
					updateProgressEmit(newCurrentTimecode, videoDuration, 'cropping');
				}
			});
			cmd.on('error', (err) => cb(err));
			cmd.on('close', (code) => {
				if (code === 0) {
					console.log("Cropping success");
					return cb(null);
				}
				console.log("Something happened with cropping");
				return cb(code);
			});
		})
	});

	async.series(cropsFuncArray, (err) => {
		if (err) return callback(err);
		return callback(null, cropsLocations, newCurrentTimecode);
	})
}

function removeAudioFromVideos(videosPaths, videoDuration, currentTimecode, callback) {
	const removeAudioFunc = [];
	const clearedLocations = [];
	videosPaths.forEach((videoPath) => {
		removeAudioFunc.push((cb) => {
			const videoExtension = videoPath.split('.').pop().toLowerCase();
			const clearedLocation = path.join(__dirname, `cleared-video-${Date.now()}.${videoExtension}`);
			clearedLocations.push(clearedLocation);

			const cmd = spawn('ffmpeg', ['-i', videoPath, '-an', clearedLocation, '-loglevel', 'info']);

			const timeRegExp = new RegExp(/time=(\d{2}:\d{2}:\d{2}.\d{2})/);

			cmd.stderr.on('data', (data) => {
				const decodedData = new Buffer.from(data, 'base64').toString('utf8');
				console.log(decodedData)
				if (timeRegExp.test(decodedData)) {
					let time = convertTimeToMs(decodedData.match(timeRegExp)[1].split(':'));
					updateProgressEmit(time + currentTimecode, videoDuration, 'losing audio');
				}
			});
			cmd.on('error', (err) => cb(err));
			cmd.on('close', (code) => {
				if (code === 0) {
					console.log("Removing audio success");
					return cb();
				}
				console.log("Something happened with removing audio");
				return cb(code);
			});
		})
	})
	async.series(removeAudioFunc, (err) => {
		if (err) return callback(err);
		return callback(null, clearedLocations);
	})
}

function convertVideoFormat(videoPaths, videoDuration, currentTimecode, callback) {
	const convertFunc = [];
	const convertedLocations = [];
	videoPaths.forEach((videoPath) => {
		convertFunc.push((cb) => {
			const videoExtension = videoPath.split('.').pop().toLowerCase();
			if (!(['webm', 'ogv'].includes(videoExtension))) {
				const convertedLocation = path.join(__dirname, `converted-video-${Date.now()}.webm`);
				convertedLocations.push(convertedLocation);

				const timeRegExp = new RegExp(/time=(\d{2}:\d{2}:\d{2}.\d{2})/);
				const cmd = spawn('ffmpeg', ['-i', videoPath, '-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-b:a', '128k', '-c:a', 'libopus', convertedLocation]);

				cmd.stderr.on('data', (data) => {
					const decodedData = new Buffer.from(data, 'base64').toString('utf8');

					if (timeRegExp.test(decodedData)) {
						let time = convertTimeToMs(decodedData.match(timeRegExp)[1].split(':'));
						updateProgressEmit(time + currentTimecode, videoDuration, 'converting video format');
					}
				});
				cmd.on('error', (err) => {console.log('err',err);cb(err);})
				cmd.on('close', (code) => {
					if (code === 0) {
						console.log("Converting video format success");
						return cb();
					}
					console.log("Something happened with converting video format");
					return cb(code);
				});
			} else {
				console.log("video is already in supported format: ", videoExtension, ', skipping...');
				const convertedLocation = path.join(__dirname, `converted-video-${Date.now()}.${videoExtension}`);
				fs.rename(videoPath, convertedLocation, function (err) {
					if (err) {
						return cb(err.code);
					}
					convertedLocations.push(convertedLocation);
					return cb();
				});
			}
		});
	});
	async.series(convertFunc, (err) => {
		if (err) return callback(err);
		console.log('converted paths: ')
		return callback(null, convertedLocations);
	});
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
	convertVideoFormat,
	updateProgressEmit,
}
