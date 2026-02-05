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
    // Try Resend first, fallback to Gmail SMTP if it fails
    let emailSent = false;
    let lastError = null;

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
        console.log('[Email] Resend failed, trying Gmail SMTP...', error.message);
        lastError = error;
      } else {
        console.log('[Email] OTP sent successfully via Resend to:', email);
        return data;
      }
    } catch (resendError) {
      console.log('[Email] Resend failed, trying Gmail SMTP...', resendError.message);
      lastError = resendError;
    }

    // Fallback to Gmail SMTP
    if (!emailSent) {
      const nodemailer = require('nodemailer');
      
      const transporter = nodemailer.createTransporter({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      const mailOptions = {
        from: `"Cloud Fire Alarm" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Your Verification Code - Cloud Fire Alarm',
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
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('[Email] OTP sent successfully via Gmail SMTP to:', email, 'MessageId:', info.messageId);
      return { id: info.messageId, provider: 'gmail' };
    }

  } catch (error) {
    console.error('[Email] All email methods failed:', error.message);
    console.error('[Email] Last Resend error:', lastError?.message);
    throw error;
  }
};

// Send alarm alert email
const sendAlarmEmail = async (email, alarmData) => {
  const { deviceId, trigger, gas, smoke, temperature, humidity, timestamp, baselineTemp, tempRise, isWarningOnly } = alarmData;
  const dashboardUrl = process.env.FRONTEND_URL || 'https://cloud-alarm.onrender.com';
  
  const triggerMessages = {
    gas: '🔥 High gas levels detected!',
    smoke: '💨 High smoke levels detected!',
    temperature: '🌡️ Dangerous temperature detected!',
    both: '🚨 Gas/Smoke AND high temperature detected!',
    smoke_warning: '⚠️ Smoke detected without temperature rise',
    gas_warning: '⚠️ Gas detected without temperature rise',
    smoke_gas_warning: '⚠️ Smoke & Gas detected without temperature rise'
  };

  // Different styling for warnings vs alarms
  const isWarning = isWarningOnly || trigger.includes('_warning');
  const bgColor = isWarning ? '#ff9800' : '#d32f2f';
  const bgGradient = isWarning ? 'linear-gradient(135deg, #ff9800, #ffb74d)' : 'linear-gradient(135deg, #d32f2f, #ff5722)';
  const subject = isWarning ? '⚠️ PARTIAL WARNING - Check Your Home' : '🚨 FIRE ALARM TRIGGERED - Immediate Action Required!';
  const title = isWarning ? '⚠️ PARTIAL WARNING' : '🚨 FIRE ALARM!';
  const actionText = isWarning ? 'Check Your Home' : 'Immediate Action Required';

  console.log(`[Email] Sending ${isWarning ? 'SMOKE WARNING' : 'ALARM'} alert to:`, email);

  try {
    const { data, error } = await resend.emails.send({
      from: 'FireWire Alert <onboarding@resend.dev>',
      to: email,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${bgGradient}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">${title}</h1>
            <p style="color: ${isWarning ? '#fff3e0' : '#ffcdd2'}; margin: 10px 0 0 0; font-size: 16px;">${triggerMessages[trigger] || 'Alarm triggered!'}</p>
          </div>
          <div style="padding: 30px; background: ${isWarning ? '#fff8e1' : '#fff3e0'}; border-left: 4px solid ${bgColor};">
            <h2 style="color: ${bgColor}; margin-top: 0;">${isWarning ? '⚠️' : '⚠️'} ${actionText}</h2>
            <p style="color: #333; font-size: 16px;">
              ${isWarning 
                ? `Your FireWire device detected ${trigger.includes('smoke_gas') ? 'smoke and gas' : trigger.includes('smoke') ? 'smoke' : 'gas'} but no temperature rise. This could be steam, cooking smoke, dust, or minor gas leak. Please check your home to ensure safety.`
                : 'Your FireWire device has detected a potential fire hazard. Please check your home immediately!'
              }
            </p>
            ${isWarning ? `
              <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p style="color: #1976d2; margin: 0; font-size: 14px;">
                  <strong>Smart Detection:</strong> Only intermittent beeping was triggered because temperature remained stable (${temperature?.toFixed(1)}°C vs baseline ${baselineTemp?.toFixed(1)}°C, rise: ${tempRise?.toFixed(1)}°C).
                </p>
              </div>
            ` : ''}
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
                <td style="padding: 10px; border-bottom: 1px solid #ddd; color: ${smoke > 10 ? (isWarning ? '#ff9800' : '#d32f2f') : '#333'};">${smoke?.toFixed(1) || 0}% ${smoke > 10 ? (isWarning ? '⚠️ DETECTED' : '⚠️ HIGH') : ''}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Temperature:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; color: ${temperature > 35 ? '#d32f2f' : '#333'};">${temperature?.toFixed(1) || 0}°C ${temperature > 35 ? '⚠️ HIGH' : ''}</td>
              </tr>
              ${isWarning && baselineTemp ? `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Baseline Temp:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${baselineTemp?.toFixed(1)}°C</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Temp Rise:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${tempRise?.toFixed(1)}°C</td>
              </tr>
              ` : ''}
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
            <a href="${dashboardUrl}" style="background: ${bgColor}; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 18px;">
              View Dashboard
            </a>
          </div>
          <div style="padding: 20px; background: #333; border-radius: 0 0 10px 10px;">
            <p style="color: #999; font-size: 12px; margin: 0; text-align: center;">
              This is an automated alert from your FireWire Smart Fire Alarm System.<br>
              ${isWarning ? 'This is a warning notification - no buzzer alarm was triggered.' : 'If this is a false alarm, you can silence it from the dashboard.'}
            </p>
          </div>
        </div>
      `
    });

    if (error) {
      console.error('[Email] Resend error:', error);
      throw new Error(error.message);
    }

    console.log(`[Email] ${isWarning ? 'SMOKE WARNING' : 'ALARM'} alert sent successfully to:`, email, 'ID:', data?.id);
    return data;
  } catch (error) {
    console.error('[Email] Failed to send alarm alert:', error.message);
    throw error;
  }
};

// Send setup completion email with credentials
const sendSetupCompletionEmail = async (email, setupData) => {
  const { householdId, accessCode, deviceSecret, householdName } = setupData;
  const dashboardUrl = process.env.FRONTEND_URL || 'https://cloud-alarm.onrender.com';
  
  console.log('[Email] Sending setup completion email to:', email);

  try {
    // Try Resend first, fallback to Gmail SMTP if it fails
    let emailSent = false;
    let lastError = null;

    try {
      const { data, error } = await resend.emails.send({
        from: 'FireWire Setup <onboarding@resend.dev>',
        to: email,
        subject: '🎉 Welcome to FireWire - Your Setup is Complete!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #ff5722, #ff9800); padding: 40px; text-align: center; border-radius: 15px 15px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 2rem;">🔥 FireWire</h1>
              <p style="color: #fff3e0; margin: 10px 0 0 0; font-size: 1.1rem;">Smart Fire Monitoring System</p>
            </div>
            <div style="padding: 40px; background: #f8f9fa; border-radius: 0 0 15px 15px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #ff5722; margin: 0 0 10px 0;">🎉 Setup Complete!</h2>
                <p style="color: #666; margin: 0; font-size: 1.1rem;">Your FireWire system is ready to protect your home</p>
              </div>
              
              <div style="background: white; border-radius: 12px; padding: 25px; margin-bottom: 25px; border: 2px solid #ff5722;">
                <h3 style="color: #ff5722; margin: 0 0 20px 0; display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 1.2em;">🔑</span> Your Login Credentials
                </h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: 600; color: #333;">Household Name:</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-family: 'Courier New', monospace; color: #ff5722; font-weight: 600;">${householdName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: 600; color: #333;">Household ID:</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-family: 'Courier New', monospace; color: #ff5722; font-weight: 600;">${householdId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: 600; color: #333;">Access Code:</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-family: 'Courier New', monospace; color: #ff5722; font-weight: 600;">${accessCode}</td>
                  </tr>
                  ${deviceSecret ? `
                  <tr>
                    <td style="padding: 12px 0; font-weight: 600; color: #333;">Device Secret:</td>
                    <td style="padding: 12px 0; font-family: 'Courier New', monospace; color: #ff5722; font-weight: 600;">${deviceSecret}</td>
                  </tr>
                  ` : ''}
                </table>
              </div>
              
              <div style="background: #e8f5e8; border: 1px solid #4caf50; border-radius: 10px; padding: 20px; margin-bottom: 25px;">
                <h4 style="color: #2e7d32; margin: 0 0 10px 0; display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 1.1em;">💡</span> What's Next?
                </h4>
                <ul style="color: #2e7d32; margin: 0; padding-left: 20px; line-height: 1.6;">
                  <li>Use your <strong>Household ID</strong> and <strong>Access Code</strong> to log in</li>
                  <li>Share the Access Code with family members for monitoring access</li>
                  <li>Configure your ESP32 device with the Device Secret (if provided)</li>
                  <li>Set up email alerts and push notifications</li>
                </ul>
              </div>
              
              <div style="background: #fff3e0; border: 1px solid #ff9800; border-radius: 10px; padding: 20px; margin-bottom: 30px;">
                <p style="color: #e65100; margin: 0; display: flex; align-items: center; gap: 8px; font-weight: 600;">
                  <span style="font-size: 1.1em;">⚠️</span> 
                  <strong>Important:</strong> Save these credentials in a safe place!
                </p>
              </div>
              
              <div style="text-align: center;">
                <a href="${dashboardUrl}" style="background: #ff5722; color: white; padding: 15px 40px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block; font-size: 1.1rem;">
                  🚀 Access Your FireWire Dashboard
                </a>
              </div>
            </div>
            <div style="padding: 20px; background: #333; border-radius: 0 0 15px 15px; text-align: center;">
              <p style="color: #999; font-size: 0.9rem; margin: 0;">
                Welcome to FireWire - Your Smart Fire Protection Partner<br>
                Keep this email for your records. You'll need these credentials to access your dashboard.
              </p>
            </div>
          </div>
        `
      });

      if (error) {
        console.log('[Email] Resend failed, trying Gmail SMTP...', error.message);
        lastError = error;
      } else {
        console.log('[Email] Setup completion email sent successfully via Resend to:', email);
        return data;
      }
    } catch (resendError) {
      console.log('[Email] Resend failed, trying Gmail SMTP...', resendError.message);
      lastError = resendError;
    }

    // Fallback to Gmail SMTP
    if (!emailSent) {
      const nodemailer = require('nodemailer');
      
      const transporter = nodemailer.createTransporter({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      const mailOptions = {
        from: `"FireWire Setup" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🎉 Welcome to FireWire - Your Setup is Complete!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #ff5722, #ff9800); padding: 40px; text-align: center; border-radius: 15px 15px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 2rem;">🔥 FireWire</h1>
              <p style="color: #fff3e0; margin: 10px 0 0 0; font-size: 1.1rem;">Smart Fire Monitoring System</p>
            </div>
            <div style="padding: 40px; background: #f8f9fa; border-radius: 0 0 15px 15px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #ff5722; margin: 0 0 10px 0;">🎉 Setup Complete!</h2>
                <p style="color: #666; margin: 0; font-size: 1.1rem;">Your FireWire system is ready to protect your home</p>
              </div>
              
              <div style="background: white; border-radius: 12px; padding: 25px; margin-bottom: 25px; border: 2px solid #ff5722;">
                <h3 style="color: #ff5722; margin: 0 0 20px 0; display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 1.2em;">🔑</span> Your Login Credentials
                </h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: 600; color: #333;">Household Name:</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-family: 'Courier New', monospace; color: #ff5722; font-weight: 600;">${householdName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: 600; color: #333;">Household ID:</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-family: 'Courier New', monospace; color: #ff5722; font-weight: 600;">${householdId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: 600; color: #333;">Access Code:</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-family: 'Courier New', monospace; color: #ff5722; font-weight: 600;">${accessCode}</td>
                  </tr>
                  ${deviceSecret ? `
                  <tr>
                    <td style="padding: 12px 0; font-weight: 600; color: #333;">Device Secret:</td>
                    <td style="padding: 12px 0; font-family: 'Courier New', monospace; color: #ff5722; font-weight: 600;">${deviceSecret}</td>
                  </tr>
                  ` : ''}
                </table>
              </div>
              
              <div style="background: #e8f5e8; border: 1px solid #4caf50; border-radius: 10px; padding: 20px; margin-bottom: 25px;">
                <h4 style="color: #2e7d32; margin: 0 0 10px 0; display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 1.1em;">💡</span> What's Next?
                </h4>
                <ul style="color: #2e7d32; margin: 0; padding-left: 20px; line-height: 1.6;">
                  <li>Use your <strong>Household ID</strong> and <strong>Access Code</strong> to log in</li>
                  <li>Share the Access Code with family members for monitoring access</li>
                  <li>Configure your ESP32 device with the Device Secret (if provided)</li>
                  <li>Set up email alerts and push notifications</li>
                </ul>
              </div>
              
              <div style="background: #fff3e0; border: 1px solid #ff9800; border-radius: 10px; padding: 20px; margin-bottom: 30px;">
                <p style="color: #e65100; margin: 0; display: flex; align-items: center; gap: 8px; font-weight: 600;">
                  <span style="font-size: 1.1em;">⚠️</span> 
                  <strong>Important:</strong> Save these credentials in a safe place!
                </p>
              </div>
              
              <div style="text-align: center;">
                <a href="${dashboardUrl}" style="background: #ff5722; color: white; padding: 15px 40px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block; font-size: 1.1rem;">
                  🚀 Access Your FireWire Dashboard
                </a>
              </div>
            </div>
            <div style="padding: 20px; background: #333; border-radius: 0 0 15px 15px; text-align: center;">
              <p style="color: #999; font-size: 0.9rem; margin: 0;">
                Welcome to FireWire - Your Smart Fire Protection Partner<br>
                Keep this email for your records. You'll need these credentials to access your dashboard.
              </p>
            </div>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('[Email] Setup completion email sent successfully via Gmail SMTP to:', email, 'MessageId:', info.messageId);
      return { id: info.messageId, provider: 'gmail' };
    }

  } catch (error) {
    console.error('[Email] All email methods failed for setup completion:', error.message);
    console.error('[Email] Last Resend error:', lastError?.message);
    throw error;
  }
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendOTPEmail, sendAlarmEmail, sendSetupCompletionEmail };
