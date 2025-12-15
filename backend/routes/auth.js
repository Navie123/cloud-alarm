const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { auth, generateToken } = require('../middleware/auth');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');
const { sendSMS } = require('../utils/sms');

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Register with email/password
router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    // Validation
    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter' });
    }
    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one number' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // If user exists but not verified, tell them to verify or resend
      if (!existingUser.emailVerified) {
        return res.status(400).json({ 
          error: 'Email already registered but not verified. Please check your email or request a new verification link.',
          needsVerification: true,
          email: existingUser.email
        });
      }
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user with verification token
    const user = new User({
      email,
      password,
      displayName,
      provider: 'local',
      emailVerified: false,
      verificationToken,
      verificationExpires
    });
    await user.save();

    // Send verification email (required)
    try {
      await sendVerificationEmail(email, verificationToken);
      res.status(201).json({ 
        message: 'Registration successful! Please check your email to verify your account. You must verify your email before you can log in.',
        needsVerification: true,
        email: user.email
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Delete user if email fails - they must try again
      await User.deleteOne({ _id: user._id });
      res.status(500).json({ 
        error: 'Failed to send verification email. Please try registering again.',
        details: 'Email service is temporarily unavailable'
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Verify email
router.get('/verify/:token', async (req, res) => {
  try {
    const user = await User.findOne({
      verificationToken: req.params.token,
      verificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    user.emailVerified = true;
    user.verificationToken = undefined;
    user.verificationExpires = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully. You can now sign in.' });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Generate new token
    user.verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    await sendVerificationEmail(email, user.verificationToken);
    res.json({ message: 'Verification email sent' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

// Login with email/password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.provider === 'google') {
      return res.status(401).json({ error: 'Please sign in with Google' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({ 
        error: 'Please verify your email first',
        needsVerification: true,
        email: user.email
      });
    }

    const token = generateToken(user._id);
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Google OAuth login
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, email_verified } = payload;

    // Find or create user
    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (user) {
      // Check if user exists but hasn't verified email (local account)
      if (!user.emailVerified && user.provider === 'local') {
        return res.status(403).json({ 
          error: 'Please verify your email first before using Google sign-in',
          needsVerification: true,
          email: user.email
        });
      }
      
      // Update Google ID if user registered with email first
      if (!user.googleId) {
        user.googleId = googleId;
        user.provider = 'google';
        user.emailVerified = true;
        await user.save();
      }
    } else {
      // Create new user with Google - auto-verified since Google verified the email
      user = new User({
        email,
        displayName: name,
        googleId,
        provider: 'google',
        emailVerified: true
      });
      await user.save();
    }

    const token = generateToken(user._id);
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified
      }
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({ error: 'Google authentication failed' });
  }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if user exists
      return res.json({ message: 'If an account exists, a reset email has been sent' });
    }

    if (user.provider === 'google') {
      return res.status(400).json({ error: 'This account uses Google sign-in' });
    }

    // Generate reset token
    user.resetPasswordToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    await sendPasswordResetEmail(email, user.resetPasswordToken);
    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      email: req.user.email,
      displayName: req.user.displayName,
      emailVerified: req.user.emailVerified,
      phoneNumber: req.user.phoneNumber || '',
      smsEnabled: req.user.smsEnabled || false
    }
  });
});

// Update phone number and SMS settings
router.put('/phone', auth, async (req, res) => {
  try {
    const { phoneNumber, smsEnabled } = req.body;
    
    // Validate Philippine phone number format
    if (phoneNumber) {
      const cleaned = phoneNumber.replace(/\s|-/g, '');
      if (!/^(\+?63|0)?9\d{9}$/.test(cleaned)) {
        return res.status(400).json({ error: 'Invalid Philippine phone number. Use format: 09xxxxxxxxx' });
      }
    }

    req.user.phoneNumber = phoneNumber || '';
    req.user.smsEnabled = smsEnabled === true;
    await req.user.save();

    res.json({ 
      message: 'Phone settings updated',
      phoneNumber: req.user.phoneNumber,
      smsEnabled: req.user.smsEnabled
    });
  } catch (error) {
    console.error('Phone update error:', error);
    res.status(500).json({ error: 'Failed to update phone settings' });
  }
});

// Test SMS endpoint
router.post('/test-sms', auth, async (req, res) => {
  try {
    const phoneNumber = req.user.phoneNumber;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'No phone number saved. Please save your phone number first.' });
    }
    
    const result = await sendSMS(phoneNumber, '🔥 Test SMS from Fire Alarm System. If you received this, SMS is working!');
    
    if (result.success) {
      res.json({ message: 'Test SMS sent!', data: result.data });
    } else {
      res.status(500).json({ error: 'SMS failed: ' + (result.error?.message || JSON.stringify(result.error)) });
    }
  } catch (error) {
    console.error('Test SMS error:', error);
    res.status(500).json({ error: 'Failed to send test SMS' });
  }
});

module.exports = router;
