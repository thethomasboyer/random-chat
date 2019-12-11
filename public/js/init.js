var socket = io()
/* callback on id='sendButton' button on click event */
function listenToSendButton() {
    // get the message input element
    let inputField = document.getElementById("userMessageInputField")
    // get its value
    let message = inputField.value
    // do nothing if message is empty
    if (message == "") {
        return false
    }
    // otherwise send it to the room...
    socket.emit('chat message', message)
    // ...and empty the input field
    inputField.value = ""
    console.log("Message sent: '" + message + "' to room: " + socket.room)
}

/* handling newly received messages */
function listenToIncomingMessages() {
    socket.on('chat message', (msg) => {
        console.log("Message received: " + msg + " on room: " + socket.room)
        // get already displayed messages
        let messages = document.getElementById("messages")
        // display new ones
        let new_message = document.createElement('li')
        new_message.appendChild(document.createTextNode(msg));
        messages.appendChild(new_message)
    })
}

/* handling room changes */
function listenToRoomChange() {
    // if a 'room change' message is received...
    socket.on('room change', (room_id) => {
        /* ...clean messages here...
        * but useles because no messages are supposed to
        * have been sent. No ? :) */
        // change the socket room
        // beware that socket.room here is socket.room.id on server
        socket.room = room_id
        console.log("Received room change order, now on room " + socket.room)
    })
}

/* global logic entry point */
function init() {
    // start listening to room change
    listenToRoomChange()
    // start listening to incom..
    listenToIncomingMessages()
}