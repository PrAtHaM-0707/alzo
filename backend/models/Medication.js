const mongoose = require('mongoose');

const MedicationSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    time: { type: String, required: true },
    date: { type: Date, default: Date.now }, 
    taken: { type: Boolean, default: false }
});

module.exports = mongoose.model('Medication', MedicationSchema);