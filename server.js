/* eslint-disable indent */

/*******************************************/
/* /////////// Server creation \\\\\\\\\\\ */
/*******************************************/

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


/*******************************************/
/* ///////////// pseudo-DB \\\\\\\\\\\\\\\ */
/*******************************************/

/* Fixed array of available chat rooms.
/* A socket should be part of less than one
 * of these at any given time. */
let chat_rooms = ['1', '2']
let nb_chat_rooms = chat_rooms.length // fixed for now

/* Array of "people" object.
 * To each socket(.id) corresponds a unique human-chosen username.
 * --- Model ---
 * user = { 
 *  id: socket.id,     (<- string  - unique hash given by socket.io)
 *  username: usrnm,   (<- string  - chosen by user)
 *  room: i            (<- integer - managed by server)
 * }
 * --- 'pseudo-DB' ---
 * users = [user1, user2, ...] */
let users = []


/*******************************************/
/* /////////////// Utils \\\\\\\\\\\\\\\\\ */
/*******************************************/


// function searchForChatRoomAvoidUser(socket, user, room_index = 0) {
//     /* Recursively search for an available chat room, avoiding 'user'.
//      * If chat room of index 'room_index' in array 'chat_rooms'
//      * full, or 'user' in it, try next, if existing. */
//     let room = chat_rooms[room_index]
//     io.in(room).clients((error, clients) => {
//         if (error) console.log(error)
//         //try less than 1 member in room and 'user' not member
//         if (clients.length < 2 && !(user in clients)) {
//             changeRoom(socket, room)
//         } else if (room_index + 1 < nb_chat_rooms) {
//             //if not suitable, try next chat room, if existing
//             searchForChatRoomAvoidUser(socket, user, room_index + 1)
//         } else {
//             //else retry whole search process later
//             console.log(
//                 'no room found for socket ' +
//                 socket.id +
//                 ', searching again in 3s',
//             )
//             setTimeout(searchForChatRoom, 3000, socket)
//         }
//     })
// }

function searchForChatRoom(socket, room_index = 0, first_connection = false) {
    /* Recursively search for an available chat room.
     * If chat room of index 'room_index' in array 'chat_rooms'
     * is full, try next, if existing. 
     * If none found, retry from beginning in 3s. */
    let room = chat_rooms[room_index]
    io.in(room).clients((error, clients) => {
        if (error) console.log(error)
        if (clients.length < 2) {
            changeRoom(socket, room, first_connection, () => { })
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

function changeRoom(socket, room, first_connection = false, callback) {
    /* Make socket leave its current chat room (if existing, 
     * and if not first connection), and join 'room' 
     * (to ensure uniqueness). */
    // Get user's current chat room
    let socket_room = findEmittingRoom(socket, first_connection)
    // If found, and if not first connection...
    if (socket_room != undefined && !first_connection) {
        // ...leave it...
        socket.leave(socket_room, () => {
            console.log('socket ' + socket.id + ' left room ' + room)
            io.to(socket.id).emit('left room', socket_room)
            // ...then join the new one
            joinRoom(socket, room, first_connection, callback)
        })
    } else joinRoom(socket, room, first_connection, callback)
}

function joinRoom(socket, room, first_connection, callback) {
    /* Simply join the given room, without any checks.
     * Then, get/emit details from/to that new room, if it isn't 'general',
     * and update the pseudo-DB. 
     * The callback does not wait for details. */
    socket.join(room, () => {
        console.log('socket ' + socket.id + ' joined room ' + room)
        /* Update DB */
        changeRoomToUserObjInDB(socket, room)
        /* Get/Emit details, and/or callback */
        if (room != 'general') {
            // Get room details
            emitNewRoomDetailsToSocket(socket, first_connection, room)
            // Broadcast details of socket to new room
            broadcastSocketDetailsToNewRoom(socket, room)
        }
        callback()
    })
}

function changeRoomToUserObjInDB(socket, room) {
    /* Update the pseudo-DB changing 'room' attribute
    * to socket. */
    getUserFromSocket(socket, user => {
        if (user === undefined) {
            console.log('Error: user is undefined in changeRoomToUserObjInDB!')
        } else {
            user.room = room
        }
    })
}

function getUserFromSocket(socket, callback) {
    /* Return to callback the (first) 'user' element
    * of list 'users' which id corresponds to that of socket. */
    let user = users.find(usr => usr.id === socket.id)
    callback(user)
}

function broadcastSocketDetailsToNewRoom(socket, new_room) {
    /* Broadcast sockets' det... ok just read the title. */
    let usrnm = findUsername(socket.id)
    socket.broadcast.to(new_room).emit('hello', {
        id: socket.id,
        username: usrnm
    })
}

function emitNewRoomDetailsToSocket(socket, first_connection, new_room) {
    /* Emit new room details to joining socket. */
    getInterloc(socket, first_connection, (interloc) => {
        getUsernamefromgetInterlocReturn(interloc, (usrnm) => {
            io.to(socket.id).emit('joined room', { room: new_room, interlocutor: usrnm })
        })
    })
}

function getInterloc(socket, first_connection, callback) {
    /* Get the interlocutor' socket id and username of a given user (socket).
     * Assumes there are no more than 2 people by chat room. */
    let emitting_room = findEmittingRoom(socket, first_connection)
    if (emitting_room != undefined) {
        let interloc_id
        io.in(emitting_room).clients((error, clients) => {
            if (error) console.log(error)
            for (let client of clients) {
                if (client != socket.id) {
                    interloc_id = client
                    let usrnm
                    if (interloc_id != undefined) usrnm = findUsername(interloc_id)
                    else usrnm = undefined
                    var interloc = { id: interloc_id, username: usrnm }
                    return callback(interloc)
                } // COMMENTS/SEPARATE CODE PLZ
            }
            return callback(undefined)
        })
    } else {
        if (!first_connection) console.log('Error: couldn\'t find emitting room for socket ' + socket.id + ' in getInterloc!')
        return callback(undefined)
    }
}

function getUsernamefromgetInterlocReturn(interloc, callback) {
    /* Callback on getInterloc return, becauz async's hard bruh */
    let usrnm = undefined
    if (interloc === undefined) usrnm = undefined
    else usrnm = interloc.username
    callback(usrnm)
}

function findEmittingRoom(socket, first_connection = false) {
    /* Return the emitting room the socket is in.
     * Assumes that the socket is only part of 'general',
     * one chat room or less, and its own.
     * Will log to console if not found, unless
     * first connection specified  */
    let rooms = Object.keys(socket.rooms)
    let emitting_room = undefined
    for (let room of rooms) {
        if (room != socket.id && room != 'general') {
            emitting_room = room
            break
        } // .filter ?
    }
    if (emitting_room === undefined && !first_connection) {
        console.log(
            'Error: couldn\'t find emitting room for socket ' + socket.id + ' in findEmittingRoom!',
        )
    } else emitting_room
}

function findUsername(socket_id) {
    /* Get the username of a user's id.
     * Assumes the socket has a valid (ie existing and unique)
     * username in "users" list. 
     * Returns undefined if socket_id is undefined. */
    if (socket_id === undefined) {
        console.log('Error: socket is undefined in findUsername!')
        return undefined
    } else for (let i = 0; i < users.length; i++) {
        if (users[i].id == socket_id) {
            return users[i].username
        }
    }
}

function createLeavingMessageInfo(socket, callback) {
    getUserFromSocket(socket, user => {
        if (user === undefined) callback(undefined, undefined)
        else callback(user.room, user.username)
    })
}

/*******************************************/
/* ///////////// Entry point \\\\\\\\\\\\\ */
/*******************************************/

/* On connection of socket... */
io.on('connect', socket => {
    /* Add user to pseudo-DB */
    users.push({ id: socket.id, username: undefined, room: undefined })

    console.log('-> socket ' + socket.id + ' just connected ->')

    /* Send connection confirmation */
    io.to(socket.id).emit('connection success')

    /* Everybody joins 'general' on first connection */
    changeRoom(socket, 'general', true, () => {
        // Then, tell everybody else somebody just connected,
        // and upgrade the peoplecounter
        io.in('general').clients((error, clients) => {
            if (error) console.log(error)
            socket.broadcast.to('general').emit('greeting', {
                newcommer: socket.id,
                peoplecount: clients.length,
            })
        })
    })

    /* Check username proposals */
    socket.on('username proposal', (username) => {
        if (users.some(user => (user.username == username))) {
            // reject
            io.to(socket.id).emit('used username')
        } else {
            // accept
            getUserFromSocket(socket, user => {
                if (user === undefined) {
                    console.log('Error: couldn\'t find user with id ' + socket.id + ' in DB!')
                    io.to(socket.id).emit('error finding user in DB')
                } else {
                    // write to DB, confirm username to socket
                    user.username = username
                    io.to(socket.id).emit('accepted username', username)
                    /* Initiate chat logic */
                    /* Check for an available chat room, loop until found */
                    searchForChatRoom(socket, 0, true)
                }
            })
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
        // Find the room it originates from (NOT undefined-proof)
        let emitting_room = findEmittingRoom(socket)
        // get the username of the sender (undefined-proof)
        let username = findUsername(socket)
        if (emitting_room != undefined) {
            // Send the message back to the room, but not to the sender
            socket.broadcast.to(emitting_room).emit('chat message', {
                message: msg,
                sender: username,
            })
        } else {
            console.log('Error: could not find emitting room while chat message received!')
            // Send back an error message
            io.to(socket.id).emit('message sending error')
        }
    })

    /* Send typing indicator message */
    socket.on('user typing', () => {
        //find the room it originates from
        let emitting_room = findEmittingRoom(socket)
        if (emitting_room != undefined) {
            //send the message back to the room, but not to the sender
            socket.broadcast.to(emitting_room).emit('user typing')
        } else {
            console.log('Error: could not find emitting room while user typing message received!')
        }
    })

    /* Change of interlocutor ON HOLD */
    /* socket.on('change interloc', () => {
        console.log('User ' + socket.id + ' asked to change interlocutor')
        let interloc = (socket)
        searchForChatRoomAvoidUser(socket, interloc.id)
    }) */

    /* Handle disconnection */
    socket.on('disconnect', reason => {
        console.log('<- socket ' + socket.id + ' just left ; cause: ' + reason + ' <-')
        // Remove the leaving user from "users" list
        // (assuming only one user corresponding to id)
        let username
        for (let i = 0; i < users.length; i++) {
            if (users[i].id == socket.id) {
                username = users[i].username
                users.splice(i, 1); break
            }
        }
        // Tell everybody somebody just left
        io.in('general').clients((error, clients) => {
            if (error) console.log(error)
            io.to('general').emit('byebye', {
                leaver: username,
                peoplecount: clients.length,
            })
        })
        // Tell the chat room there's a leaver
        createLeavingMessageInfo(socket, (room, usrnm) => {
            if (room === undefined) {
                console.log('Error: room is undefined while creating leaving message!')
            } else {
                socket.broadcast.to(room).emit('leaving', {
                    id: socket.id,
                    username: usrnm
                })
            }
        })
    })
})

/*******************************************/
/* //////////// server start \\\\\\\\\\\\\ */
/*******************************************/

http.listen(8080, () => {
    console.log('-----------------------\nListening on port 8080\n-----------------------\n')
})

module.exports = app
