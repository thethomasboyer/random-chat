const express = require('express')

// app represents the server.
const app = express()

app.get('/', function(req, res) {
	res.send('Salut')
})

app.use('/route', require('./routes/route'))
app.listen(8080, () => {
	console.log('Listening on port 8080')
})

module.exports = app