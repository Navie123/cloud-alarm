// Quick script to check and register ESP32 device in MongoDB
// Run this with: node check-device-registration.js

require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');

const DEVICE_ID = 'ESP32_001';
const DEVICE_SECRET = '6195d9a4faa9ef076a21eab5810e4ef8';

// Household Schema (simplified)
const householdSchema = new mongoose.Schema({
  householdId: String,
  accessCode: String,
  admin: {
    email: String,
    name: String
  },
  devices: [{
    deviceId: String,
    deviceSecret: String,
    name: String,
    location: String
  }],
  members: Array
}, { collection: 'households' });

const Household = mongoose.model('Household', householdSchema);

async function checkAndRegisterDevice() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check if device is already registered
    console.log(`Checking if device ${DEVICE_ID} is registered...`);
    const existingHousehold = await Household.findOne({
      'devices.deviceId': DEVICE_ID,
      'devices.deviceSecret': DEVICE_SECRET
    });

    if (existingHousehold) {
      console.log('✅ Device is already registered!');
      console.log(`   Household ID: ${existingHousehold.householdId}`);
      console.log(`   Admin: ${existingHousehold.admin?.name} (${existingHousehold.admin?.email})`);
      console.log('\n✅ Everything is configured correctly!');
      console.log('   The 401 error might be due to Render server cache.');
      console.log('   Try restarting your Render service.');
      process.exit(0);
    }

    console.log('❌ Device is NOT registered in any household\n');

    // Find all households
    const households = await Household.find({});
    console.log(`Found ${households.length} household(s):\n`);

    households.forEach((h, i) => {
      console.log(`${i + 1}. Household ID: ${h.householdId}`);
      console.log(`   Admin: ${h.admin?.name || 'N/A'} (${h.admin?.email || 'N/A'})`);
      console.log(`   Devices: ${h.devices?.length || 0}`);
      if (h.devices && h.devices.length > 0) {
        h.devices.forEach(d => {
          console.log(`     - ${d.deviceId} (${d.name || 'Unnamed'})`);
        });
      }
      console.log('');
    });

    if (households.length === 0) {
      console.log('❌ No households found! You need to create a household first.');
      console.log('   Go to https://cloud-alarm.onrender.com and set up your household.');
      process.exit(1);
    }

    // Register device in the first household (or prompt user)
    console.log('Would you like to register the device?');
    console.log('This script will register it in the FIRST household listed above.\n');

    // Auto-register in first household
    const targetHousehold = households[0];
    console.log(`Registering device in household: ${targetHousehold.householdId}...`);

    // Check if device already exists (with different secret)
    const existingDevice = targetHousehold.devices?.find(d => d.deviceId === DEVICE_ID);
    if (existingDevice) {
      console.log('⚠️  Device ID already exists with different secret. Updating...');
      existingDevice.deviceSecret = DEVICE_SECRET;
      existingDevice.name = 'FireWire Sensor';
      existingDevice.location = 'Kitchen';
    } else {
      if (!targetHousehold.devices) {
        targetHousehold.devices = [];
      }
      targetHousehold.devices.push({
        deviceId: DEVICE_ID,
        deviceSecret: DEVICE_SECRET,
        name: 'FireWire Sensor',
        location: 'Kitchen'
      });
    }

    await targetHousehold.save();
    console.log('✅ Device registered successfully!\n');

    // Verify registration
    const verifyHousehold = await Household.findOne({
      'devices.deviceId': DEVICE_ID,
      'devices.deviceSecret': DEVICE_SECRET
    });

    if (verifyHousehold) {
      console.log('✅ Verification successful!');
      console.log(`   Device ${DEVICE_ID} is now registered in household ${verifyHousehold.householdId}`);
      console.log('\n🎉 Your ESP32 should now connect successfully!');
      console.log('   Watch the Serial Monitor for: "Data sent, response: 200"');
    } else {
      console.log('❌ Verification failed. Something went wrong.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

checkAndRegisterDevice();
