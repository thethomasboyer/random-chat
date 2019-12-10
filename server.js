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

io.on('connection', (socket) => {
	console.log('a user connected');
	socket.on('salut', (data) => {
		console.log('got a ping')
		socket.emit('Yo', {message : 'yo'})
	})

})

http.listen(8080, () => {
	console.log('Listening on port 8080')
})

module.exports = app