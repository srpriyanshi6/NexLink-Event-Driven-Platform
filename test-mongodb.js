const mongoose = require('mongoose');

// Test connection for User Service
const testUri = 'mongodb+srv://priyanshisablok23_db_user:sairam@nexlink.f4nvxsa.mongodb.net/test-db?retryWrites=true&w=majority';

async function testConnection() {
  try {
    console.log('🔌 Testing MongoDB Atlas connection...');
    
    await mongoose.connect(testUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ Connected successfully to MongoDB Atlas!');
    
    // Test creating a collection
    const testCollection = mongoose.connection.db.collection('test');
    await testCollection.insertOne({ test: true, timestamp: new Date() });
    console.log('✅ Successfully wrote to database');
    
    const result = await testCollection.findOne({ test: true });
    console.log('✅ Successfully read from database:', result);
    
    await mongoose.connection.close();
    console.log('🎉 MongoDB is working perfectly!');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    
    if (error.message.includes('bad auth')) {
      console.error('⚠️  Authentication failed - check username/password');
    } else if (error.message.includes('ENOTFOUND')) {
      console.error('⚠️  Network error - check cluster name');
    } else if (error.message.includes('IP')) {
      console.error('⚠️  IP not whitelisted - add 0.0.0.0/0 to Network Access');
    }
  }
}

testConnection();