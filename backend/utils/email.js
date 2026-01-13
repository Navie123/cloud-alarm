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
    setup: 'complete your setup',
    login: 'log in as Admin',
    reset: 'reset your Admin PIN',
    member: 'verify your email for alarm alerts'
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

// Send alarm alert email
const sendAlarmEmail = async (email, alarmData) => {
  const { deviceId, trigger, gas, smoke, temperature, humidity, timestamp } = alarmData;
  const dashboardUrl = process.env.FRONTEND_URL || 'https://cloud-alarm.onrender.com';
  
  const triggerMessages = {
    gas: '🔥 High gas levels detected!',
    smoke: '💨 High smoke levels detected!',
    temperature: '🌡️ Dangerous temperature detected!',
    both: '🚨 Gas/Smoke AND high temperature detected!'
  };

  console.log('[Email] Sending ALARM alert to:', email);

  try {
    const { data, error } = await resend.emails.send({
      from: 'FireWire Alert <onboarding@resend.dev>',
      to: email,
      subject: '🚨 FIRE ALARM TRIGGERED - Immediate Action Required!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #d32f2f, #ff5722); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🚨 FIRE ALARM!</h1>
            <p style="color: #ffcdd2; margin: 10px 0 0 0; font-size: 16px;">${triggerMessages[trigger] || 'Alarm triggered!'}</p>
          </div>
          <div style="padding: 30px; background: #fff3e0; border-left: 4px solid #ff5722;">
            <h2 style="color: #d32f2f; margin-top: 0;">⚠️ Immediate Action Required</h2>
            <p style="color: #333; font-size: 16px;">Your FireWire device has detected a potential fire hazard. Please check your home immediately!</p>
          </div>
          <div style="padding: 30px; background: #f5f5f5;">
            <h3 style="color: #333; margin-top: 0;">Sensor Readings:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Device:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${deviceId}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Gas Level:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; color: ${gas > 40 ? '#d32f2f' : '#333'};">${gas?.toFixed(1) || 0}% ${gas > 40 ? '⚠️ HIGH' : ''}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Smoke Level:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; color: ${smoke > 40 ? '#d32f2f' : '#333'};">${smoke?.toFixed(1) || 0}% ${smoke > 40 ? '⚠️ HIGH' : ''}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Temperature:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; color: ${temperature > 60 ? '#d32f2f' : '#333'};">${temperature?.toFixed(1) || 0}°C ${temperature > 60 ? '⚠️ HIGH' : ''}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Humidity:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${humidity?.toFixed(1) || 0}%</td>
              </tr>
              <tr>
                <td style="padding: 10px;"><strong>Time:</strong></td>
                <td style="padding: 10px;">${timestamp}</td>
              </tr>
            </table>
          </div>
          <div style="padding: 30px; background: #f5f5f5; text-align: center;">
            <a href="${dashboardUrl}" style="background: #d32f2f; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 18px;">
              View Dashboard
            </a>
          </div>
          <div style="padding: 20px; background: #333; border-radius: 0 0 10px 10px;">
            <p style="color: #999; font-size: 12px; margin: 0; text-align: center;">
              This is an automated alert from your FireWire Smart Fire Alarm System.<br>
              If this is a false alarm, you can silence it from the dashboard.
            </p>
          </div>
        </div>
      `
    });

    if (error) {
      console.error('[Email] Resend error:', error);
      throw new Error(error.message);
    }

    console.log('[Email] ALARM alert sent successfully to:', email, 'ID:', data?.id);
    return data;
  } catch (error) {
    console.error('[Email] Failed to send alarm alert:', error.message);
    throw error;
  }
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendOTPEmail, sendAlarmEmail };
