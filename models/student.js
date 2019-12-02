const mongoose = require('mongoose')

const Schema = mongoose.Schema

const UserSchema = new Schema({
    identifiant: Number,
    first_name: String,
    marks: Array,
})

const UserModel = mongoose.model('User', UserSchema)

module.export = UserModel
