// Fix: Register device in the correct household
require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');

const DEVICE_ID = 'ESP32_001';
const DEVICE_SECRET = '6195d9a4faa9ef076a21eab5810e4ef8';

const householdSchema = new mongoose.Schema({
  householdId: String,
  accessCode: String,
  admin: { email: String, name: String },
  devices: [{ deviceId: String, deviceSecret: String, name: String, location: String }],
  members: Array
}, { collection: 'households' });

const Household = mongoose.model('Household', householdSchema);

async function fixDeviceRegistration() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Remove device from ALL households first
    console.log('Removing device from all households...');
    await Household.updateMany(
      {},
      { $pull: { devices: { deviceId: DEVICE_ID } } }
    );
    console.log('✅ Device removed from all households\n');

    // Find all households and let user choose
    const households = await Household.find({});
    console.log('Available households:\n');
    households.forEach((h, i) => {
      console.log(`${i + 1}. ${h.householdId} - ${h.admin?.name || 'N/A'} (${h.admin?.email || 'N/A'})`);
    });

    // Register in the household with angelonailon@gmail.com (Bullet)
    const targetHousehold = households.find(h => h.admin?.email === 'angelonailon@gmail.com');
    
    if (!targetHousehold) {
      console.log('\n❌ Could not find household for angelonailon@gmail.com');
      console.log('Please specify which household you want to use.');
      process.exit(1);
    }

    console.log(`\nRegistering device in: ${targetHousehold.householdId} (${targetHousehold.admin.name})`);

    if (!targetHousehold.devices) {
      targetHousehold.devices = [];
    }

    targetHousehold.devices.push({
      deviceId: DEVICE_ID,
      deviceSecret: DEVICE_SECRET,
      name: 'FireWire Sensor',
      location: 'Kitchen'
    });

    await targetHousehold.save();
    console.log('✅ Device registered successfully!\n');

    // Verify
    const verify = await Household.findOne({
      'devices.deviceId': DEVICE_ID,
      'devices.deviceSecret': DEVICE_SECRET
    });

    if (verify) {
      console.log('✅ Verification successful!');
      console.log(`   Household: ${verify.householdId}`);
      console.log(`   Admin: ${verify.admin?.name} (${verify.admin?.email})`);
      console.log('\n🎉 Done! Your ESP32 should now work.');
      console.log(`\n⚠️  IMPORTANT: Make sure you're logged into household: ${verify.householdId}`);
      console.log('   on your web dashboard!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

fixDeviceRegistration();
