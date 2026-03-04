// Check all household credentials
require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');

const householdSchema = new mongoose.Schema({
  householdId: String,
  accessCode: String,
  adminPin: String,
  passkey: String,
  admin: { 
    email: String, 
    name: String,
    googleId: String 
  },
  devices: Array,
  members: Array,
  adminEmailAlerts: Boolean
}, { collection: 'households' });

const Household = mongoose.model('Household', householdSchema);

async function checkCredentials() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const household = await Household.findOne({ 
      householdId: 'P@ssw0rd123'
    });

    if (!household) {
      console.log('❌ Household not found');
      process.exit(1);
    }

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║         HOUSEHOLD CREDENTIALS & INFORMATION            ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    console.log('🏠 HOUSEHOLD ACCESS:');
    console.log('   Household ID: ' + household.householdId);
    console.log('   Access Code:  ' + (household.accessCode || 'Not set'));
    console.log('   Passkey:      ' + (household.passkey || 'Not set'));
    console.log('');

    console.log('👤 ADMIN INFORMATION:');
    console.log('   Name:         ' + (household.admin?.name || 'Not set'));
    console.log('   Email:        ' + (household.admin?.email || 'Not set'));
    console.log('   Google ID:    ' + (household.admin?.googleId || 'Not set'));
    console.log('   Admin PIN:    ' + (household.adminPin || 'Not set'));
    console.log('');

    console.log('📧 EMAIL ALERTS:');
    console.log('   Status:       ' + (household.adminEmailAlerts !== false ? 'Enabled ✅' : 'Disabled ❌'));
    console.log('');

    console.log('📱 DEVICES:');
    if (household.devices && household.devices.length > 0) {
      household.devices.forEach((d, i) => {
        console.log(`   ${i + 1}. ${d.deviceId}`);
        console.log(`      Name:     ${d.name || 'Unnamed'}`);
        console.log(`      Secret:   ${d.deviceSecret}`);
        console.log(`      Location: ${d.location || 'Not set'}`);
        console.log('');
      });
    } else {
      console.log('   No devices registered');
      console.log('');
    }

    console.log('👥 MEMBERS:');
    console.log('   Total:        ' + (household.members?.length || 0));
    console.log('');

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║                    QUICK REFERENCE                     ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    console.log('To login to web dashboard:');
    console.log(`  1. Go to: https://cloud-alarm.onrender.com`);
    console.log(`  2. Enter Household ID: ${household.householdId}`);
    console.log(`  3. Enter Access Code: ${household.accessCode || 'Not set'}`);
    console.log(`  4. Enter your name`);
    console.log('');
    console.log('For admin actions (silence alarm, change settings):');
    console.log(`  - Admin PIN: ${household.adminPin || 'Not set (needs to be created)'}`);
    console.log('');
    console.log('For household passkey feature:');
    console.log(`  - Passkey: ${household.passkey || 'Not set (needs to be created)'}`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkCredentials();
