/* eslint-disable indent */

/* Define connection status constants */
const NOT_CONNECTED = 1
const CONNECTION_PENDING = 2
const NO_USERNAME = 3
const USERNAME_PENDING = 4
const CHAT_ON = 5

let status = NOT_CONNECTED

let username

/* Initiate connection */
function connect() {
	/* If a connection attempt has already been emitted, don't try again... */
	if (status === CONNECTION_PENDING) return 1
	/* ...else, launch socket.io */
	else status = CONNECTION_PENDING
	var socket = io()
	/* Bind socket to document because fuck you that's the only thing working */
	document.socket = socket
	/* Start timer for connection timeout error */
	let connection_error_pending = setTimeout(connectionError, 3000)
	/* Wait for connection succes confirmation... */
	socket.on('connection success', () => {
		/* Stop timer, change status */
		clearTimeout(connection_error_pending)
		status = NO_USERNAME
		let message = '<font size="3"><span uk-icon=\'icon: check; ratio: 1.5\'></span>  Vous êtes connecté !</font>'
		UIkit.notification({ message: message, pos: 'bottom-center', status: 'success' })
		/* Reveal username form page */
		welcomPageOverlayOff()
		/* Enter key triggers a username proposal */
		document.addEventListener('keydown', enterKeyUsernameProp)
		/* Wait for username confirmation... */
		socket.on('accepted username', usrnm => {
			/* Cache username */
			username = usrnm
			/* Initiate chat logic */
			init(socket, username)
			let message = '<font size="3"><span uk-icon=\'icon: check; ratio: 1.5\'></span>  Bienvenue </font>' + username + '<font size="3"> !</font>'
			UIkit.notification({ message: message, pos: 'bottom-center', status: 'success' })
			/* Reveal chat page */
			usernameFormPageOverlayOff()
			/* Go chatting! */
			status = CHAT_ON
			/* Respond to "Enter" key press */
			document.addEventListener('keydown', enterKeySendsMsg)
		})
		/* ...or denial! */
		socket.on('used username', () => {
			status = NO_USERNAME
			let message = '<font size="3"><span uk-icon=\'icon: warning; ratio: 1.5\'></span>  Ton nom est déjà utilisé ! </font>'
			UIkit.notification({ message: message, pos: 'bottom-center', status: 'warning' })
			document.addEventListener('keydown', enterKeyUsernameProp)
		})
	})
}

/* Enter key triggers a connection attempt */
function enterKeyConnectAttempt(e) {
	if (e.key === 'Enter') connectionAttempt()
}

/* Enter key triggers a username proposal */
function enterKeyUsernameProp(e) {
	if (e.key === 'Enter') setUsername(document.socket)
}

function enterKeySendsMsg(e) {
	if (e.key === 'Enter') sendMessage(document.socket)
}

// Start by sending connection attempts
document.addEventListener('keydown', enterKeyConnectAttempt)

/* Display connection timeout notification */
function connectionError() {
	let message =
		'<font size="3"><span uk-icon=\'icon: warning; ratio: 1.5\'></span>  Il semble que vous ayez des difficultés à vous connecter...</font>'
	UIkit.notification({
		message: message,
		pos: 'bottom-center',
		status: 'warning',
	})
}

/* Remove welcome page overlay */
function welcomPageOverlayOff() {
	document.getElementById('welcomePage').style.height = '0%'
}

/* Remove username form page overlay */
function usernameFormPageOverlayOff() {
	document.getElementById('usernameFormPage').style.height = '0%'
}

/* COMMENTS PLEAZ */
function setUsername(socket) {
	document.removeEventListener('keydown', enterKeyUsernameProp)
	if (status === USERNAME_PENDING) return 1
	else status = USERNAME_PENDING
	let username = document.getElementById('usernameInputField').value
	if (username == '') {
		let message = '<font size="3"><span uk-icon=\'icon: question; ratio: 1.5\'></span> Tu n\'as pas de nom ? </font>'
		UIkit.notification({ message: message, pos: 'bottom-center' })
	} else if (username.length > 14) {
		let message = '<font size="3"><span uk-icon=\'icon: warning; ratio: 1.5\'></span> Ton nom est trop long ! </font>'
		UIkit.notification({ message: message, pos: 'bottom-center' })
	} else {
		status = USERNAME_PENDING
		let message = '<font size="3"><span uk-icon=\'icon: cog; ratio: 1.5\'></span> Checking username... </font>'
		UIkit.notification({ message: message, pos: 'bottom-center' })
		socket.emit('username proposal', username)
	}
}

var displayed_messages = document.getElementById('messages')

/* Callback on sendButton click or EnterKey event */
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
	// ...empty the input field...
	inputField.value = ''
	// ...and add it to displayed messages list
	appendNewMessage(displayed_messages, message, true, username)
}

/* Ask the server: "Hey server, how many people are connected?" */
function askHowMany(socket) {
	socket.emit('how many?')
}

/* Send a 'connect' message to server,
* remove event listener to prevent multiple connections */
function connectionAttempt() {
	document.removeEventListener('keydown', enterKeyConnectAttempt)
	connect()
}

/* Check if user is typing */
function checkUserIsTyping(socket) {
	var searchTimeout
	document.getElementById('userMessageInputField').onkeypress = () => {
		if (searchTimeout != undefined) clearTimeout(searchTimeout)
		searchTimeout = setTimeout(function () {
			socket.emit('user typing')
		}, 250)
	}
}

/* Update the page to display new message, received or sent.
* <source> is true if message is sent by user, false if received */
function appendNewMessage(displayed_messages, new_msg, source, username) {
	// display new ones
	let new_message_instance = document.createElement('li')
	let text = username + ': ' + new_msg
	new_message_instance.appendChild(document.createTextNode(text))
	displayed_messages.appendChild(new_message_instance)
	// scroll to bottom
	window.scrollTo(0, document.body.scrollHeight)
}

/* Update people counter */
function updatePeopleCounter(count) {
	let people_counter = document.getElementById('peopleCounter')
	if (count > 1) {
		people_counter.innerHTML =
			'Il y a actuellement ' + count + ' personnes connectées !'
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
	socket.on('chat message', data => {
		appendNewMessage(displayed_messages, data.message, false, data.sender)
	})

	socket.on('user typing', () => {
		console.log('User is typing')
	})

	socket.on('change interloc', () => {
		//displayed_messages.innerHTML = ''
		console.log('Now talking to a brand new face!')
	})

	socket.on('greeting', data => {
		// display a notification
		let notif =
			'<font size="2"><span uk-icon=\'icon: user\'></span> ' +
			data.newcommer +
			' vient de se connecter !</font>'
		UIkit.notification({ message: notif, pos: 'top-right' })
		const count = data.peoplecount + 1
		updatePeopleCounter(count)
	})

	socket.on('byebye', data => {
		// display a notification
		let notif =
			'<font size="2"><span uk-icon=\'icon: user\'></span> ' +
			data.leaver +
			' vient de partir !</font>'
		UIkit.notification({ message: notif, pos: 'top-right' })
		const count = data.peoplecount - 1
		updatePeopleCounter(count)
	})

	socket.on('how many?', count => {
		updatePeopleCounter(count)
	})
}

/* COMMENTS HERE */
function init(socket) {
	/* Ask how many people connected */
	askHowMany(socket)
	/* Listen to incoming messages */
	listenToIncomingMessages(socket)
	/* Check if user is typing */
	checkUserIsTyping(socket)
}
