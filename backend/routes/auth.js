const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { customAlphabet } = require('nanoid');
const User = require('../models/User');
const Medication = require('../models/Medication');
const Video = require('../models/Video');
const Appointment = require('../models/Appointment');
const SosAlert = require('../models/SosAlert');

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
    req.user = decoded.user;
    console.log('Token verified, user ID:', req.user.id);
    next();
  } catch (err) {
    console.error('Token verification failed:', err.message);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

// Signup
router.post(
  '/signup',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Signup validation errors:', errors.array());
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    const { name, email, password } = req.body;
    console.log('Signup request:', { name, email: email.toLowerCase() });
    try {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        console.log('User already exists:', email.toLowerCase());
        return res.status(400).json({ message: 'User already exists' });
      }
      const newUser = new User({
        name,
        email: email.toLowerCase(),
        password,
      });
      await newUser.save();
      console.log('User created:', newUser.email);
      const payload = { user: { id: newUser.id } };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.status(201).json({ token, message: 'User created successfully' });
    } catch (err) {
      console.error('Signup error:', err.message);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

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
      const payload = { user: { id: user.id } };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
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
router.post('/select-role', authenticateToken, async (req, res) => {
  const { role } = req.body;
  if (!['patient', 'caregiver', 'doctor'].includes(role)) {
    console.log('Invalid role selected:', role);
    return res.status(400).json({ message: 'Invalid role' });
  }
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      console.log('User not found for ID:', req.user.id);
      return res.status(404).json({ message: 'User not found' });
    }
    user.role = role;
    if (role === 'patient') {
      if (!user.patientId) {
        user.patientId = nanoid();
        console.log('Generated patientId:', user.patientId);
      }
    } else {
      user.patientId = null;
    }
    await user.save();
    console.log('Role updated:', { email: user.email, role });
    res.json({ message: 'Role updated successfully', role, patientId: user.patientId });
  } catch (err) {
    console.error('Select role error:', err.message);
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

// Get doctor profile
router.get('/doctor/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name email specialty');
    if (user.role !== 'doctor') {
      console.log('Unauthorized access to doctor profile:', user.email);
      return res.status(403).json({ message: 'Unauthorized' });
    }
    console.log('Doctor profile fetched:', user.email);
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
      if (user.role !== 'doctor') {
        console.log('Unauthorized access to update profile:', user.email);
        return res.status(403).json({ message: 'Unauthorized' });
      }
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

// Get doctor dashboard stats
router.get('/doctor/stats', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'doctor') {
      console.log('Unauthorized access to stats:', user.email);
      return res.status(403).json({ message: 'Unauthorized' });
    }
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

// Get all patients
router.get('/doctor/patients', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'doctor') {
      console.log('Unauthorized access to patients:', user.email);
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const patients = await User.find({ role: 'patient' }).select('name email patientId');
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
    if (user.role !== 'patient') {
      console.log('Unauthorized access to doctors list:', user.email);
      return res.status(403).json({ message: 'Unauthorized' });
    }
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
    if (user.role !== 'doctor') {
      console.log('Unauthorized access to appointments:', user.email);
      return res.status(403).json({ message: 'Unauthorized' });
    }
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
    if (user.role !== 'doctor') {
      console.log('Unauthorized access to update appointment:', user.email);
      return res.status(403).json({ message: 'Unauthorized' });
    }
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
      if (user.role !== 'doctor') {
        console.log('Unauthorized access to add medication:', user.email);
        return res.status(403).json({ message: 'Unauthorized' });
      }
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
    if (user.role !== 'patient') {
      console.log('Unauthorized access to medications:', user.email);
      return res.status(403).json({ message: 'Unauthorized' });
    }
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
    if (user.role !== 'patient') {
      console.log('Unauthorized access to update medication:', user.email);
      return res.status(403).json({ message: 'Unauthorized' });
    }
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
    if (user.role !== 'patient') {
      console.log('Unauthorized access to videos:', user.email);
      return res.status(403).json({ message: 'Unauthorized' });
    }
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
    if (user.role !== 'patient') {
      console.log('Unauthorized access to book appointment:', user.email);
      return res.status(403).json({ message: 'Unauthorized' });
    }
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
    if (user.role !== 'patient') {
      console.log('Unauthorized access to appointments:', user.email);
      return res.status(403).json({ message: 'Unauthorized' });
    }
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
      if (user.role !== 'doctor') {
        console.log('Unauthorized access to add video:', user.email);
        return res.status(403).json({ message: 'Unauthorized' });
      }
      const video = new Video({
        title,
        url,
        description
      });
      await video.save();
      console.log('Video added:', { title });
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
    const user = await User.findById(req.user.id);
    if (user.role !== 'patient') {
      console.log('Unauthorized access to SOS:', user.email);
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const doctors = await User.find({ role: 'doctor' });
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
    await SosAlert.insertMany(sosAlerts);
    console.log(`SOS alert created for patient ${user.email} to ${doctors.length} doctors`);
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
    if (user.role !== 'doctor') {
      console.log('Unauthorized access to SOS alerts:', user.email);
      return res.status(403).json({ message: 'Unauthorized' });
    }
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
    if (user.role !== 'doctor') {
      console.log('Unauthorized access to resolve SOS:', user.email);
      return res.status(403).json({ message: 'Unauthorized' });
    }
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

module.exports = router;