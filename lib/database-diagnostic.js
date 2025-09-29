import { supabase } from '../lib/supabase'

/**
 * Comprehensive database diagnostic tool
 * Run this to check what's happening with user registration
 */

export async function diagnoseDatabaseIssues() {
  console.log('🔍 DATABASE DIAGNOSTIC REPORT')
  console.log('=' .repeat(50))
  
  const results = {
    tablesExist: false,
    usersTableStructure: null,
    otpTableStructure: null,
    totalAuthUsers: 0,
    totalCustomUsers: 0,
    sampleData: null,
    errors: []
  }

  try {
    // 1. Check if tbl_users exists and get structure
    console.log('\n📋 Checking tbl_users table...')
    const { data: usersData, error: usersError } = await supabase
      .from('tbl_users')
      .select('*')
      .limit(5)

    if (usersError) {
      console.log('❌ tbl_users error:', usersError.message)
      results.errors.push(`tbl_users: ${usersError.message}`)
      
      if (usersError.code === 'PGRST116' || usersError.message.includes('does not exist')) {
        console.log('🚨 TABLE DOES NOT EXIST!')
        console.log('📝 Solution: You need to run the SQL schema in Supabase SQL Editor')
        results.tablesExist = false
      }
    } else {
      console.log('✅ tbl_users table exists')
      results.tablesExist = true
      results.totalCustomUsers = usersData?.length || 0
      results.sampleData = usersData
      console.log(`📊 Found ${results.totalCustomUsers} users in tbl_users`)
      
      if (usersData && usersData.length > 0) {
        console.log('👥 Sample user data:')
        console.log(JSON.stringify(usersData[0], null, 2))
      }
    }

    // 2. Check tbl_OTP table
    console.log('\n📋 Checking tbl_OTP table...')
    const { data: otpData, error: otpError } = await supabase
      .from('tbl_OTP')
      .select('otpID, authID, purpose, isUsed, timeout')
      .limit(5)

    if (otpError) {
      console.log('❌ tbl_OTP error:', otpError.message)
      results.errors.push(`tbl_OTP: ${otpError.message}`)
    } else {
      console.log('✅ tbl_OTP table exists')
      console.log(`📊 Found ${otpData?.length || 0} OTP records`)
    }

    // 3. Test insert capability
    console.log('\n🧪 Testing insert capability...')
    const testUser = {
      authID: '00000000-0000-0000-0000-000000000000', // Dummy UUID
      userName: 'Test User',
      userEmail: 'test@example.com',
      userPassword: 'testpass',
      userBday: '1990-01-01',
      isVerified: false
    }

    const { data: insertTest, error: insertError } = await supabase
      .from('tbl_users')
      .insert(testUser)
      .select()

    if (insertError) {
      console.log('❌ Insert test failed:', insertError.message)
      results.errors.push(`Insert test: ${insertError.message}`)
      
      // Check for specific column issues
      if (insertError.message.includes('column') && insertError.message.includes('does not exist')) {
        console.log('🚨 COLUMN STRUCTURE MISMATCH!')
        console.log('📝 Solution: The table exists but has wrong columns. Run the fix-schema.sql')
      }
    } else {
      console.log('✅ Insert test successful')
      // Clean up test data
      await supabase.from('tbl_users').delete().eq('userEmail', 'test@example.com')
    }

  } catch (err) {
    console.error('❌ Diagnostic failed:', err.message)
    results.errors.push(`Diagnostic error: ${err.message}`)
  }

  // 4. Summary and recommendations
  console.log('\n🎯 DIAGNOSTIC SUMMARY')
  console.log('=' .repeat(30))
  
  if (results.errors.length === 0) {
    console.log('✅ Database is working correctly!')
    console.log(`📊 Custom users: ${results.totalCustomUsers}`)
  } else {
    console.log('❌ Issues found:')
    results.errors.forEach(error => console.log(`   • ${error}`))
    
    console.log('\n💡 RECOMMENDED ACTIONS:')
    
    if (results.errors.some(e => e.includes('does not exist'))) {
      console.log('1. 🔧 Run the complete SQL schema in Supabase SQL Editor')
      console.log('   Copy from: database/schema.sql')
    }
    
    if (results.errors.some(e => e.includes('column') && e.includes('does not exist'))) {
      console.log('2. 🔧 Run the schema fix script in Supabase SQL Editor')
      console.log('   Copy from: database/fix-schema.sql')
    }
    
    console.log('3. 🔧 After running SQL, test signup again')
  }
  
  return results
}

// Simple version that can be called from your app
export async function quickDatabaseCheck() {
  try {
    const { data, error } = await supabase
      .from('tbl_users')
      .select('userID')
      .limit(1)
      
    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        return { status: 'TABLES_MISSING', message: 'Database tables need to be created' }
      } else if (error.message.includes('column') && error.message.includes('does not exist')) {
        return { status: 'SCHEMA_MISMATCH', message: 'Table structure is incorrect' }
      } else {
        return { status: 'ERROR', message: error.message }
      }
    }
    
    return { status: 'OK', message: 'Database is ready' }
  } catch (err) {
    return { status: 'ERROR', message: err.message }
  }
}
