const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const authController = require('./controllers/authController');

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('yay MongoDB connected'))
  .catch(err => console.error('shit error:', err));

app.get('/health', (req, res) => {
  res.json({ service: 'user-service', status: 'healthy' });
});

app.post('/auth/register', authController.register);
app.post('/auth/login', authController.login);
app.get('/users/:id?', authController.getProfile);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`yay user service done, port ${PORT}`);
});