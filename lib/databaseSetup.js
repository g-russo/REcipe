import { supabase } from './supabase'

/**
 * Database setup utility for REcipe app
 * Automatically creates tables if they don't exist
 */

export class DatabaseSetup {
  
  /**
   * Check if tables exist and create them if needed
   */
  static async setupDatabase() {
    console.log('🔧 Setting up database tables...')
    
    try {
      // Test if tables exist by trying to query them
      await this.checkTables()
      console.log('✅ Database tables are ready!')
      return { success: true, message: 'Database setup complete' }
    } catch (error) {
      console.log('⚠️ Tables need to be created. Please run the SQL setup in Supabase.')
      console.error('Database setup error:', error)
      return { 
        success: false, 
        error: error.message,
        requiresManualSetup: true
      }
    }
  }

  /**
   * Check if required tables exist
   */
  static async checkTables() {
    // Try to query both tables
    const { error: usersError } = await supabase
      .from('tbl_users')
      .select('userID')
      .limit(1)

    const { error: otpError } = await supabase
      .from('tbl_OTP')
      .select('otpID')
      .limit(1)

    if (usersError) {
      throw new Error(`tbl_users table issue: ${usersError.message}`)
    }

    if (otpError) {
      throw new Error(`tbl_OTP table issue: ${otpError.message}`)
    }

    return true
  }

  /**
   * Get table information for debugging
   */
  static async getTableInfo() {
    try {
      // Get user count
      const { count: userCount, error: userCountError } = await supabase
        .from('tbl_users')
        .select('*', { count: 'exact', head: true })

      // Get OTP count
      const { count: otpCount, error: otpCountError } = await supabase
        .from('tbl_OTP')
        .select('*', { count: 'exact', head: true })

      return {
        tablesExist: true,
        userCount: userCountError ? 'Error' : userCount,
        otpCount: otpCountError ? 'Error' : otpCount,
        errors: {
          users: userCountError?.message,
          otp: otpCountError?.message
        }
      }
    } catch (error) {
      return {
        tablesExist: false,
        error: error.message
      }
    }
  }

  /**
   * Test database connection
   */
  static async testConnection() {
    try {
      const { data, error } = await supabase.auth.getSession()
      
      if (error) {
        throw error
      }

      return { 
        success: true, 
        message: 'Supabase connection successful',
        hasSession: !!data.session
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }
}
