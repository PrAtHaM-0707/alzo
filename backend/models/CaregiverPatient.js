const mongoose = require('mongoose');

const caregiverPatientSchema = new mongoose.Schema({
  caregiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});


caregiverPatientSchema.index({ caregiverId: 1, patientId: 1 }, { unique: true });

module.exports = mongoose.model('CaregiverPatient', caregiverPatientSchema);