var socket = io()

/* callback on id='sendButton' button on click event */
function sendMessage() {
    // get the message input element
    let inputField = document.getElementById('userMessageInputField')
    // get its value
    let message = inputField.value
    // do nothing if message is empty
    if (message == '') {
        return false
    }
    // otherwise send it to the room...
    // ... with the saved room number, for simplicity
    socket.emit('chat message', message)
    // ...and empty the input field
    inputField.value = ''
    console.log('Message sent: ' + message)
    appendNewMessage(message)
}

/* enter key triggers SendButton */
function enterKeySendsMessage() {
    document.addEventListener('keydown', e => {
        if (e.keyCode === 13) {
            // "Enter" key code
            sendMessage()
        }
    })
}

/* Check if user is typing */
function userIsTyping() {
    var searchTimeout
    document.getElementById('userMessageInputField').onkeypress = function() {
        if (searchTimeout != undefined) clearTimeout(searchTimeout)
        searchTimeout = setTimeout(function() {
            socket.emit('user typing')
        }, 250)
    }
}

/* update the page to display new message */
function appendNewMessage(msg) {
    // get already displayed messages
    let messages = document.getElementById('messages')
    // display new ones
    let new_message = document.createElement('li')
    new_message.appendChild(document.createTextNode(msg))
    messages.appendChild(new_message)
    window.scrollTo(0, document.body.scrollHeight)
}

/* handling newly received messages */
function listenToIncomingMessages() {
    socket.on('chat message', msg => {
        console.log('Message received: ' + msg)
        appendNewMessage(msg)
    })

    socket.on('user typing', () => {
        console.log('User is typing')
    })
}

/* print the people count */
function printPeopleCount() {
    socket.on('greeting', data => {
        console.log(data.newcommer + ' just connected to the Random Chat!')
        const count = data.peoplecount + 1
        let people_counter = document.getElementById('peopleCounter')
        if (count > 1) {
            people_counter.innerHTML =
                'Il y a actuellement ' + count + ' personnes connectées !'
        } else {
            people_counter.innerHTML = "Vous êtes seul(e)... :'("
        }
    })
}

/* global logic entry point */
function init() {
    // start listening to incom..
    listenToIncomingMessages()
    // print the people count
    printPeopleCount()
    // respond to "Enter" key press
    enterKeySendsMessage()
    // blabla
    userIsTyping()
}

init() // client-side logic starts here
