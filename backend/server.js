const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..')));

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch((err) => console.error('MongoDB connection error:', err));

app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'land1.html'));
});
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'signup.html'));
});
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'login.html'));
});
app.get('/role', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'role.html'));
});
app.get('/patient/pat.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'patient', 'pat.html'));
});
app.get('/patient/settings.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'patient', 'settings.html'));
});
app.get('/doctor/doc.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'doctor', 'doc.html'));
});
app.get('/caregiver/care.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'caregiver', 'care.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});