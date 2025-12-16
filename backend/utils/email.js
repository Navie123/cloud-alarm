// Email Utility using Resend (works with Render free tier)
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendVerificationEmail = async (email, token) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify.html?token=${token}`;
  
  console.log('[Email] Sending verification email to:', email);
  console.log('[Email] Verify URL:', verifyUrl);
  
  try {
    const { data, error } = await resend.emails.send({
      from: 'Cloud Fire Alarm <onboarding@resend.dev>',
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

    if (error) {
      console.error('[Email] Resend error:', error);
      throw new Error(error.message);
    }

    console.log('[Email] Verification email sent successfully to:', email, 'ID:', data?.id);
    return data;
  } catch (error) {
    console.error('[Email] Failed to send verification email:', error.message);
    throw error;
  }
};

const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;
  
  console.log('[Email] Sending password reset email to:', email);
  console.log('[Email] Reset URL:', resetUrl);
  
  try {
    const { data, error } = await resend.emails.send({
      from: 'Cloud Fire Alarm <onboarding@resend.dev>',
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

    if (error) {
      console.error('[Email] Resend error:', error);
      throw new Error(error.message);
    }

    console.log('[Email] Password reset email sent successfully to:', email, 'ID:', data?.id);
    return data;
  } catch (error) {
    console.error('[Email] Failed to send password reset email:', error.message);
    throw error;
  }
};

// Send OTP email for admin verification
const sendOTPEmail = async (email, code, purpose) => {
  const purposeText = {
    setup: 'complete your Admin setup',
    login: 'log in as Admin',
    reset: 'reset your Admin PIN'
  };

  console.log('[Email] Sending OTP to:', email, 'Purpose:', purpose);

  try {
    const { data, error } = await resend.emails.send({
      from: 'Cloud Fire Alarm <onboarding@resend.dev>',
      to: email,
      subject: `Your Verification Code - Cloud Fire Alarm`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #ff5722, #ff9800); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">🔥 Cloud Fire Alarm</h1>
          </div>
          <div style="padding: 30px; background: #f5f5f5; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333;">Verification Code</h2>
            <p style="color: #666;">Use this code to ${purposeText[purpose] || 'verify your identity'}:</p>
            <div style="text-align: center; margin: 30px 0;">
              <div style="background: #333; color: #ff5722; padding: 20px 40px; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 8px; display: inline-block;">
                ${code}
              </div>
            </div>
            <p style="color: #999; font-size: 12px;">This code expires in 10 minutes.</p>
            <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
          </div>
        </div>
      `
    });

    if (error) {
      console.error('[Email] Resend error:', error);
      throw new Error(error.message);
    }

    console.log('[Email] OTP sent successfully to:', email);
    return data;
  } catch (error) {
    console.error('[Email] Failed to send OTP:', error.message);
    throw error;
  }
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendOTPEmail };
