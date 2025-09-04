import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useCustomAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [customUserData, setCustomUserData] = useState(null)

  useEffect(() => {
    // Get initial session and user data
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        setUser(session.user)
        await fetchCustomUserData(session.user.id)
      }
      
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        
        if (session?.user) {
          await fetchCustomUserData(session.user.id)
        } else {
          setCustomUserData(null)
        }
        
        setLoading(false)
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  // Fetch custom user data from tbl_users
  const fetchCustomUserData = async (authID) => {
    try {
      const { data, error } = await supabase
        .from('tbl_users')
        .select('*')
        .eq('authID', authID)
        .single()

      if (!error && data) {
        setCustomUserData(data)
      }
    } catch (err) {
      console.error('Error fetching custom user data:', err)
    }
  }

  // Custom sign up that creates both auth user and custom user record
  const signUp = async (email, password, userData) => {
    try {
      setLoading(true)

      // First, create the auth user (this will trigger OTP email via Supabase)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: userData.name,
            birthdate: userData.birthdate
          }
        }
      })

      if (authError) {
        // Handle rate limiting specifically
        if (authError.message?.includes('email rate limit exceeded')) {
          const rateLimitError = new Error('Too many sign-up attempts. Please wait 15 minutes before trying again, or use a different email address.')
          rateLimitError.code = 'RATE_LIMIT_EXCEEDED'
          rateLimitError.originalError = authError
          throw rateLimitError
        }
        
        // Handle other auth errors
        throw authError
      }

      // If auth user was created successfully, try to create custom user record
      if (authData.user) {
        console.log('🔄 Supabase auth user created successfully:', authData.user.id)
        console.log('📝 Now attempting to create custom user record...')
        
        try {
          const { data: customUserData, error: customUserError } = await supabase
            .from('tbl_users')
            .insert({
              authID: authData.user.id,
              userName: userData.name,
              userEmail: email,
              userPassword: password, // Note: In production, you might want to hash this
              userBday: userData.birthdate,
              isVerified: false
            })
            .select()

          if (customUserError) {
            console.error('❌ Error creating custom user:', customUserError)
            console.error('❌ Error details:', {
              code: customUserError.code,
              message: customUserError.message,
              details: customUserError.details,
              hint: customUserError.hint
            })
            
            // Provide specific guidance based on error type
            if (customUserError.code === 'PGRST116' || customUserError.message.includes('does not exist')) {
              console.log('🚨 DATABASE TABLES DO NOT EXIST!')
              console.log('📝 You need to create the tables in Supabase SQL Editor')
              console.log('📝 1. Go to Supabase Dashboard > SQL Editor')
              console.log('📝 2. Copy and run the SQL from database/schema.sql OR database/fix-schema.sql')
            } else if (customUserError.message.includes('column') && customUserError.message.includes('does not exist')) {
              console.log('🚨 TABLE STRUCTURE IS WRONG!')
              console.log('📝 Run the fix-schema.sql to recreate tables with correct structure')
            }
            
            // Don't throw error here - let the auth flow continue with Supabase's built-in system
            console.log('⚠️ Continuing with Supabase-only authentication for now...')
          } else {
            console.log('✅ Custom user created successfully:', customUserData)
            console.log('🎉 User now exists in BOTH Supabase auth AND custom tbl_users table!')
            
            // Only try to generate custom OTP if custom user was created successfully
            try {
              console.log('📧 Generating custom OTP...')
              await generateAndStoreOTP(authData.user.id, 'signup')
              console.log('✅ Custom OTP generated successfully!')
            } catch (otpError) {
              console.error('❌ Error generating custom OTP:', otpError)
              console.log('⚠️ Custom OTP generation failed, but Supabase auth OTP should still work')
            }
          }
        } catch (tableError) {
          console.error('❌ Database table error:', tableError)
          console.log('⚠️ Tables may not be set up yet. Using Supabase auth only for now.')
        }
      }

      return { data: authData, error: authError }
    } catch (err) {
      console.error('Sign up error:', err)
      return { data: null, error: err }
    } finally {
      setLoading(false)
    }
  }

  // Generate and store OTP in custom table
  const generateAndStoreOTP = async (authID, purpose = 'signup') => {
    try {
      // Get userID from tbl_users
      const { data: userData, error: userError } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('authID', authID)
        .single()

      if (userError || !userData) {
        throw new Error('User not found')
      }

      // Generate 6-digit OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString()

      // Calculate timeout (5 minutes from now)
      const timeout = new Date()
      timeout.setMinutes(timeout.getMinutes() + 5)

      // Store OTP in database
      const { data: otpData, error: otpError } = await supabase
        .from('tbl_OTP')
        .insert({
          authID,
          userID: userData.userID,
          otpCode,
          timeout: timeout.toISOString(),
          purpose,
          isUsed: false
        })
        .select()

      if (otpError) {
        throw otpError
      }

      return { success: true, otpData }
    } catch (err) {
      console.error('Error generating OTP:', err)
      throw err
    }
  }

  // Verify OTP using custom table or fallback to Supabase
  const verifyOTP = async (email, otpCode, purpose = 'signup') => {
    try {
      setLoading(true)

      // Try custom table verification first
      try {
        // Get the user by email
        const { data: userData, error: userError } = await supabase
          .from('tbl_users')
          .select('userID, authID')
          .eq('userEmail', email)
          .single()

        if (userData && !userError) {
          // Check if OTP exists and is valid in custom table
          const { data: otpData, error: otpError } = await supabase
            .from('tbl_OTP')
            .select('*')
            .eq('authID', userData.authID)
            .eq('otpCode', otpCode)
            .eq('purpose', purpose)
            .eq('isUsed', false)
            .gte('timeout', new Date().toISOString())
            .single()

          if (otpData && !otpError) {
            // Mark OTP as used
            await supabase
              .from('tbl_OTP')
              .update({ isUsed: true })
              .eq('otpID', otpData.otpID)

            // Update user verification status
            await supabase
              .from('tbl_users')
              .update({ isVerified: true })
              .eq('userID', userData.userID)
          }
        }
      } catch (customError) {
        console.log('Custom table verification not available, using Supabase auth only:', customError)
      }

      // Always try Supabase auth verification (this is what actually completes the auth process)
      const { data: authData, error: authError } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: purpose
      })

      return { data: authData, error: authError }
    } catch (err) {
      console.error('OTP verification error:', err)
      return { data: null, error: err }
    } finally {
      setLoading(false)
    }
  }

  // Resend OTP
  const resendOTP = async (email, purpose = 'signup') => {
    try {
      setLoading(true)

      // Get user data
      const { data: userData, error: userError } = await supabase
        .from('tbl_users')
        .select('userID, authID')
        .eq('userEmail', email)
        .single()

      if (userError || !userData) {
        throw new Error('User not found')
      }

      // Mark all existing OTPs as used
      await supabase
        .from('tbl_OTP')
        .update({ isUsed: true })
        .eq('authID', userData.authID)
        .eq('purpose', purpose)

      // Generate new OTP
      await generateAndStoreOTP(userData.authID, purpose)

      // Resend via Supabase auth
      const { data, error } = await supabase.auth.resend({
        type: purpose,
        email
      })

      // Handle rate limiting for resend
      if (error?.message?.includes('email rate limit exceeded')) {
        const rateLimitError = new Error('Too many email requests. Please wait 15 minutes before requesting another verification code.')
        rateLimitError.code = 'RATE_LIMIT_EXCEEDED'
        rateLimitError.originalError = error
        throw rateLimitError
      }

      return { data, error }
    } catch (err) {
      console.error('Resend OTP error:', err)
      return { data: null, error: err }
    } finally {
      setLoading(false)
    }
  }

  // Sign in function
  const signIn = async (email, password) => {
    try {
      setLoading(true)

      // Try to sign in with Supabase auth first (this is the primary authentication)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        // Handle specific auth errors
        if (authError.message?.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password. Please check your credentials and try again.')
        }
        if (authError.message?.includes('Email not confirmed')) {
          throw new Error('Please verify your email address before signing in. Check your inbox for the verification email.')
        }
        throw authError
      }

      // If Supabase auth succeeds, check if user exists in custom table
      if (authData.user) {
        try {
          const { data: userData, error: userError } = await supabase
            .from('tbl_users')
            .select('*')
            .eq('userEmail', email)
            .single()

          if (userData && !userError) {
            // User exists in custom table, check if verified
            if (!userData.isVerified) {
              // Update verification status if Supabase auth shows user is confirmed
              if (authData.user.email_confirmed_at) {
                await supabase
                  .from('tbl_users')
                  .update({ isVerified: true })
                  .eq('userEmail', email)
                
                console.log('User verification status updated in custom table')
              } else {
                throw new Error('Please verify your email address before signing in.')
              }
            }
          } else {
            // User doesn't exist in custom table but exists in Supabase auth
            // This can happen if they signed up before tables were created
            console.log('User exists in Supabase auth but not in custom table - this is okay')
            
            // Optionally, create a record in custom table if you want
            if (authData.user.email_confirmed_at) {
              try {
                await supabase
                  .from('tbl_users')
                  .insert({
                    authID: authData.user.id,
                    userName: authData.user.user_metadata?.name || 'User',
                    userEmail: email,
                    userPassword: password, // Note: This is not ideal, but matches your current schema
                    userBday: authData.user.user_metadata?.birthdate || '2000-01-01',
                    isVerified: true
                  })
                
                console.log('Created custom user record for existing Supabase auth user')
              } catch (insertError) {
                console.log('Could not create custom user record, but sign-in can continue:', insertError.message)
              }
            }
          }
        } catch (customTableError) {
          // Custom table doesn't exist or there's an issue - that's okay, use Supabase auth only
          console.log('Custom table not available, using Supabase auth only:', customTableError.message)
        }
      }

      return { data: authData, error: authError }
    } catch (err) {
      console.error('Sign in error:', err)
      return { data: null, error: err }
    } finally {
      setLoading(false)
    }
  }

  // Sign out function
  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      setCustomUserData(null)
    }
    return { error }
  }

  // Request password reset (generates OTP)
  const requestPasswordReset = async (email) => {
    try {
      setLoading(true)

      // Check if user exists and is verified
      const { data: userData, error: userError } = await supabase
        .from('tbl_users')
        .select('userID, authID, isVerified')
        .eq('userEmail', email)
        .single()

      if (userError || !userData) {
        throw new Error('User not found with this email address')
      }

      if (!userData.isVerified) {
        throw new Error('Account not verified. Please complete email verification first.')
      }

      // Clean up old password reset OTPs
      await supabase
        .from('tbl_OTP')
        .update({ isUsed: true })
        .eq('authID', userData.authID)
        .eq('purpose', 'forgot_password')

      // Generate new OTP for password reset
      await generateAndStoreOTP(userData.authID, 'forgot_password')

      // Send OTP via Supabase auth (this will use your email template)
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'REcipe://reset-password' // This won't be used since we're using OTP
      })

      return { data, error }
    } catch (err) {
      console.error('Password reset request error:', err)
      return { data: null, error: err }
    } finally {
      setLoading(false)
    }
  }

  // Verify password reset OTP
  const verifyPasswordResetOTP = async (email, otpCode) => {
    try {
      setLoading(true)

      // Get user data
      const { data: userData, error: userError } = await supabase
        .from('tbl_users')
        .select('userID, authID')
        .eq('userEmail', email)
        .single()

      if (userError || !userData) {
        throw new Error('User not found')
      }

      // Validate OTP
      const { data: otpData, error: otpError } = await supabase
        .from('tbl_OTP')
        .select('*')
        .eq('authID', userData.authID)
        .eq('otpCode', otpCode)
        .eq('purpose', 'forgot_password')
        .eq('isUsed', false)
        .gte('timeout', new Date().toISOString())
        .single()

      if (otpError || !otpData) {
        throw new Error('Invalid or expired verification code')
      }

      // Mark OTP as used
      await supabase
        .from('tbl_OTP')
        .update({ isUsed: true })
        .eq('otpID', otpData.otpID)

      // Return success with reset token (you can use the otpID as token)
      return { 
        data: { 
          resetToken: otpData.otpID,
          userID: userData.userID,
          authID: userData.authID 
        }, 
        error: null 
      }
    } catch (err) {
      console.error('Password reset OTP verification error:', err)
      return { data: null, error: err }
    } finally {
      setLoading(false)
    }
  }

  // Resend password reset OTP
  const resendPasswordResetOTP = async (email) => {
    try {
      setLoading(true)

      // Get user data
      const { data: userData, error: userError } = await supabase
        .from('tbl_users')
        .select('userID, authID, isVerified')
        .eq('userEmail', email)
        .single()

      if (userError || !userData) {
        throw new Error('User not found')
      }

      if (!userData.isVerified) {
        throw new Error('Account not verified')
      }

      // Mark existing password reset OTPs as used
      await supabase
        .from('tbl_OTP')
        .update({ isUsed: true })
        .eq('authID', userData.authID)
        .eq('purpose', 'forgot_password')

      // Generate new OTP
      await generateAndStoreOTP(userData.authID, 'forgot_password')

      // Resend via Supabase auth
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'REcipe://reset-password'
      })

      return { data, error }
    } catch (err) {
      console.error('Resend password reset OTP error:', err)
      return { data: null, error: err }
    } finally {
      setLoading(false)
    }
  }

  // Reset password with new password
  const resetPassword = async (email, newPassword, resetToken) => {
    try {
      setLoading(true)

      // Get user data
      const { data: userData, error: userError } = await supabase
        .from('tbl_users')
        .select('userID, authID')
        .eq('userEmail', email)
        .single()

      if (userError || !userData) {
        throw new Error('User not found')
      }

      // Verify reset token is valid (check if OTP with this ID exists and was used for forgot_password)
      const { data: otpData, error: otpError } = await supabase
        .from('tbl_OTP')
        .select('*')
        .eq('otpID', resetToken)
        .eq('authID', userData.authID)
        .eq('purpose', 'forgot_password')
        .eq('isUsed', true)
        .single()

      if (otpError || !otpData) {
        throw new Error('Invalid or expired reset session')
      }

      // Check if reset session is still valid (within reasonable time, e.g., 30 minutes)
      const resetTime = new Date(otpData.timeout)
      const now = new Date()
      const timeDiff = now - resetTime
      const thirtyMinutes = 30 * 60 * 1000

      if (timeDiff > thirtyMinutes) {
        throw new Error('Reset session has expired')
      }

      // Update password in custom table
      const { error: updateError } = await supabase
        .from('tbl_users')
        .update({ userPassword: newPassword })
        .eq('userID', userData.userID)

      if (updateError) {
        throw updateError
      }

      // Also update in Supabase Auth (this is important for sign-in to work)
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      })

      // Clean up all OTPs for this user
      await supabase
        .from('tbl_OTP')
        .delete()
        .eq('authID', userData.authID)

      return { data, error }
    } catch (err) {
      console.error('Reset password error:', err)
      return { data: null, error: err }
    } finally {
      setLoading(false)
    }
  }

  // Clean up expired OTPs (utility function)
  const cleanupExpiredOTPs = async () => {
    try {
      const { error } = await supabase
        .from('tbl_OTP')
        .delete()
        .or(`timeout.lt.${new Date().toISOString()},isUsed.eq.true`)

      if (error) {
        console.error('Error cleaning up OTPs:', error)
      }
    } catch (err) {
      console.error('Error in cleanup:', err)
    }
  }

  // Migrate existing Supabase auth user to custom table (utility function)
  const migrateExistingUser = async (email, password, userData = {}) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('No authenticated user found')
      }

      // Check if user already exists in custom table
      const { data: existingUser } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('authID', user.id)
        .single()

      if (existingUser) {
        console.log('User already exists in custom table')
        return { success: true, message: 'User already migrated' }
      }

      // Create user record in custom table
      const { data: newUser, error: insertError } = await supabase
        .from('tbl_users')
        .insert({
          authID: user.id,
          userName: userData.name || user.user_metadata?.name || 'User',
          userEmail: user.email,
          userPassword: password, // Note: In production, this should be hashed
          userBday: userData.birthdate || user.user_metadata?.birthdate || '2000-01-01',
          isVerified: user.email_confirmed_at ? true : false
        })
        .select()

      if (insertError) {
        throw insertError
      }

      console.log('Successfully migrated user to custom table:', newUser)
      return { success: true, data: newUser }
    } catch (err) {
      console.error('Error migrating user:', err)
      return { success: false, error: err.message }
    }
  }

  return {
    user,
    customUserData,
    loading,
    signUp,
    signIn,
    signOut,
    verifyOTP,
    resendOTP,
    requestPasswordReset,
    verifyPasswordResetOTP,
    resendPasswordResetOTP,
    resetPassword,
    generateAndStoreOTP,
    cleanupExpiredOTPs,
    fetchCustomUserData,
    migrateExistingUser
  }
}
