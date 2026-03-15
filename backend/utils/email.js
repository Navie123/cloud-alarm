// Email Utility using Resend (works with Render free tier)
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Shared layout helpers ────────────────────────────────────────────────────

const header = (accentColor = '#e25822') => `
  <div style="background:${accentColor};padding:28px 32px;border-radius:8px 8px 0 0;">
    <p style="margin:0;font-size:20px;font-weight:700;color:#fff;letter-spacing:0.5px;">FireWire</p>
    <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.75);letter-spacing:1px;text-transform:uppercase;">Smart Fire Monitoring</p>
  </div>`;

const footer = () => `
  <div style="padding:20px 32px;background:#f0f0f0;border-radius:0 0 8px 8px;border-top:1px solid #e0e0e0;">
    <p style="margin:0;font-size:11px;color:#999;line-height:1.6;">
      This is an automated message from FireWire. Do not reply to this email.<br>
      If you did not request this, you can safely ignore it.
    </p>
  </div>`;

const wrap = (inner) => `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:580px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e0e0e0;overflow:hidden;">
    ${inner}
  </div>`;

const body = (inner) => `
  <div style="padding:32px;">
    ${inner}
  </div>`;

const row = (label, value, valueColor = '#111') => `
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#666;width:40%;">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:${valueColor};font-weight:600;">${value}</td>
  </tr>`;

const btn = (text, url, color = '#e25822') => `
  <div style="margin-top:28px;">
    <a href="${url}" style="display:inline-block;background:${color};color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">${text}</a>
  </div>`;

// ─── Verification email ───────────────────────────────────────────────────────

const sendVerificationEmail = async (email, token) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify.html?token=${token}`;
  console.log('[Email] Sending verification email to:', email);

  try {
    const { data, error } = await resend.emails.send({
      from: 'FireWire <onboarding@resend.dev>',
      to: email,
      subject: 'Verify your email — FireWire',
      html: wrap(`
        ${header()}
        ${body(`
          <h2 style="margin:0 0 8px;font-size:20px;color:#111;">Verify your email</h2>
          <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">
            Click the button below to verify your email address and complete registration.
          </p>
          ${btn('Verify Email', verifyUrl)}
          <p style="margin-top:20px;font-size:12px;color:#999;">
            This link expires in 24 hours.<br>
            Or copy this URL: <span style="color:#e25822;">${verifyUrl}</span>
          </p>
        `)}
        ${footer()}
      `),
    });
    if (error) throw new Error(error.message);
    console.log('[Email] Verification email sent:', data?.id);
    return data;
  } catch (error) {
    console.error('[Email] Failed to send verification email:', error.message);
    throw error;
  }
};

// ─── Password reset ───────────────────────────────────────────────────────────

const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;
  console.log('[Email] Sending password reset email to:', email);

  try {
    const { data, error } = await resend.emails.send({
      from: 'FireWire <onboarding@resend.dev>',
      to: email,
      subject: 'Reset your password — FireWire',
      html: wrap(`
        ${header()}
        ${body(`
          <h2 style="margin:0 0 8px;font-size:20px;color:#111;">Reset your password</h2>
          <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">
            We received a request to reset your password. Click below to set a new one.
          </p>
          ${btn('Reset Password', resetUrl)}
          <p style="margin-top:20px;font-size:12px;color:#999;">
            This link expires in 1 hour. If you didn't request this, no action is needed.
          </p>
        `)}
        ${footer()}
      `),
    });
    if (error) throw new Error(error.message);
    console.log('[Email] Password reset email sent:', data?.id);
    return data;
  } catch (error) {
    console.error('[Email] Failed to send password reset email:', error.message);
    throw error;
  }
};

// ─── OTP verification ─────────────────────────────────────────────────────────

const sendOTPEmail = async (email, code, purpose) => {
  const purposeText = {
    setup: 'complete your setup',
    login: 'log in as Admin',
    reset: 'reset your Admin PIN',
    member: 'verify your email for alarm alerts',
  };

  console.log('[Email] Sending OTP to:', email, 'Purpose:', purpose);

  const htmlContent = wrap(`
    ${header()}
    ${body(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111;">Verification code</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">
        Use the code below to ${purposeText[purpose] || 'verify your identity'}.
      </p>
      <div style="background:#f7f7f7;border:1px solid #e0e0e0;border-radius:6px;padding:20px 32px;display:inline-block;margin-bottom:24px;">
        <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#111;font-family:'Courier New',monospace;">${code}</span>
      </div>
      <p style="margin:0;font-size:12px;color:#999;">This code expires in 10 minutes.</p>
    `)}
    ${footer()}
  `);

  try {
    const { data, error } = await resend.emails.send({
      from: 'FireWire <onboarding@resend.dev>',
      to: email,
      subject: 'Your verification code — FireWire',
      html: htmlContent,
    });

    if (!error) {
      console.log('[Email] OTP sent via Resend to:', email);
      return data;
    }
    console.log('[Email] Resend failed, trying Gmail SMTP...', error.message);
  } catch (resendError) {
    console.log('[Email] Resend failed, trying Gmail SMTP...', resendError.message);
  }

  // Fallback: Gmail SMTP
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  const info = await transporter.sendMail({
    from: `"FireWire" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your verification code — FireWire',
    html: htmlContent,
  });

  console.log('[Email] OTP sent via Gmail SMTP to:', email, info.messageId);
  return { id: info.messageId, provider: 'gmail' };
};

// ─── Alarm alert ──────────────────────────────────────────────────────────────

const sendAlarmEmail = async (email, alarmData) => {
  const { deviceId, trigger, gas, smoke, temperature, humidity, timestamp, baselineTemp, tempRise, isWarningOnly } = alarmData;
  const dashboardUrl = process.env.FRONTEND_URL || 'https://cloud-alarm.onrender.com';

  const isWarning = isWarningOnly || trigger.includes('_warning');
  const accentColor = isWarning ? '#b45309' : '#c0392b';

  const triggerLabel = {
    gas: 'High gas level',
    smoke: 'High smoke level',
    temperature: 'High temperature',
    both: 'Gas/smoke and high temperature',
    smoke_warning: 'Smoke detected — no temperature rise',
    gas_warning: 'Gas detected — no temperature rise',
    smoke_gas_warning: 'Smoke and gas detected — no temperature rise',
  }[trigger] || 'Sensor threshold exceeded';

  const subject = isWarning
    ? `[Warning] Sensor alert — ${triggerLabel}`
    : `[Alarm] Fire alarm triggered — ${triggerLabel}`;

  console.log(`[Email] Sending ${isWarning ? 'WARNING' : 'ALARM'} alert to:`, email);

  const statusColor = (val, threshold) => val > threshold ? accentColor : '#333';

  const html = wrap(`
    ${header(accentColor)}
    ${body(`
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${accentColor};">
        ${isWarning ? 'Sensor Warning' : 'Fire Alarm'}
      </p>
      <h2 style="margin:0 0 16px;font-size:22px;color:#111;">${triggerLabel}</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">
        ${isWarning
          ? `Your FireWire device detected ${trigger.includes('smoke_gas') ? 'smoke and gas' : trigger.includes('smoke') ? 'smoke' : 'gas'} but temperature remained stable (${temperature?.toFixed(1)}°C, rise: ${tempRise?.toFixed(1)}°C). This may be steam, cooking smoke, or a minor gas leak. Please check the area.`
          : 'Your FireWire device has detected a potential fire hazard. Check your home immediately and evacuate if necessary.'
        }
      </p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${row('Device', deviceId)}
        ${row('Gas level', `${gas?.toFixed(1) || 0}%`, statusColor(gas, 40))}
        ${row('Smoke level', `${smoke?.toFixed(1) || 0}%`, statusColor(smoke, 10))}
        ${row('Temperature', `${temperature?.toFixed(1) || 0} °C`, statusColor(temperature, 35))}
        ${isWarning && baselineTemp ? row('Baseline temp', `${baselineTemp?.toFixed(1)} °C`) : ''}
        ${isWarning && tempRise !== undefined ? row('Temp rise', `${tempRise?.toFixed(1)} °C`) : ''}
        ${row('Humidity', `${humidity?.toFixed(1) || 0}%`)}
        ${row('Time', timestamp)}
      </table>

      ${btn('Open Dashboard', dashboardUrl, accentColor)}
    `)}
    ${footer()}
  `);

  try {
    const { data, error } = await resend.emails.send({
      from: 'FireWire Alert <onboarding@resend.dev>',
      to: email,
      subject,
      html,
    });
    if (error) throw new Error(error.message);
    console.log(`[Email] ${isWarning ? 'WARNING' : 'ALARM'} alert sent:`, data?.id);
    return data;
  } catch (error) {
    console.error('[Email] Failed to send alarm alert:', error.message);
    throw error;
  }
};

// ─── Setup completion ─────────────────────────────────────────────────────────

const sendSetupCompletionEmail = async (email, setupData) => {
  const { householdId, accessCode, deviceSecret, householdName } = setupData;
  const dashboardUrl = process.env.FRONTEND_URL || 'https://cloud-alarm.onrender.com';

  console.log('[Email] Sending setup completion email to:', email);

  const html = wrap(`
    ${header()}
    ${body(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111;">Your system is ready</h2>
      <p style="margin:0 0 28px;font-size:14px;color:#555;line-height:1.6;">
        FireWire has been set up for <strong>${householdName}</strong>. Keep the credentials below in a safe place — you'll need them to log in.
      </p>

      <div style="background:#f7f7f7;border:1px solid #e0e0e0;border-radius:6px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#999;">Login Credentials</p>
        <table style="width:100%;border-collapse:collapse;">
          ${row('Household name', householdName)}
          ${row('Household passkey', householdId, '#e25822')}
          ${row('Access code', accessCode, '#e25822')}
          ${deviceSecret ? row('Device secret', deviceSecret, '#e25822') : ''}
        </table>
      </div>

      <div style="background:#fff8f0;border-left:3px solid #e25822;padding:12px 16px;border-radius:0 4px 4px 0;margin-bottom:28px;">
        <p style="margin:0;font-size:13px;color:#7c3a00;line-height:1.5;">
          Share the <strong>Access Code</strong> with family members so they can monitor the dashboard. Keep the <strong>Passkey</strong> private — it's your admin credential.
        </p>
      </div>

      ${btn('Open Dashboard', dashboardUrl)}
    `)}
    ${footer()}
  `);

  try {
    const { data, error } = await resend.emails.send({
      from: 'FireWire Setup <onboarding@resend.dev>',
      to: email,
      subject: 'FireWire setup complete — your credentials',
      html,
    });

    if (!error) {
      console.log('[Email] Setup completion email sent via Resend:', data?.id);
      return data;
    }
    console.log('[Email] Resend failed, trying Gmail SMTP...', error.message);
  } catch (resendError) {
    console.log('[Email] Resend failed, trying Gmail SMTP...', resendError.message);
  }

  // Fallback: Gmail SMTP
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  const info = await transporter.sendMail({
    from: `"FireWire" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'FireWire setup complete — your credentials',
    html,
  });

  console.log('[Email] Setup completion email sent via Gmail SMTP:', info.messageId);
  return { id: info.messageId, provider: 'gmail' };
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendOTPEmail, sendAlarmEmail, sendSetupCompletionEmail };
