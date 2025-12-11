const nodemailer = require('nodemailer');

// Create transporter with better error handling
let transporter;
try {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  console.log('[Email] Transporter configured with:', process.env.EMAIL_USER);
} catch (err) {
  console.error('[Email] Failed to create transporter:', err);
}

const sendVerificationEmail = async (email, token) => {
  if (!transporter) {
    throw new Error('Email transporter not configured');
  }
  
  const verifyUrl = `${process.env.FRONTEND_URL}/verify.html?token=${token}`;
  
  console.log('[Email] Sending verification email to:', email);
  console.log('[Email] Verify URL:', verifyUrl);
  
  try {
    const result = await transporter.sendMail({
      from: `"Cloud Fire Alarm" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email - Cloud Fire Alarm',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #ff5722, #ff9800); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">🔥 Cloud Fire Alarm</h1>
          </div>
          <div style="padding: 30px; background: #f5f5f5; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333;">Verify Your Email</h2>
            <p style="color: #666;">Thanks for registering! Please click the button below to verify your email address.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifyUrl}" style="background: #ff5722; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Verify Email
              </a>
            </div>
            <p style="color: #999; font-size: 12px;">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>
            <p style="color: #999; font-size: 12px;">Or copy this link: ${verifyUrl}</p>
          </div>
        </div>
      `
    });
    console.log('[Email] Verification email sent successfully to:', email);
    return result;
  } catch (error) {
    console.error('[Email] Failed to send verification email:', error.message);
    throw error;
  }
};

const sendPasswordResetEmail = async (email, token) => {
  if (!transporter) {
    throw new Error('Email transporter not configured');
  }
  
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;
  
  console.log('[Email] Sending password reset email to:', email);
  console.log('[Email] Reset URL:', resetUrl);
  
  try {
    const result = await transporter.sendMail({
      from: `"Cloud Fire Alarm" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Reset Your Password - Cloud Fire Alarm',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #ff5722, #ff9800); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">🔥 Cloud Fire Alarm</h1>
          </div>
          <div style="padding: 30px; background: #f5f5f5; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333;">Reset Your Password</h2>
            <p style="color: #666;">You requested a password reset. Click the button below to set a new password.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: #ff5722; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #999; font-size: 12px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
            <p style="color: #999; font-size: 12px;">Or copy this link: ${resetUrl}</p>
          </div>
        </div>
      `
    });
    console.log('[Email] Password reset email sent successfully to:', email);
    return result;
  } catch (error) {
    console.error('[Email] Failed to send password reset email:', error.message);
    throw error;
  }
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
