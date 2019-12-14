const express = require('express')
const path = require('path')
// app represents the logic of the server.
const app = express()
// http is the server
const http = require('http').createServer(app)
const io = require('socket.io')(http)

// mark 'public' as the public dir
app.use(express.static(path.join(__dirname, 'public')))

// all routing logic is handled by routes/router.js
app.use('', require('./routes/router'))

/* array of available chat rooms */
/* a socket should be part of less than one 
* of these at any given time */
let chat_rooms = ['1', '2']
let nb_chat_rooms = chat_rooms.length

function searchForChatRoom(socket, room_index) {
    /* Recursively search for an available chat room.
    * If chat room of index 'room_index' in array 'chat_rooms' 
    * full or not responding: try next, if existing. */
    let room = chat_rooms[room_index]
    console.log('trying room: ' + room)
    io.in(room).clients( (error, clients) => {
        console.log('clients for room ' + room + ': ' + clients)
        if (error) throw error
        if (clients.length < 2) {
            socket.join(room, () => {
                console.log('socket ' + socket.id + ' joined room ' + room)
            })
        } else if (room_index + 1 < nb_chat_rooms) {
            searchForChatRoom(socket, room_index + 1)
        } else {    
            console.log('no available room found for socket ' + socket.id + ', searching again in 1s')
            setTimeout(searchForChatRoom, 1000, socket, 0)
        }
    })
}

/* ///entry point\\\ */
io.on('connect', (socket) => {
    console.log('socket ' + socket.id + ' just connected')
    // tell everybody somebody just connected
    io.in('general').clients( (error, clients) => {
        if (error) throw error
        io.to('general').emit('greeting', {newcommer: socket.id, peoplecount: clients.length}
        )
    })

    // all users join general
    socket.join('general', () => {
        console.log('socket ' + socket.id + ' joined general')
    })
    
    // check for an available chat room
    searchForChatRoom(socket, 0)

    // wait for a chat message
	socket.on('chat message', (msg) => {
        //find the room it originates from
        rooms = Object.keys(socket.rooms)
        let emitting_room
        for (room of rooms) {
            if (room != socket.id && room != 'general') {
                emitting_room = room
                break
            }
        }
        console.log('Received chat message "' + msg + '" from room ' + emitting_room +'. Sending it back')
        if (emitting_room == undefined) {
            console.log("error: couldn't find emitting room!")
        } else {
            //send the message to the room
            io.to(emitting_room).emit('chat message', msg)
            //socket.broadcast.to(room_id).emit('chat message', msg)
        }
        

	})
})

http.listen(8080, () => {
	console.log('----- Listening on port 8080 -----')
})

module.exports = app
