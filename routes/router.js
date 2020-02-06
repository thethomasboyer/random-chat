const express = require('express')
const path = require('path')
const router = express.Router()

router.get('/', (_, res) => {
    res.sendFile(path.join(__dirname, '../views', 'index.html'))
})

router.use((_, res) => {
    res.status(404).sendFile(path.join(__dirname, '../views', '404.html'))
})

module.exports = router