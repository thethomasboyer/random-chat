const express = require('express')
const path = require('path')
// app represents the logic of the server.
const app = express()
// http is the server
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// mark 'public' as the public dir
app.use(express.static(path.join(__dirname, 'public')))

// all routing logic is handled by routes/router.js
app.use('', require('./routes/router'))

// first connection = "entry point"
io.on('connection', (socket) => {
	console.log('a user connected')

	// on connection, wait for a message
	socket.on('message', (msg) => {
		console.log('message: ' + msg)
		//send the message to everybody
		io.emit('message', msg)	
	})

	// disconnection handling
	socket.on('disconnect', () => {
		console.log('user disconnected')
	})
})

http.listen(8080, () => {
	console.log('Listening on port 8080')
})

module.exports = app