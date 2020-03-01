const fs = require('fs');
const path = require('path');
const async = require('async');


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
	videoPaths.forEach((video, index) => {
		moveFuncArray.push((cb) => {
			const videoName = `${currentDate}-${index}.${video.name.split('.').pop()}`;
			const newPath = path.join(__dirname, '../', 'public', `publicVideo-${videoName}`);
			newPaths.push(newPath);
			move(path.join(__dirname, video.path), newPath, (err) => {
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


module.exports = {
	move,
	moveVideosToPublic,
	// deleteFiles,
}
