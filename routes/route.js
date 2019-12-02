const express = require('express')

const router = express.Router()

router.get('/maman', (req, res) => {
	res.send('Maman')
})

router.get('/papa', (req, res) => {
	res.send('Papa')
})

module.exports = router