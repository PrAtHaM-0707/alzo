const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { customAlphabet } = require('nanoid');
const User = require('../models/User');
const Medication = require('../models/Medication');
const Video = require('../models/Video');
const Appointment = require('../models/Appointment');
const SosAlert = require('../models/SosAlert');
const CaregiverPatient = require('../models/CaregiverPatient');
const pusher = require('../config/pusher');
const MedicalRecord = require('../models/MedicalRecord');
const router = express.Router();

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    console.log('No token provided in request');
    return res.status(401).json({ message: 'Access token required' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user; // Expects { user: { id, email } }
    console.log('Token verified, user ID:', req.user.id);
    next();
  } catch (err) {
    console.error('Token verification failed:', err.message);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

// Signup
router.post('/signup', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
  }
  const { name, email, password } = req.body;
  try {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
          console.log('User already exists:', email);
          return res.status(400).json({ message: 'User already exists' });
      }
      const now = new Date();
      const newUser = new User({
          name,
          email: email.toLowerCase(),
          password
      });
      // Prevent future createdAt dates
      if (newUser.createdAt > now) {
          console.warn('Future createdAt detected in signup:', newUser.createdAt);
          newUser.createdAt = now;
          newUser.updatedAt = now;
      }
      await newUser.save();
      console.log('User signed up:', email);
      // Fixed JWT payload
      const token = jwt.sign({ user: { id: newUser._id, email: newUser.email } }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ token });
  } catch (err) {
      console.error('Signup error:', err.message);
      res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Login validation errors:', errors.array());
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    const { email, password } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    console.log('Login attempt for email:', normalizedEmail);
    try {
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        console.log('User not found:', normalizedEmail);
        return res.status(400).json({ message: 'Invalid credentials' });
      }
      const isMatch = password === user.password;
      if (!isMatch) {
        console.log('Password mismatch for email:', normalizedEmail);
        return res.status(400).json({ message: 'Invalid credentials' });
      }
      console.log('Login successful for email:', user.email);
      // Fixed JWT payload
      const token = jwt.sign({ user: { id: user.id, email: user.email } }, process.env.JWT_SECRET, { expiresIn: '1h' });
      let redirectUrl = '/role';
      if (user.role) {
        switch (user.role) {
          case 'patient':
            redirectUrl = '/patient/pat.html';
            break;
          case 'caregiver':
            redirectUrl = '/caregiver/care.html';
            break;
          case 'doctor':
            redirectUrl = '/doctor/doc.html';
            break;
        }
      }
      console.log(`Redirecting to ${redirectUrl} for role ${user.role || 'none'}`);
      res.json({ token, redirect: redirectUrl });
    } catch (err) {
      console.error('Login error:', err.message);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

// Get user data
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      console.log('User not found for ID:', req.user.id);
      return res.status(404).json({ message: 'User not found' });
    }
    console.log('User fetched:', user.email);
    res.json({
      name: user.name,
      email: user.email,
      role: user.role,
      patientId: user.patientId || null,
      sosNumber: user.sosNumber || null,
      specialty: user.specialty || null
    });
  } catch (err) {
    console.error('Get user error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Select role
router.post('/select-role', authenticateToken, [
  body('role').isIn(['patient', 'caregiver', 'doctor']).withMessage('Invalid role'),
  body('specialty').if((value, { req }) => req.body.role === 'doctor').notEmpty().withMessage('Specialty is required for doctors')
], async (req, res) => {
  try {
      const user = await User.findById(req.user.id);
      if (!user) {
          console.log('User not found:', req.user.id);
          return res.status(404).json({ message: 'User not found' });
      }
      if (user.role) {
          console.log('Role already set:', user.email, user.role);
          return res.status(400).json({ message: 'Role already set' });
      }
      user.role = req.body.role;
      if (req.body.role === 'patient') {
          user.condition = req.body.condition || 'Stable';
          if (!user.patientId) {
              user.patientId = nanoid(); 
          }
      } else if (req.body.role === 'doctor') {
          user.specialty = req.body.specialty;
      }
      const now = new Date();
      if (user.createdAt > now) {
          console.warn('Future createdAt detected in select-role:', user.createdAt);
          user.createdAt = now;
          user.updatedAt = now;
      }
      await user.save();
      console.log('Role selected:', user.email, user.role, 'patientId:', user.patientId || 'none');
      // Define redirect based on role
      const redirects = {
          patient: '/patient/pat.html',
          caregiver: '/caregiver/care.html',
          doctor: '/doctor/doc.html'
      };
      res.json({ 
          message: 'Role selected successfully', 
          role: user.role, 
          redirect: redirects[user.role] 
      });
  } catch (err) {
      console.error('Select role error:', err.message);
      res.status(500).json({ message: 'Server error', error: err.message });
  }
});
router.get('/caregiver/patients/:patientId/medical-records', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'caregiver') {
      console.log('User not a caregiver:', req.user.id);
      return res.status(403).json({ message: 'Only caregivers can view patient medical records' });
    }

    const patient = await User.findOne({ patientId: req.params.patientId, role: 'patient' });
    if (!patient) {
      console.log('Patient not found:', req.params.patientId);
      return res.status(404).json({ message: 'Patient not found' });
    }

    const association = await CaregiverPatient.findOne({
      caregiverId: req.user.id,
      patientId: patient._id
    });
    if (!association) {
      console.log('Patient not associated with caregiver:', req.params.patientId);
      return res.status(403).json({ message: 'You are not managing this patient' });
    }

    const records = await MedicalRecord.find({ patientId: patient._id }).sort({ timestamp: -1 });
    console.log('Medical records fetched for patient:', { patientId: req.params.patientId, count: records.length });
    res.json(records);
  } catch (err) {
    console.error('Get patient medical records error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
// Update patient condition
router.patch('/doctor/patients/:id/condition', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const patient = await User.findById(req.params.id);
    if (!patient || patient.role !== 'patient') {
      console.log('Patient not found:', req.params.id);
      return res.status(404).json({ message: 'Patient not found' });
    }
    const { condition } = req.body;
    if (!['Stable', 'Critical', 'Recovering', 'Under Observation'].includes(condition)) {
      console.log('Invalid condition:', condition);
      return res.status(400).json({ message: 'Invalid condition' });
    }
    patient.condition = condition;
    await patient.save();
    console.log(`Patient ${patient._id} condition updated to ${condition}`);
    pusher.trigger('notifications', 'patient-condition-update', {
      id: patient._id,
      patientName: patient.name,
      condition,
      time: new Date()
    });
    res.json({ message: 'Condition updated', condition });
  } catch (err) {
    console.error('Update condition error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update name
router.patch(
  '/update-name',
  authenticateToken,
  [body('name').notEmpty().withMessage('Name is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Update name validation errors:', errors.array());
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    const { name } = req.body;
    console.log('Update name request:', { userId: req.user.id, name });
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        console.log('User not found for ID:', req.user.id);
        return res.status(404).json({ message: 'User not found' });
      }
      user.name = name;
      await user.save();
      console.log('Name updated:', { email: user.email, name });
      res.json({ message: 'Name updated successfully', name });
    } catch (err) {
      console.error('Update name error:', err.message);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

// Update SOS number
router.patch(
  '/update-sos',
  authenticateToken,
  [body('sosNumber').matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Update SOS validation errors:', errors.array());
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    const { sosNumber } = req.body;
    console.log('Update SOS request:', { userId: req.user.id, sosNumber });
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        console.log('User not found for ID:', req.user.id);
        return res.status(404).json({ message: 'User not found' });
      }
      user.sosNumber = sosNumber;
      await user.save();
      console.log('SOS number updated:', { email: user.email, sosNumber });
      res.json({ message: 'SOS number updated successfully', sosNumber });
    } catch (err) {
      console.error('Update SOS error:', err.message);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

// Add patient to caregiver's list
router.post(
  '/caregiver/add-patient',
  authenticateToken,
  [body('patientId').notEmpty().withMessage('Patient ID is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Add patient validation errors:', errors.array());
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    const { patientId } = req.body;
    console.log('Add patient request:', { userId: req.user.id, patientId });
    try {
      const user = await User.findById(req.user.id);
      const patient = await User.findOne({ patientId, role: 'patient' });
      if (!patient) {
        console.log('Patient not found for ID:', patientId);
        return res.status(404).json({ message: 'Patient not found' });
      }
      const existingAssociation = await CaregiverPatient.findOne({
        caregiverId: req.user.id,
        patientId: patient._id
      });
      if (existingAssociation) {
        console.log('Patient already associated:', patientId);
        return res.status(400).json({ message: 'Patient already in your list' });
      }
      const association = new CaregiverPatient({
        caregiverId: req.user.id,
        patientId: patient._id
      });
      await association.save();
      console.log('Patient added to caregiver:', { caregiver: user.email, patientId });
      pusher.trigger('notifications', 'new-patient-added', {
        id: association._id,
        patientName: patient.name,
        time: new Date()
      });
      res.status(201).json({ message: 'Patient added successfully', patientId });
    } catch (err) {
      console.error('Add patient error:', err.message);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);
// Remove patient from caregiver's list
router.delete(
  '/caregiver/remove-patient',
  authenticateToken,
  [body('patientId').notEmpty().withMessage('Patient ID is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Remove patient validation errors:', errors.array());
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    const { patientId } = req.body;
    console.log('Remove patient request:', { userId: req.user.id, patientId });

    try {
      const user = await User.findById(req.user.id);
   const patient = await User.findOne({ patientId, role: 'patient' });
      if (!patient) {
        console.log('Patient not found for ID:', patientId);
        return res.status(404).json({ message: 'Patient not found' });
      }

      const association = await CaregiverPatient.findOneAndDelete({
        caregiverId: req.user.id,
        patientId: patient._id
      });
      if (!association) {
        console.log('Patient not associated with caregiver:', patientId);
        return res.status(400).json({ message: 'Patient not in your list' });
      }

      console.log('Patient removed from caregiver:', { caregiver: user.email, patientId });
      res.json({ message: 'Patient removed successfully' });
    } catch (err) {
      console.error('Remove patient error:', err.message);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

// Caregiver send SOS alert for patient
router.post(
  '/caregiver/sos',
  authenticateToken,
  [body('patientId').notEmpty().withMessage('Patient ID is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('SOS validation errors:', errors.array());
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    const { patientId } = req.body;
    console.log('Caregiver SOS request:', { userId: req.user.id, patientId });
    try {
      const user = await User.findById(req.user.id);
      const patient = await User.findOne({ patientId, role: 'patient' });
      if (!patient) {
        console.log('Patient not found for ID:', patientId);
        return res.status(404).json({ message: 'Patient not found' });
      }
      const association = await CaregiverPatient.findOne({
        caregiverId: req.user.id,
        patientId: patient._id
      });
      if (!association) {
        console.log('Patient not associated with caregiver:', patientId);
        return res.status(403).json({ message: 'You are not managing this patient' });
      }
      const doctors = await User.find({ role: 'doctor' });
      if (doctors.length === 0) {
        console.log('No doctors found for SOS alert');
        return res.status(404).json({ message: 'No doctors available' });
      }
      const sosAlerts = doctors.map(doctor => ({
        patientId: patient._id,
        doctorId: doctor._id,
        caregiverId: req.user.id,
        status: 'active',
        createdAt: new Date()
      }));
      const insertedAlerts = await SosAlert.insertMany(sosAlerts);
      console.log(`SOS alert sent by caregiver ${user.email} for patient ${patientId} to ${doctors.length} doctors`);
      insertedAlerts.forEach(alert => {
        pusher.trigger('notifications', 'new-sos-alert', {
          id: alert._id,
          patientName: patient.name,
          time: alert.createdAt
        });
      });
      res.status(201).json({ message: 'SOS alert sent successfully' });
    } catch (err) {
      console.error('Send SOS error:', err.message);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

// Get caregiver dashboard stats
router.get('/caregiver/stats', authenticateToken, async (req, res) => {
  console.log('Get caregiver stats request:', { userId: req.user.id });

  try {
    const user = await User.findById(req.user.id);
  const associations = await CaregiverPatient.find({ caregiverId: req.user.id });
    const patientIds = associations.map(assoc => assoc.patientId);

    const totalPatients = patientIds.length;
    const patients = await User.find({ _id: { $in: patientIds }, role: 'patient' }).select('condition');
    const conditionBreakdown = {
      Stable: 0,
      Critical: 0,
      Recovering: 0,
      'Under Observation': 0
    };
    patients.forEach(patient => {
      conditionBreakdown[patient.condition]++;
    });

    const totalSosAlerts = await SosAlert.countDocuments({
      patientId: { $in: patientIds },
      status: 'active'
    });

    // Mock recent activity and tasks (replace with real data if available)
    const recentActivity = associations.length > 0 ? [
      { message: `Added patient`, timestamp: new Date() }
    ] : [];
    const tasks = totalPatients > 0 ? [
      { description: 'Check medication schedules', priority: 'High' }
    ] : [];

    console.log('Stats fetched:', { totalPatients, conditionBreakdown, totalSosAlerts });
    res.json({
      totalPatients,
      conditionBreakdown,
      totalSosAlerts,
      recentActivity,
      tasks
    });
  } catch (err) {
    console.error('Get stats error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get managed patients (minimal data)
router.get('/caregiver/patients', authenticateToken, async (req, res) => {
  console.log('Get managed patients request:', { userId: req.user.id });

  try {
    const user = await User.findById(req.user.id);
  const associations = await CaregiverPatient.find({ caregiverId: req.user.id });
    const patientIds = associations.map(assoc => assoc.patientId);

    const patients = await User.find({ _id: { $in: patientIds }, role: 'patient' }).select('name patientId condition');

    console.log('Patients fetched:', patients.length);
    res.json(patients.map(patient => ({
      name: patient.name,
      patientId: patient.patientId,
      condition: patient.condition
    })));
  } catch (err) {
    console.error('Get patients error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get patient details for caregiver
router.get('/caregiver/patient/:patientId', authenticateToken, async (req, res) => {
  const { patientId } = req.params;
  console.log('Get patient details request:', { userId: req.user.id, patientId });

  try {
    const user = await User.findById(req.user.id);
   const patient = await User.findOne({ patientId, role: 'patient' }).select('name email patientId condition');
    if (!patient) {
      console.log('Patient not found for ID:', patientId);
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Verify caregiver-patient association
    const association = await CaregiverPatient.findOne({
      caregiverId: req.user.id,
      patientId: patient._id
    });
    if (!association) {
      console.log('Patient not associated with caregiver:', patientId);
      return res.status(403).json({ message: 'You are not managing this patient' });
    }

    // Fetch medications for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const medications = await Medication.find({
      patientId: patient._id,
      date: { $gte: today, $lt: tomorrow }
    }).select('name time taken');

    // Fetch recent appointments
    const appointments = await Appointment.find({ patientId: patient._id })
      .populate('doctorId', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    // Fetch active SOS alerts
    const sosAlerts = await SosAlert.find({ patientId: patient._id, status: 'active' })
      .populate('doctorId', 'name')
      .sort({ createdAt: -1 });

    const vitalSigns = {
      bloodPressure: '120/80',
      lastCheck: new Date().toISOString()
    };

    console.log('Patient details fetched:', { patientId, medications: medications.length, appointments: appointments.length, sosAlerts: sosAlerts.length });
    res.json({
      patient: {
        name: patient.name,
        email: patient.email,
        patientId: patient.patientId,
        condition: patient.condition,
        age: 70, 
        room: 'Unknown'
      },
      medications,
      appointments,
      sosAlerts,
      vitalSigns
    });
  } catch (err) {
    console.error('Get patient details error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Caregiver profile
router.get('/caregiver/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name email sosNumber');
    res.json({ name: user.name, email: user.email, sosNumber: user.sosNumber || '' });
  } catch (err) {
    console.error('Get caregiver profile error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update caregiver profile
router.patch(
  '/caregiver/profile',
  authenticateToken,
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('sosNumber').optional().matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Update caregiver profile validation errors:', errors.array());
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    const { name, sosNumber } = req.body;
    console.log('Update caregiver profile request:', { userId: req.user.id, name, sosNumber });

    try {
      const user = await User.findById(req.user.id);
      user.name = name;
      user.sosNumber = sosNumber || '';
      await user.save();
      console.log('Caregiver profile updated:', { email: user.email, name, sosNumber });
      res.json({ message: 'Profile updated successfully', name, sosNumber });
    } catch (err) {
      console.error('Update caregiver profile error:', err.message);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

// Change caregiver password
router.patch(
  '/caregiver/change-password',
  authenticateToken,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Change password validation errors:', errors.array());
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    const { currentPassword, newPassword } = req.body;
    console.log('Change password request:', { userId: req.user.id });

    try {
      const user = await User.findById(req.user.id);
      const isMatch = currentPassword === user.password; 
      if (!isMatch) {
        console.log('Current password incorrect for user:', user.email);
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      user.password = newPassword; 
      await user.save();
      console.log('Password changed for user:', user.email);
      res.json({ message: 'Password changed successfully' });
    } catch (err) {
      console.error('Change password error:', err.message);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

// Validate patient ID
router.post('/caregiver/validate-patient', authenticateToken, async (req, res) => {
  const { patientId } = req.body;
  console.log('Validate patient ID request:', { userId: req.user.id, patientId });

  try {
    const user = await User.findById(req.user.id);
    const patient = await User.findOne({ patientId, role: 'patient' });
    if (!patient) {
      console.log('Patient not found for ID:', patientId);
      return res.status(404).json({ message: 'Patient not found' });
    }

    console.log('Patient validated:', patient.email);
    res.json({ message: 'Patient validated', patientId: patient.patientId });
  } catch (err) {
    console.error('Validate patient error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get doctor profile
router.get('/doctor/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name email specialty');
    res.json({ name: user.name, email: user.email, specialty: user.specialty || '' });
  } catch (err) {
    console.error('Get doctor profile error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update doctor profile
router.patch(
  '/doctor/profile',
  authenticateToken,
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('specialty').optional().isString().withMessage('Specialty must be a string')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Update doctor profile validation errors:', errors.array());
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    const { name, specialty } = req.body;
    console.log('Update doctor profile request:', { userId: req.user.id, name, specialty });
    try {
      const user = await User.findById(req.user.id);
    user.name = name;
      user.specialty = specialty || '';
      await user.save();
      console.log('Doctor profile updated:', { email: user.email, name, specialty });
      res.json({ message: 'Profile updated successfully', name, specialty });
    } catch (err) {
      console.error('Update doctor profile error:', err.message);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

// Get patient profile
router.get('/patient/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name email sosNumber');
    res.json({ name: user.name, email: user.email, sosNumber: user.sosNumber || '' });
  } catch (err) {
    console.error('Get patient profile error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Change patient password
router.patch(
  '/patient/change-password',
  authenticateToken,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Change password validation errors:', errors.array());
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    const { currentPassword, newPassword } = req.body;
    console.log('Change password request:', { userId: req.user.id });
    try {
      const user = await User.findById(req.user.id);
     const isMatch = currentPassword === user.password; // Replace with bcrypt.compare if hashing
      if (!isMatch) {
        console.log('Current password incorrect for user:', user.email);
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      user.password = newPassword; // Replace with hashed password
      await user.save();
      console.log('Password changed for user:', user.email);
      res.json({ message: 'Password changed successfully' });
    } catch (err) {
      console.error('Change password error:', err.message);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

// Change doctor password
router.patch(
  '/doctor/change-password',
  authenticateToken,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Change password validation errors:', errors.array());
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    const { currentPassword, newPassword } = req.body;
    console.log('Change password request:', { userId: req.user.id });
    try {
      const user = await User.findById(req.user.id);
      const isMatch = currentPassword === user.password;
      if (!isMatch) {
        console.log('Current password incorrect for user:', user.email);
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      user.password = newPassword;
      await user.save();
      console.log('Password changed for user:', user.email);
      res.json({ message: 'Password changed successfully' });
    } catch (err) {
      console.error('Change password error:', err.message);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

// Get doctor dashboard stats
router.get('/doctor/stats', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
   const totalPatients = await User.countDocuments({ role: 'patient' });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const totalAppointmentsToday = await Appointment.countDocuments({
      doctorId: req.user.id,
      date: { $gte: today, $lt: tomorrow },
      status: 'approved'
    });
    const pendingAppointments = await Appointment.countDocuments({
      doctorId: req.user.id,
      status: 'pending'
    });
    const activePatients = await User.countDocuments({ role: 'patient' });
    console.log('Stats fetched:', { totalPatients, totalAppointmentsToday, pendingAppointments, activePatients });
    res.json({
      totalPatients,
      totalAppointmentsToday,
      pendingAppointments,
      activePatients
    });
  } catch (err) {
    console.error('Get stats error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all patients for doctor
router.get('/doctor/patients', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
   const patients = await User.find({ role: 'patient' }).select('name email patientId condition');
    console.log('Patients fetched:', patients.length);
    res.json(patients);
  } catch (err) {
    console.error('Get patients error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all doctors
router.get('/doctors', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
   const doctors = await User.find({ role: 'doctor' }).select('name _id specialty');
    console.log('Doctors fetched:', doctors.length);
    res.json(doctors);
  } catch (err) {
    console.error('Get doctors error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all appointments for doctor
router.get('/doctor/appointments', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const appointments = await Appointment.find({ doctorId: req.user.id })
      .populate('patientId', 'name email')
      .sort({ createdAt: -1 });
    console.log('Appointments fetched:', appointments.length);
    res.json(appointments);
  } catch (err) {
    console.error('Get appointments error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update appointment status
router.patch('/doctor/appointments/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      console.log('Invalid status:', status);
      return res.status(400).json({ message: 'Invalid status' });
    }
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment || appointment.doctorId.toString() !== req.user.id) {
      console.log('Appointment not found or unauthorized:', req.params.id);
      return res.status(404).json({ message: 'Appointment not found' });
    }
    appointment.status = status;
    await appointment.save();
    console.log(`Appointment ${appointment._id} updated to ${status}`);
    const patient = await User.findById(appointment.patientId).select('name');
    pusher.trigger('notifications', 'appointment-status', {
      id: appointment._id,
      status,
      time: new Date()
    });
    res.json({ message: 'Appointment updated', appointment });
  } catch (err) {
    console.error('Update appointment error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Add medication for patient
router.post(
  '/doctor/medications',
  authenticateToken,
  [
    body('patientId').notEmpty().withMessage('Patient ID is required'),
    body('name').notEmpty().withMessage('Medication name is required'),
    body('time').notEmpty().withMessage('Time is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Add medication validation errors:', errors.array());
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    const { patientId, name, time } = req.body;
    console.log('Add medication request:', { patientId, name, time });
    try {
      const user = await User.findById(req.user.id);
      const patient = await User.findOne({ patientId });
      if (!patient || patient.role !== 'patient') {
        console.log('Patient not found:', patientId);
        return res.status(404).json({ message: 'Patient not found' });
      }
      const medication = new Medication({
        patientId: patient._id,
        doctorId: req.user.id,
        name,
        time,
        date: new Date()
      });
      await medication.save();
      console.log('Medication added:', { patientId, name });
      pusher.trigger('notifications', 'new-medication', {
        id: medication._id,
        name,
        time: new Date()
      });
      res.status(201).json({ message: 'Medication added successfully', medication });
    } catch (err) {
      console.error('Add medication error:', err.message);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

// Get patient medications
router.get('/patient/medications', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
   const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const medications = await Medication.find({
      patientId: req.user.id,
      date: { $gte: today, $lt: tomorrow }
    });
    console.log('Medications fetched:', medications.length);
    res.json(medications);
  } catch (err) {
    console.error('Get medications error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update medication taken status
router.patch('/patient/medications/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const medication = await Medication.findById(req.params.id);
    if (!medication || medication.patientId.toString() !== req.user.id) {
      console.log('Medication not found or unauthorized:', req.params.id);
      return res.status(404).json({ message: 'Medication not found' });
    }
    medication.taken = !medication.taken;
    await medication.save();
    console.log(`Medication ${medication._id} updated to taken: ${medication.taken}`);
    res.json(medication);
  } catch (err) {
    console.error('Update medication error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get videos
router.get('/patient/videos', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const videos = await Video.find();
    console.log('Videos fetched:', videos.length);
    res.json(videos);
  } catch (err) {
    console.error('Get videos error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Book appointment
router.post('/patient/appointments', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const { doctorId, date, time, reason } = req.body;
    const appointment = new Appointment({
      patientId: req.user.id,
      doctorId,
      date,
      time,
      reason
    });
    await appointment.save();
    console.log(`Appointment created for patient ${user.email}`);
    const patient = await User.findById(req.user.id).select('name');
    pusher.trigger('notifications', 'new-appointment', {
      id: appointment._id,
      patientName: patient.name,
      time: appointment.createdAt
    });
    res.json({ message: 'Appointment booked', appointment });
  } catch (err) {
    console.error('Book appointment error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get patient appointments
router.get('/patient/appointments', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const appointments = await Appointment.find({ patientId: req.user.id })
      .populate('doctorId', 'name')
      .sort({ createdAt: -1 });
    console.log('Appointments fetched for patient:', appointments.length);
    res.json(appointments);
  } catch (err) {
    console.error('Get appointments error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Add video by doctor
router.post(
  '/doctor/videos',
  authenticateToken,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('url').isURL().withMessage('Valid URL is required'),
    body('description').optional().isString().withMessage('Description must be a string')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Add video validation errors:', errors.array());
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    const { title, url, description } = req.body;
    console.log('Add video request:', { title, url });
    try {
      const user = await User.findById(req.user.id);
      const video = new Video({
        title,
        url,
        description
      });
      await video.save();
      console.log('Video added:', { title });
      pusher.trigger('notifications', 'new-video', {
        id: video._id,
        title,
        time: new Date()
      });
      res.status(201).json({ message: 'Video added successfully', video });
    } catch (err) {
      console.error('Add video error:', err.message);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

// Create SOS alert
router.post('/patient/sos', authenticateToken, async (req, res) => {
  try {
    console.log('Starting SOS alert process for user:', req.user.id);
    const user = await User.findById(req.user.id);
    console.log('User found:', user ? user.email : 'Not found');
    const doctors = await User.find({ role: 'doctor' });
    console.log('Doctors found:', doctors.length);
    if (doctors.length === 0) {
      console.log('No doctors found for SOS alert');
      return res.status(404).json({ message: 'No doctors available' });
    }
    const sosAlerts = doctors.map(doctor => ({
      patientId: req.user.id,
      doctorId: doctor._id,
      status: 'active',
      createdAt: new Date()
    }));
    console.log('SOS alerts to insert:', sosAlerts.length);
    const insertedAlerts = await SosAlert.insertMany(sosAlerts);
    console.log('SOS alerts inserted:', insertedAlerts.length);
    console.log('Triggering Pusher for SOS alerts');
    insertedAlerts.forEach(alert => {
      pusher.trigger('notifications', 'new-sos-alert', {
        id: alert._id,
        patientName: user.name,
        time: alert.createdAt
      });
    });
    console.log('Pusher triggered successfully');
    res.status(201).json({ message: 'SOS alert sent to all doctors' });
  } catch (err) {
    console.error('Create SOS error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get SOS alerts for doctor
router.get('/doctor/sos-alerts', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
  const alerts = await SosAlert.find({ doctorId: req.user.id, status: 'active' })
      .populate('patientId', 'name email');
    console.log('SOS alerts fetched:', alerts.length);
    res.json(alerts);
  } catch (err) {
    console.error('Get SOS alerts error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Resolve SOS alert
router.patch('/doctor/sos-alerts/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
   const alert = await SosAlert.findById(req.params.id);
    if (!alert || alert.doctorId.toString() !== req.user.id) {
      console.log('SOS alert not found or unauthorized:', req.params.id);
      return res.status(404).json({ message: 'SOS alert not found' });
    }
    alert.status = 'resolved';
    await alert.save();
    console.log(`SOS alert ${alert._id} resolved`);
    res.json({ message: 'SOS alert resolved' });
  } catch (err) {
    console.error('Resolve SOS error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


router.post('/patient/medical-records', authenticateToken, async (req, res) => {
  try {
    // if (req.user.role !== 'patient') {
    //   return res.status(403).json({ message: 'Access denied' });
    // }
    const { title, description, imageUrl, publicId } = req.body;
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    const medicalRecord = new MedicalRecord({
      patientId: req.user.id,
      title,
      description,
      imageUrl,
      publicId,
      timestamp: new Date()
    });
    await medicalRecord.save();
    res.status(201).json({ message: 'Medical record saved' });
  } catch (err) {
    console.error('Error saving medical record:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get patient's medical records
router.get('/patient/medical-records', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'patient') {
      console.log('User not a patient:', req.user.id);
      return res.status(403).json({ message: 'Only patients can view medical records' });
    }

    const records = await MedicalRecord.find({ patientId: req.user.id }).sort({ timestamp: -1 });
    console.log('Medical records fetched:', records.length);
    res.json(records);
  } catch (err) {
    console.error('Get medical records error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Clear all medical records for a patient
router.delete('/patient/medical-records', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'patient') {
      console.log('User not a patient:', req.user.id);
      return res.status(403).json({ message: 'Only patients can clear medical records' });
    }

    const records = await MedicalRecord.find({ patientId: req.user.id });
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    // Delete images from Cloudinary
    for (const record of records) {
      if (record.publicId) {
        await cloudinary.uploader.destroy(record.publicId);
        console.log('Deleted Cloudinary image:', record.publicId);
      }
    }

    // Delete records from MongoDB
    await MedicalRecord.deleteMany({ patientId: req.user.id });
    console.log('Medical records cleared:', { patientId: req.user.id });
    res.json({ message: 'All medical records cleared successfully' });
  } catch (err) {
    console.error('Clear medical records error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
router.get('/doctor/patient/:id', authenticateToken, async (req, res) => {
  try {
    const patientId = req.params.id;

    // Fetch patient data
    const patient = await User.findById(patientId).select('name patientId condition age room');
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Fetch related data
    //const vitalSigns = await VitalSigns.findOne({ patientId }).select('bloodPressure');
    const medications = await Medication.find({ patientId }).select('name time taken');
    const appointments = await Appointment.find({ patientId }).select('reason date time status');
    const sosAlerts = await SosAlert.find({ patientId, status: 'active' }).select('createdAt');

    res.json({
      patient,
      medications,
      appointments,
      sosAlerts
    });
  } catch (err) {
    console.error('Error fetching patient data:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
// Get medical records for a specific patient (for doctors, to be used later)
router.get('/doctor/patients/:id/medical-records', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'doctor') {
      console.log('User not a doctor:', req.user.id);
      return res.status(403).json({ message: 'Only doctors can view patient medical records' });
    }

    const patient = await User.findById(req.params.id);
    if (!patient || patient.role !== 'patient') {
      console.log('Patient not found:', req.params.id);
      return res.status(404).json({ message: 'Patient not found' });
    }

    const records = await MedicalRecord.find({ patientId: req.params.id }).sort({ timestamp: -1 });
    console.log('Medical records fetched for patient:', { patientId: req.params.id, count: records.length });
    res.json(records);
  } catch (err) {
    console.error('Get patient medical records error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


module.exports = router;