#!/usr/bin/env node

/**
 * Create Test Users Script
 * Creates test admin and regular users for development/testing
 *
 * Usage: node scripts/create-test-users.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Device = require('../models/Device');
const Permission = require('../models/Permission');

// Test users configuration
const TEST_USERS = [
  {
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    status: 'active'
  },
  {
    username: 'testuser',
    password: 'test123',
    role: 'user',
    status: 'active'
  },
  {
    username: 'john_doe',
    password: 'john123',
    role: 'user',
    status: 'active'
  },
  {
    username: 'jane_smith',
    password: 'jane123',
    role: 'user',
    status: 'inactive'
  }
];

async function createTestUsers() {
  try {
    // Connect to database
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB\n');

    console.log('🧹 Cleaning existing test users...');
    const testUsernames = TEST_USERS.map(u => u.username);
    await User.deleteMany({ username: { $in: testUsernames } });
    console.log('✅ Cleaned existing test users\n');

    console.log('👥 Creating test users:');
    console.log('='.repeat(60));

    for (const userData of TEST_USERS) {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      // Create user
      const user = await User.create({
        username: userData.username,
        password: hashedPassword,
        role: userData.role,
        status: userData.status,
        authorizedDevices: []
      });

      console.log(`✓ Created: ${userData.username}`);
      console.log(`  Role: ${userData.role}`);
      console.log(`  Password: ${userData.password}`);
      console.log(`  Status: ${userData.status}`);
      console.log('');
    }

    console.log('='.repeat(60));
    console.log('✅ All test users created successfully!\n');
    console.log('📝 Login credentials:');
    console.log('');
    TEST_USERS.forEach(u => {
      console.log(`  ${u.role === 'admin' ? '🔑' : '👤'} ${u.username.padEnd(15)} : ${u.password.padEnd(10)} (${u.role})`);
    });
    console.log('');

    // Check if there are any devices to assign
    const devices = await Device.find();
    if (devices.length > 0) {
      console.log(`\n📱 Found ${devices.length} device(s) in database`);
      console.log('Would you like to assign devices to test users?');
      console.log('(You can manually assign them in the admin panel)');
    } else {
      console.log('\n💡 No devices found. Create devices in admin panel to assign to users.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test users:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
console.log('');
console.log('╔════════════════════════════════════════════╗');
console.log('║    RING PANEL - CREATE TEST USERS          ║');
console.log('╚════════════════════════════════════════════╝');
console.log('');

createTestUsers();
