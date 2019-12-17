/* eslint-disable indent */

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

function changeRoom(socket, room, first_connection = false) {
    /* Make socket leave its current chat room (if existing),
    * and join 'room' */
    //get user's current chat room
    let socket_room = findRoom(socket, first_connection)
    //if found...
    if (socket_room != undefined) {
        //...leave it...
        socket.leave(socket_room, () => {
            console.log('socket ' + socket.id + ' left room ' + room)
            //...and join new one AFTER that
            socket.join(room, () => {
                console.log('socket ' + socket.id + ' joined room ' + room)
            })
        })
    } else socket.join(room, () => {
        console.log('socket ' + socket.id + ' joined room ' + room)
    })
}

function searchForChatRoom(socket, room_index = 0, first_connection = false) {
    /* Recursively search for an available chat room.
    * If chat room of index 'room_index' in array 'chat_rooms' 
    * full, try next, if existing. */
    let room = chat_rooms[room_index]
    io.in(room).clients((error, clients) => {
        if (error) console.log(error)
        if (clients.length < 2) {
            changeRoom(socket, room, first_connection)
        } else if (room_index + 1 < nb_chat_rooms) {
            searchForChatRoom(socket, room_index + 1, first_connection)
        } else {
            console.log('no available room found for socket ' + socket.id + ', searching again in 3s')
            setTimeout(searchForChatRoom, 3000, socket)
        }
    })
}

function searchForChatRoomAvoidUser(socket, user, room_index = 0) {
    /* Recursively search for an available chat room, avoiding 'user'.
    * If chat room of index 'room_index' in array 'chat_rooms' 
    * full, or 'user' in it, try next, if existing. */
    let room = chat_rooms[room_index]
    io.in(room).clients((error, clients) => {
        if (error) console.log(error)
        //try less than 1 member in room and 'user' not member
        if (clients.length < 2 && !(user in clients)) {
            changeRoom(socket, room)
        } else if (room_index + 1 < nb_chat_rooms) {
            //if not suitable, try next chat room, if existing
            searchForChatRoomAvoidUser(socket, user, room_index + 1)
        } else { //else retry whole search process later
            console.log('no room found for socket ' + socket.id + ', searching again in 3s')
            setTimeout(searchForChatRoom, 3000, socket)
        }
    })
}


function findRoom(socket, first_connection = false) {
	/* Return the emitting room the socket is in.
    * Assumes that the socket is only part of 'general', 
    * one chat room or less, and its own. 
    * Will log to console if not found, unless 
    * first connection specified  */
    let rooms = Object.keys(socket.rooms)
    let emitting_room
    for (let room of rooms) {
        if (room != socket.id && room != 'general') {
            emitting_room = room
            break
        } // .filter ?
    }
    if (emitting_room == undefined && !first_connection) {
        console.log('error: couldn\'t find emitting room!')
    } else return emitting_room
}

function getInterloc(socket) {
	/* Get the interlocutor of a socket.
    * Assumes there are no more than 2 people by chat room. */
    let emitting_room = findRoom(socket)
    if (emitting_room != undefined) {
        let interloc
        io.in(emitting_room).clients((error, clients) => {
            if (error) console.log(error)
            for (let client of clients) {
                if (client != socket.id) {
                    interloc = client
                    break
                }
            }
        })
        return interloc
    } else console.log('error: couldn\'t find interlocutor!')
}

/* ///entry point\\\ */
io.on('connect', socket => {
    console.log('socket ' + socket.id + ' just connected')
    // tell everybody somebody just connected
    io.in('general').clients((error, clients) => {
        if (error) throw error
        io.to('general').emit('greeting', {
            newcommer: socket.id,
            peoplecount: clients.length,
        })
    })

    /* all users join general */
    socket.join('general', () => {
        console.log('socket ' + socket.id + ' joined general')
    })

    /* check for an available chat room, loop until found */
    searchForChatRoom(socket, 0, true)

    /* transmit chat messages to adequate rooms */
    socket.on('chat message', msg => {
        //find the room it originates from
        let emitting_room = findRoom(socket)
        if (emitting_room != undefined) {
            console.log('Received chat message "' + msg + '" from room ' + emitting_room + ', transmitting')
            //send the message back to the room, but not to the sender
            socket.broadcast.to(emitting_room).emit('chat message', msg)
        }
    })

    /* Send typing indicator message */
    socket.on('user typing', () => {
        //find the room it originates from
        let emitting_room = findRoom(socket)
        if (emitting_room != undefined) {
            console.log('Received user typing message from room ' + emitting_room + ', transmitting')
            //send the message back to the room, but not to the sender
            socket.broadcast.to(emitting_room).emit('user typing')
        }
    })

    /* change interlocutor */
    socket.on('change interloc', () => {
        console.log('User ' + socket.id + ' asked to change interlocutor')
        let interloc = getInterloc(socket)
        searchForChatRoomAvoidUser(socket, interloc)
    })

    /* handle disconnection */
    socket.on('disconnect', reason => {
        console.log('socket ' + socket.id + ' just left ; cause: ' + reason)
        io.in('general').clients((error, clients) => {
            if (error) console.log(error)
            io.to('general').emit('byebye', { leaver: socket.id, peoplecount: clients.length }
            )
        })
    })
})

app.use('/route', require('./routes/route'))
app.listen(8080, () => {
    console.log('Listening on port 8080')
})

module.exports = app
