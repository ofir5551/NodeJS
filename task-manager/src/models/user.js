const mongoose = require('mongoose')
const validator = require('validator')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const Task = require('./task')

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        unique: true,
        required: true,
        trim: true,
        lowercase: true,
        validate: (value) => {
            if (!validator.isEmail(value)) {
                throw new Error('Email is invalid!')
            }
        }
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
        trim: true,
        validate: (value) => {
            if (value.includes('password')) {
                throw new Error('Password is invalid! (contains the word password)')
            }
        }
    },
    age: {
        type: Number,
        default: 0,
        validate: (value) => {
            if (value < 0) {
                throw new Error('age must be a positive number')
            }
        }
    },
    tokens: [{
        token: {
            type: String,
            required: true
        }
    }]
})

// Create a virtual property (a link between task.owner -> user._id)
// in order to set a relationship between the two.
userSchema.virtual('tasks', {
    ref:'Task',
    localField:'_id',
    foreignField:'owner'
})

// This function gets a user and strips all private data from it.
// Returns an object with all public user information.
userSchema.methods.toJSON = function () {
    const user = this
    const userObject = user.toObject()

    delete userObject.password
    delete userObject.tokens

    return userObject
}

// This function generates a jwt and stores 
// it in the database for the current user
userSchema.methods.generateAuthToken = async function () {
    const user = this
    const token = jwt.sign({ _id: user._id.toString() }, 'thisisasecrettoken', {expiresIn: '30 minutes'})

    user.tokens = user.tokens.concat({ token })
    await user.save()

    return token
}

// This function gets email and password, and verifies them
userSchema.statics.findByCredentials = async (email, password) => {
    const user = await User.findOne({ email: email })

    if (!user) {
        throw new Error('User not found')
    }

    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
        throw new Error('Password does not match')
    }

    return user
}



// Middleware for hashing the password using bcrypt algorithm
// This runs just before saving the document
userSchema.pre('save', async function (next) {
    const user = this

    if (user.isModified('password')) {
        user.password = await bcrypt.hash(user.password, 8)
    }

    next()
})

// Delete user tasks when user is deleted
userSchema.pre('remove', async function(next) {
    const user = this
    await Task.deleteMany({ owner: user._id})

    next()
})

const User = mongoose.model('User', userSchema)

module.exports = User