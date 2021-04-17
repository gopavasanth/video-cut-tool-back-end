const mongoose = require('mongoose');

const uri = 'mongodb://localhost/video-cut-tool';

// ES6 Promises
mongoose.Promise = global.Promise;

// Connection to the DB before the tests run
before(() => {
	// Connection to the mongodb
	mongoose.connect(uri, { useNewUrlParser: true });

	mongoose.connection.once('open', () => {
		console.log('DB Connection has been made, now make fireworks...');
	}).on('error', error => {
		console.log('DB Connection error', error);
	});
});
