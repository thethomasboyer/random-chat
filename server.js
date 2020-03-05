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
app.use('/', require('./routes/router'))

/* fixed array of available chat rooms */
/* a socket should be part of less than one
 * of these at any given time */
let chat_rooms = ['1', '2']
let nb_chat_rooms = chat_rooms.length

/* Array of "people" object.
 * To each socket(.id) corresponds a unique human-chosen username.
 * Model : users = [
 * { id: socket.id, username: username },
 * ] */
let users = []

function changeRoom(socket, room, first_connection = false) {
    /* Make socket leave its current chat room (if existing),
     * and join 'room' (to ensure uniqueness)*/
    // Get user's current chat room
    let socket_room = findEmittingRoom(socket, first_connection)
    // If found...
    if (socket_room != undefined && !first_connection) {
        // ...leave it
        socket.leave(socket_room, () => {
            console.log('socket ' + socket.id + ' left room ' + room)
            io.to(socket.id).emit('left room', socket_room)
        })
    }
    // Get interlocutor (possibly undefined)
    let interloc = getInterloc(socket)
    let usrnm
    if (interloc === undefined) usrnm = undefined
    else usrnm = interloc.username
    // Join given room...
    socket.join(room, () => {
        console.log('socket ' + socket.id + ' joined room ' + room)
        io.to(socket.id).emit('joined room', { room: room, interlocutor: usrnm })
    })
    // ... and general if first connection
    if (first_connection) {
        socket.join('general', () => {
            console.log('socket ' + socket.id + ' joined general')
        })
    }
}

function searchForChatRoom(socket, room_index = 0, first_connection = false) {
    /* Recursively search for an available chat room.
     * If chat room of index 'room_index' in array 'chat_rooms'
     * is full, try next, if existing. 
     * If none found, retry from beginning in 3s. */
    let room = chat_rooms[room_index]
    io.in(room).clients((error, clients) => {
        if (error) console.log(error)
        if (clients.length < 2) {
            changeRoom(socket, room, first_connection)
        } else if (room_index + 1 < nb_chat_rooms) {
            searchForChatRoom(socket, room_index + 1, first_connection)
        } else {
            console.log(
                'no available room found for socket ' +
                socket.id +
                ', searching again in 3s',
            )
            setTimeout(searchForChatRoom, 3000, socket, 0, first_connection)
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
        } else {
            //else retry whole search process later
            console.log(
                'no room found for socket ' +
                socket.id +
                ', searching again in 3s',
            )
            setTimeout(searchForChatRoom, 3000, socket)
        }
    })
}

function findEmittingRoom(socket, first_connection = false) {
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
        console.log(
            'error: couldn\'t find emitting room for socket ' + socket.id + '!',
        )
    } else return emitting_room
}

function getInterloc(socket) {
    /* Get the interlocutor' socket id and username of a given user (socket).
     * Assumes there are no more than 2 people by chat room. */
    let emitting_room = findEmittingRoom(socket)
    if (emitting_room != undefined) {
        let interloc_id
        io.in(emitting_room).clients((error, clients) => {
            if (error) console.log(error)
            for (let client of clients) {
                if (client != socket.id) {
                    interloc_id = client
                    break
                }
            }
        })
        let usrnm = findUsername(interloc_id)
        return { id: interloc_id, username: usrnm }
    } else console.log('error: couldn\'t find emitting room!')
}

function findUsername(socket) {
    /* Get the username of a user (socket).
     * Assumes the socket has a valid (ie unique)
     * username in "users" list. */
    for (let i = 0; i < users.length; i++) {
        if (users[i].id == socket.id) {
            return users[i].username
        }
    }
}

/***********************/
/* /// Entry point \\\ */
/***********************/
io.on('connect', socket => {
    console.log('socket ' + socket.id + ' just connected')

    /* Send connection confirmation... */
    io.to(socket.id).emit('connection success')

    /* ...and tell everybody else somebody just connected */
    io.in('general').clients((error, clients) => {
        if (error) console.log(error)
        socket.broadcast.to('general').emit('greeting', {
            newcommer: socket.id,
            peoplecount: clients.length,
        })
    })

    /* Check username proposals */
    socket.on('username proposal', (username) => {
        if (users.some(user => (user.username == username))) {
            // reject
            io.to(socket.id).emit('used username')
        } else {
            // accept
            users.push({ id: socket.id, username: username })
            io.to(socket.id).emit('accepted username', username)
            /* Initiate chat logic */
            /* Check for an available chat room, loop until found */
            searchForChatRoom(socket, 0, true)
        }
    })

    /* Respond to "people count" requests */
    socket.on('how many?', () => {
        io.in('general').clients((error, clients) => {
            if (error) console.log(error)
            io.to(socket.id).emit('how many?', clients.length)
        })
    })

    /* Transmit chat messages to adequate rooms */
    socket.on('chat message', msg => {
        //find the room it originates from
        let emitting_room = findEmittingRoom(socket)
        //get the username of the sender
        let username = findUsername(socket)
        if (emitting_room != undefined) {
            //send the message back to the room, but not to the sender
            socket.broadcast.to(emitting_room).emit('chat message', {
                message: msg,
                sender: username,
            })
        }
    })

    /* Send typing indicator message */
    socket.on('user typing', () => {
        //find the room it originates from
        let emitting_room = findEmittingRoom(socket)
        if (emitting_room != undefined) {
            //send the message back to the room, but not to the sender
            socket.broadcast.to(emitting_room).emit('user typing')
        }
    })

    /* Change of interlocutor */
    socket.on('change interloc', () => {
        console.log('User ' + socket.id + ' asked to change interlocutor')
        let interloc = getInterloc(socket)
        searchForChatRoomAvoidUser(socket, interloc.id)
    })

    /* Handle disconnection */
    socket.on('disconnect', reason => {
        console.log('socket ' + socket.id + ' just left ; cause: ' + reason)
        //remove the leaving user from "users" list
        //(assuming only one user corresponding to id)
        let username
        for (let i = 0; i < users.length; i++) {
            if (users[i].id == socket.id) {
                username = users[i].username
                users.splice(i, 1); break
            }
        }
        io.in('general').clients((error, clients) => {
            if (error) console.log(error)
            io.to('general').emit('byebye', {
                leaver: username,
                peoplecount: clients.length,
            })
        })
    })
})

http.listen(8080, () => {
    console.log('Listening on port 8080')
})

module.exports = app
