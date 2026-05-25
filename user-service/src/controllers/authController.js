const jwt = require('jsonwebtoken');
const User = require('../models/User');
const UserEventProducer = require('../kafka/producer');

const eventProducer = new UserEventProducer();
eventProducer.connect();

const generateToken = (user) => {
  return jwt.sign(
    { userId: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

exports.register = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      name
    });
    
    await eventProducer.userCreated(user);
    
    const token = generateToken(user);
    
    res.status(201).json({
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    user.lastLogin = new Date();
    await user.save();
    
    const token = generateToken(user);
    
    res.json({
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id || req.user.userId);
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};