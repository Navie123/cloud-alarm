// SMS Utility using Semaphore (Philippines)
const axios = require('axios');

const SEMAPHORE_API_KEY = process.env.SEMAPHORE_API_KEY;
const SENDER_NAME = process.env.SEMAPHORE_SENDER_NAME || 'FIREALARM';

/**
 * Send SMS via Semaphore
 * @param {string} phoneNumber - Philippine mobile number (09xxxxxxxxx or +639xxxxxxxxx)
 * @param {string} message - SMS message (max 160 chars for 1 SMS credit)
 */
async function sendSMS(phoneNumber, message) {
  if (!SEMAPHORE_API_KEY) {
    console.log('[SMS] Semaphore API key not configured');
    return { success: false, error: 'SMS not configured' };
  }

  if (!phoneNumber) {
    console.log('[SMS] No phone number provided');
    return { success: false, error: 'No phone number' };
  }

  // Format Philippine number
  let formattedNumber = phoneNumber.replace(/\s|-/g, '');
  if (formattedNumber.startsWith('0')) {
    formattedNumber = '63' + formattedNumber.substring(1);
  } else if (formattedNumber.startsWith('+63')) {
    formattedNumber = formattedNumber.substring(1);
  } else if (!formattedNumber.startsWith('63')) {
    formattedNumber = '63' + formattedNumber;
  }

  try {
    const response = await axios.post('https://api.semaphore.co/api/v4/messages', {
      apikey: SEMAPHORE_API_KEY,
      number: formattedNumber,
      message: message,
      sendername: SENDER_NAME
    });

    console.log('[SMS] Sent to', formattedNumber, '- Response:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('[SMS] Error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

/**
 * Send alarm SMS to user
 * @param {string} phoneNumber - User's phone number
 * @param {object} alarmData - Alarm details
 */
async function sendAlarmSMS(phoneNumber, alarmData) {
  const { trigger, gas, temperature } = alarmData;
  
  let alertType = 'FIRE ALARM';
  if (trigger === 'gas') alertType = 'GAS DETECTED';
  else if (trigger === 'temperature') alertType = 'HIGH TEMP';
  else if (trigger === 'both') alertType = 'GAS + HIGH TEMP';

  const message = `🔥 ${alertType}!\nGas: ${gas?.toFixed(1) || '--'}%\nTemp: ${temperature?.toFixed(1) || '--'}°C\nCheck your Fire Alarm System now!`;

  return sendSMS(phoneNumber, message);
}

module.exports = { sendSMS, sendAlarmSMS };
