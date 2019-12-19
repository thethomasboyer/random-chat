/* Initiate connection */
function connect() {
	/* Launch socket.io */
	const socket = io()
	// Start timer for connection timeout error
	let connection_error_pending = setTimeout(connectionError, 5000)
	/* Wait for connection succes confirmation */
	socket.on('connection success', () => {
		// Stop timer
		clearTimeout(connection_error_pending)
		/* Initiate chat logic */
		init(socket)
		overlayOff()
		let message = '<font size="3"><span uk-icon=\'icon: check; ratio: 1.5\'></span>  Vous êtes connecté !</font>'
		UIkit.notification({ message: message, pos: 'bottom-center', status: 'success' })
	})
}

function connectionError() {
	let message = '<font size="3"><span uk-icon=\'icon: warning; ratio: 1.5\'></span>  Il semble que vous ayez des difficultés à vous connecter...</font>'
	UIkit.notification({ message: message, pos: 'bottom-center', status: 'warning' })
}

function overlayOff() {
	document.getElementById('welcomePage').style.height = '0%'
}

var displayed_messages = document.getElementById('messages')

/* Callback on sendButton on click event */
function sendMessage(socket) {
	// get the message input element
	let inputField = document.getElementById('userMessageInputField')
	// get its value
	let message = inputField.value
	// do nothing if message is empty
	if (message == '') {
		return false
	}
	// otherwise send it to the room...
	socket.emit('chat message', message)
	// ...and empty the input field
	inputField.value = ''
	appendNewMessage(displayed_messages, message)
}

/* Ask the server: "Hey server, how many people are connected?" */
function askHowMany(socket) {
	socket.emit('how many?')
}

/* Enter key triggers SendButton */
function enterKeySendsMessage(socket) {
	document.addEventListener('keydown', (e) => {
		if (e.keyCode === 13) {// "Enter" key code
			sendMessage(socket)
		}
	})
}

/* Check if user is typing */
function checkUserIsTyping(socket) {
	var searchTimeout
	document.getElementById('userMessageInputField').onkeypress = function () {
		if (searchTimeout != undefined) clearTimeout(searchTimeout)
		searchTimeout = setTimeout(function () {
			socket.emit('user typing')
		}, 250)
	}
}

/* Update the page to display new message, received or sent */
function appendNewMessage(displayed_messages, new_msg) {
	// display new ones
	let new_message = document.createElement('li')
	new_message.appendChild(document.createTextNode(new_msg))
	displayed_messages.appendChild(new_message)
	// scroll to bottom
	window.scrollTo(0, document.body.scrollHeight)
}

/* Update people counter */
function updatePeopleCounter(count) {
	let people_counter = document.getElementById('peopleCounter')
	if (count > 1) {
		people_counter.innerHTML = 'Il y a actuellement ' + count + ' personnes connectées !'
	} else {
		people_counter.innerHTML = 'Vous êtes seul(e)... :\'('
	}
}

/* Change interlocutor */
function changeInterlocutor(socket) {
	socket.emit('change interloc')
	console.log('asked to change interlocutor, must be boring')
}

/* Handle received messages */
function listenToIncomingMessages(socket) {
	socket.on('chat message', (data) => {
		appendNewMessage(displayed_messages, data.message)
	})

	socket.on('user typing', () => {
		console.log('User is typing')
	})

	socket.on('change interloc', () => {
		//displayed_messages.innerHTML = ''
		console.log('Now talking to a brand new face!')
	})

	socket.on('greeting', (data) => {
		// display a notification
		let notif = '<font size="2"><span uk-icon=\'icon: user\'></span> ' + data.newcommer + ' vient de se connecter !</font>'
		UIkit.notification({ message: notif, pos: 'top-right' })
		const count = data.peoplecount + 1
		updatePeopleCounter(count)
	})

	socket.on('byebye', (data) => {
		// display a notification
		let notif = '<font size="2"><span uk-icon=\'icon: user\'></span> ' + data.leaver + ' vient de partir !</font>'
		UIkit.notification({ message: notif, pos: 'top-right' })
		const count = data.peoplecount - 1
		updatePeopleCounter(count)
	})

	socket.on('how many?', (count) => {
		updatePeopleCounter(count)
	})
}

/* global entry point */
function init(socket) {
	/* Ask how many people connected */
	askHowMany(socket)
	/* Listen to incoming messages */
	listenToIncomingMessages(socket)
	/* Respond to "Enter" key press */
	enterKeySendsMessage(socket)
	/* Check if user is typing */
	checkUserIsTyping(socket)
}
