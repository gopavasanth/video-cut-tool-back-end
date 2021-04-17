const mocha = require('mocha');
const assert = require('assert');

const UserModel = require('../models/User');
const VideoModel = require('../models/Video');

describe('DB Saving records', () => {
	it('Saves user records to the database', function (done) {
		this.timeout(50000);
		const user = new UserModel({
			id: 'TestId',
			username: 'TestUser'
		});

		user.save().then(() => {
			assert(user.isNew === false);
			done();
		}).catch(done);
	});

	it('Saves video records to the database', function (done) {
		this.timeout(50000);
		const video = new VideoModel({
			url: 'https://commons.wikimedia.org/wiki/File:Carlos_Orsi_no_no_Lan%C3%A7amento_do_Instituto_Quest%C3%A3o_de_Ci%C3%AAncia.webm',
			status: 'queued'
		});

		video.save().then(() => {
			assert(video.isNew === false);
			done();
		}).catch(done);
	});
});
