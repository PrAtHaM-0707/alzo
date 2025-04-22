const { Schema, model } = require('mongoose');
const { nanoid } = require('nanoid');

const userSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['patient', 'caregiver', 'doctor']},
    patientId: { type: String, sparse: true }, 
    specialty: { type: String },
});

userSchema.pre('save', async function (next) {
    if (this.isNew && this.role === 'patient' && !this.patientId) {
        this.patientId = nanoid();
    }
    next();
});

module.exports = model('User', userSchema);