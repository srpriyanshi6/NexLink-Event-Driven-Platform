const jwt = require('jsonwebtoken');
const User = require('../models/User');
const UserEventProducer = require('../kafka/producer');

const eventProducer = new UserEventProducer();
eventProducer.connect().catch(console.error);

const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user._id, 
      email: user.email, 
      role: user.role,
      name: user.name
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      issuer: 'nexlink-user-service',
      audience: 'nexlink-platform'
    }
  );
};

exports.register = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['email', 'password', 'name']
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ 
        error: 'User already exists',
        code: 'USER_EXISTS'
      });
    }
    
    // Create new user
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      name: name.trim()
    });
    
    // Publish USER_CREATED event to Kafka
    await eventProducer.userCreated(user);
    
    // Generate JWT token
    const token = generateToken(user);
    
    // Return user data (excluding password)
    res.status(201).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Registration failed',
      message: error.message 
    });
  }
};

//Login existing user
//POST /auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required'
      });
    }
    
    // Find user with password field
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid email or password'
      });
    }
    
    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        error: 'Invalid email or password'
      });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ 
        error: 'Account is deactivated',
        code: 'ACCOUNT_INACTIVE'
      });
    }
    
    // Update last login timestamp
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });
    
    // Publish USER_UPDATED event
    await eventProducer.userUpdated(user._id, { lastLogin: user.lastLogin });
    
    // Generate JWT token
    const token = generateToken(user);
    
    res.json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          lastLogin: user.lastLogin
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Login failed',
      message: error.message 
    });
  }
};

//Get user profile
 //GET /users/:id
exports.getProfile = async (req, res) => {
  try {
    const userId = req.params.id || req.user.userId;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found'
      });
    }
    
    // Check authorization (users can only view their own profile unless admin)
    if (req.user.role !== 'admin' && req.user.userId !== userId) {
      return res.status(403).json({ 
        error: 'Access denied',
        code: 'FORBIDDEN'
      });
    }
    
    res.json({
      status: 'success',
      data: { user }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch profile',
      message: error.message 
    });
  }
};

//Update user profile
 //PUT /users/:id
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.params.id || req.user.userId;
    const { name, role } = req.body;
    
    // Check authorization
    if (req.user.role !== 'admin' && req.user.userId !== userId) {
      return res.status(403).json({ 
        error: 'Access denied',
        code: 'FORBIDDEN'
      });
    }
    
    // Role changes require admin
    if (role && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Only admins can change roles',
        code: 'FORBIDDEN_ROLE_CHANGE'
      });
    }
    
    const updateData = { updatedAt: new Date() };
    if (name) updateData.name = name;
    if (role && req.user.role === 'admin') updateData.role = role;
    
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Publish USER_UPDATED event
    await eventProducer.userUpdated(userId, updateData);
    
    res.json({
      status: 'success',
      data: { user }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      error: 'Failed to update profile',
      message: error.message 
    });
  }
};

//Get all users (admin only)
 //GET /users
exports.getAllUsers = async (req, res) => {
  try {
    // Admin only endpoint
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Admin access required',
        code: 'FORBIDDEN'
      });
    }
    
    const { page = 1, limit = 10, role, isActive } = req.query;
    const query = {};
    
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    const users = await User.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    
    const total = await User.countDocuments(query);
    
    res.json({
      status: 'success',
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch users',
      message: error.message 
    });
  }
};