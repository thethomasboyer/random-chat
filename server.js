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

/* ALL rooms MUST have different ids */
let room1 = {
	id: 1,
	'population': 0
}

let room2 = {
	id: 2,
	'population': 0
}

let waitingroom = {
	id: 0,
	'population': 0
}

// array of available rooms
let rooms = [room1, room2]

function changeRoom(socket, room) {
	/* Make socket leave its previous room (if existing), and join 'room'. 
	* Asummption: socket is only part of one room (beside its own). */
	if (socket.room != undefined) { // in case of first connection
		socket.leave(socket.room.id) // leave previous room
		socket.room.population -= 1
	}
	socket.join(room.id) // join new room
	socket.room = room.id // set or change .room attribute
	room.population +=1
	// tell the user to connect on new room
	// sending the whole room json object
	socket.emit('room change', room)
	console.log('User "' + socket.id + '" was told to connect on room ' + socket.room)
}

// first connection = "entry point"
io.on('connection', (socket) => {
	// waitingroom is default at connection
	changeRoom(socket, waitingroom)

	// check for an available room, do what is necessary
	for (i=0; i<rooms.length; i++) {
		if (rooms[i].population < 2) {
			changeRoom(socket, rooms[i])
			break
		}
	}

	// wait for a chat message
	socket.on('chat message', (msg) => {
		console.log('Received chat message "' + msg + '" from room ' + socket.room +'. Sending it back')
		//send the message to the room
		io.to(socket.room).emit('chat message', msg)
	})

	// disconnection handling
	socket.on('disconnect', () => {
		// call of socket.leave() on all its channels is automatic
		socket.room.population -= 1
		console.log('User "' + socket.id + '" disconnected from room ' + socket.room)
	})
})

http.listen(8080, () => {
	console.log('Listening on port 8080')
})

module.exports = app