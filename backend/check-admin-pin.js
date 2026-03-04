// Check admin PIN for household
require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');

const householdSchema = new mongoose.Schema({
  householdId: String,
  accessCode: String,
  adminPin: String,
  admin: { email: String, name: String },
  devices: Array,
  members: Array
}, { collection: 'households' });

const Household = mongoose.model('Household', householdSchema);

async function checkAdminPin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find the household with angelonailon@gmail.com
    const household = await Household.findOne({ 
      householdId: 'P@ssw0rd123'
    });

    if (!household) {
      console.log('❌ Household not found');
      process.exit(1);
    }

    console.log('Household Information:');
    console.log('=====================');
    console.log(`Household ID: ${household.householdId}`);
    console.log(`Admin: ${household.admin?.name || 'N/A'} (${household.admin?.email || 'N/A'})`);
    console.log(`Access Code: ${household.accessCode || 'Not set'}`);
    console.log(`Admin PIN: ${household.adminPin || 'Not set'}`);
    console.log(`\nDevices: ${household.devices?.length || 0}`);
    if (household.devices && household.devices.length > 0) {
      household.devices.forEach(d => {
        console.log(`  - ${d.deviceId} (${d.name || 'Unnamed'})`);
      });
    }
    console.log(`\nMembers: ${household.members?.length || 0}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkAdminPin();
