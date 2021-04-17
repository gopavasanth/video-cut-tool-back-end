const UserModel = require('./models/User')
let io;
const createSocketConnection = (server, options) => {
	if (io) return io;
	io = require('socket.io')(server, options);
	io.on('connection', socket => {
		socket.on('authenticate', data => {
			UserModel.updateOne({ mediawikiId: data.mediawikiId }, { $set: { socketId: socket.id }})
				.then(() => {
					console.log('update ocket id', data, socket.id)
				})
				.catch(err => {
					console.log('error updating socket id')
				})
		})
	})
	return io;
}

module.exports = createSocketConnection;