const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendVerificationEmail = async (email, token) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify.html?token=${token}`;
  
  await transporter.sendMail({
    from: `"Cloud Fire Alarm" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify Your Email - Cloud Fire Alarm',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ff5722, #ff9800); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">🔥 Cloud Fire Alarm</h1>
        </div>
        <div style="padding: 30px; background: #f5f5f5;">
          <h2 style="color: #333;">Verify Your Email</h2>
          <p style="color: #666;">Thanks for registering! Please click the button below to verify your email address.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="background: #ff5722; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Verify Email
            </a>
          </div>
          <p style="color: #999; font-size: 12px;">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>
        </div>
      </div>
    `
  });
};

const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;
  
  await transporter.sendMail({
    from: `"Cloud Fire Alarm" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Reset Your Password - Cloud Fire Alarm',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ff5722, #ff9800); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">🔥 Cloud Fire Alarm</h1>
        </div>
        <div style="padding: 30px; background: #f5f5f5;">
          <h2 style="color: #333;">Reset Your Password</h2>
          <p style="color: #666;">You requested a password reset. Click the button below to set a new password.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: #ff5722; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p style="color: #999; font-size: 12px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        </div>
      </div>
    `
  });
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
