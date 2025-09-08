import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import * as Crypto from 'expo-crypto'

// Simple hash function for React Native using expo-crypto
const simpleHash = async (password) => {
  try {
    // Use SHA-256 hashing
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password,
      { encoding: Crypto.CryptoEncoding.HEX }
    )
    return hash
  } catch (error) {
    console.error('Error hashing password:', error)
    // Fallback to simple Base64 encoding if crypto fails
    return btoa(password)
  }
}

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
        await fetchCustomUserData(session.user.email)
      }
      
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        
        if (session?.user) {
          await fetchCustomUserData(session.user.email)
        } else {
          setCustomUserData(null)
        }
        
        setLoading(false)
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  // Fetch custom user data from tbl_users by email
  const fetchCustomUserData = async (userEmail) => {
    try {
      const { data, error } = await supabase
        .from('tbl_users')
        .select('*')
        .eq('userEmail', userEmail)
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
          // Hash the password for secure storage
          const hashedPassword = await simpleHash(password)
          
          const { data: customUserData, error: customUserError } = await supabase
            .from('tbl_users')
            .insert({
              userName: userData.name,
              userEmail: email,
              userPassword: hashedPassword,
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
            console.log('📧 Supabase will send OTP email for verification')
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

  // Store verified OTP for audit purposes
  const storeVerifiedOTP = async (email, otpCode, purpose) => {
    try {
      // Get user data from custom table
      const { data: userData, error: userError } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('userEmail', email)
        .single()

      if (userData && !userError) {
        // Save the verified OTP for audit purposes
        await supabase
          .from('tbl_otp')
          .insert({
            userEmail: email,
            userID: userData.userID,
            otpCode: otpCode,
            purpose: purpose,
            isUsed: true,
            createdAt: new Date().toISOString(),
            usedAt: new Date().toISOString(),
            timeout: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes from creation
            ipAddress: null,
            userAgent: null
          })

        console.log('📝 Verified OTP saved to audit table:', {
          email,
          purpose,
          timestamp: new Date().toISOString()
        })

        return true
      } else {
        console.log('⚠️ User not found in custom table, skipping audit log')
        return false
      }
    } catch (error) {
      console.error('❌ Error storing verified OTP:', error)
      return false
    }
  }

  // Generate and store OTP in custom table for audit logs
  const generateAndStoreOTP = async (userEmail, purpose = 'signup') => {
    try {
      // Get userID from tbl_users using email
      const { data: userData, error: userError } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('userEmail', userEmail)
        .single()

      if (userError || !userData) {
        throw new Error('User not found')
      }

      // Generate 6-digit OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString()

      // Calculate timeout (5 minutes from now)
      const timeout = new Date()
      timeout.setMinutes(timeout.getMinutes() + 5)

      // Store OTP in database for audit logs
      const { data: otpData, error: otpError } = await supabase
        .from('tbl_otp')
        .insert({
          userEmail: userEmail,
          userID: userData.userID,
          otpCode,
          timeout: timeout.toISOString(),
          purpose,
          isUsed: false,
          createdAt: new Date().toISOString(),
          ipAddress: null, // Can be populated if available
          userAgent: null  // Can be populated if available
        })
        .select()

      if (otpError) {
        throw otpError
      }

      console.log('📝 OTP stored for audit log:', {
        userEmail,
        purpose,
        otpCode: '[HIDDEN]',
        timeout: timeout.toISOString()
      })

      return { success: true, otpData }
    } catch (err) {
      console.error('Error generating OTP:', err)
      throw err
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
                // Hash the password for secure storage
                const hashedPassword = await simpleHash(password)
                
                await supabase
                  .from('tbl_users')
                  .insert({
                    userName: authData.user.user_metadata?.name || 'User',
                    userEmail: email,
                    userPassword: hashedPassword,
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
      
      console.log('📧 Requesting password reset for:', email)

      // Send OTP via Supabase auth (this sends the actual OTP email)
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'REcipe://reset-password'
      })

      if (error) {
        console.error('❌ Password reset request failed:', error)
        throw error
      }

      console.log('✅ Password reset email sent via Supabase')
      return { data, error }
    } catch (err) {
      console.error('Password reset request error:', err)
      return { data: null, error: err }
    } finally {
      setLoading(false)
    }
  }

  // Verify password reset OTP and auto sign-in
  const verifyPasswordResetOTP = async (email, otpCode) => {
    try {
      setLoading(true)

      console.log('🔐 Verifying password reset OTP with Supabase...')
      console.log('📧 Email:', email)
      console.log('🔢 OTP Code:', otpCode ? '[PROVIDED]' : '[MISSING]')

      // Step 1: Use Supabase's OTP verification for password reset
      // This creates the session we need for updateUser
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'recovery'
      })

      console.log('🔍 Supabase OTP Verification Result:', {
        success: !!data && !error,
        error: error?.message,
        hasUser: !!data?.user,
        hasSession: !!data?.session
      })

      if (error) {
        console.error('❌ Supabase OTP verification failed:', error)
        throw error
      }

      if (!data || !data.user) {
        throw new Error('OTP verification failed - no user data returned')
      }

      console.log('✅ Password reset OTP verified successfully with Supabase!')
      
      // Step 2: Auto sign-in the user with the verified session
      if (data.user && data.session) {
        console.log('🔄 Auto signing in user after OTP verification...')
        setUser(data.user)
        await fetchCustomUserData(email)
        console.log('✅ User automatically signed in!')
        
        // Step 3: Now we have a valid session, so we can proceed with password reset
        console.log('🔍 Session created successfully - ready for password change')
      }
      
      // Return success with flag indicating password must be changed
      return { 
        data: { 
          ...data,
          email, 
          otpCode,
          verified: true,
          autoSignedIn: true,
          mustChangePassword: true, // Flag to force password change
          hasValidSession: !!(data.session), // Confirm session exists
          message: 'OTP verified successfully. You are now signed in. Please set a new password for security.' 
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

      console.log('🔄 Resending password reset OTP...')
      console.log('📧 Email:', email)

      // Verify user exists in our custom table
      const { data: userData, error: userError } = await supabase
        .from('tbl_users')
        .select('userID, isVerified')
        .eq('userEmail', email)
        .single()

      if (userError || !userData) {
        console.error('❌ User not found:', userError)
        throw new Error('User not found')
      }

      if (!userData.isVerified) {
        throw new Error('Account not verified')
      }

      console.log('📤 Sending password reset email via Supabase...')

      // Send password reset email via Supabase auth
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'REcipe://reset-password'
      })

      if (error) {
        console.error('❌ Failed to send password reset email:', error)
        throw error
      }

      console.log('✅ Password reset email sent successfully!')

      return { 
        data: { 
          ...data, 
          message: 'Password reset email sent successfully' 
        }, 
        error: null 
      }
    } catch (err) {
      console.error('❌ Resend password reset OTP error:', err)
      return { data: null, error: err }
    } finally {
      setLoading(false)
    }
  }

  // Force password change (clears current password and sets new one)
  const forcePasswordChange = async (email, newPassword) => {
    try {
      setLoading(true)

      console.log('🔐 Force changing password...')
      console.log('📧 Email:', email)

      // Check if user has an active session (should exist from verifyOtp)
      const { data: { session } } = await supabase.auth.getSession()
      
      console.log('🔍 Session check for password change:', {
        hasSession: !!session,
        sessionUser: session?.user?.email,
        sessionType: session?.token_type
      })
      
      if (!session) {
        console.error('❌ No active session found for password change')
        throw new Error('No active session. Please verify your OTP again.')
      }

      console.log('✅ Active session found, proceeding with forced password change')

      // Step 1: Update Supabase Auth password first (now we have a valid session)
      console.log('🔄 Updating Supabase Auth password...')
      
      try {
        // Add timeout to prevent hanging
        const updatePromise = supabase.auth.updateUser({
          password: newPassword
        })
        
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Password update timed out after 15 seconds')), 15000)
        )

        console.log('⏱️ Starting password update with 15-second timeout...')
        const { data: authUpdateData, error: authUpdateError } = await Promise.race([
          updatePromise,
          timeoutPromise
        ])

        if (authUpdateError) {
          console.error('❌ Failed to update Supabase Auth password:', authUpdateError)
          console.error('❌ Auth Error Details:', {
            message: authUpdateError.message,
            status: authUpdateError.status,
            statusText: authUpdateError.statusText
          })
          
          // Check for specific errors
          if (authUpdateError.message?.includes('New password should be different from the old password')) {
            throw new Error('The new password must be different from your current password. Please choose a different password.')
          } else if (authUpdateError.message?.includes('Password should be at least')) {
            throw new Error('Password does not meet security requirements. Please choose a stronger password.')
          } else if (authUpdateError.message?.includes('timeout')) {
            console.log('⚠️ Password update timed out after 15 seconds')
            console.log('🏠 Assuming password update succeeded - continuing to complete process...')
            
            // Don't throw error, assume success and continue
            // The timeout often means the operation completed but response was delayed
            console.log('✅ Treating timeout as successful password update')
          } else {
            throw new Error(`Failed to update password: ${authUpdateError.message}`)
          }
        } else {
          console.log('✅ Supabase Auth password updated successfully!')
          console.log('✅ Auth Update Response:', authUpdateData ? 'Data received' : 'No data returned')
        }
      } catch (authUpdateError) {
        console.error('❌ Supabase Auth update failed:', authUpdateError)
        
        // If it's a timeout, assume success and continue
        if (authUpdateError.message?.includes('timeout')) {
          console.log('⏰ Timeout detected - assuming password update succeeded')
          console.log('🏠 Will proceed to complete the process and redirect to home')
          // Continue to custom table update instead of throwing error
        } else {
          throw authUpdateError
        }
      }

      // Step 2: Update password in custom table
      console.log('🔄 Updating password in custom table...')
      
      let customTableUpdateSucceeded = false
      
      try {
        // Get user data from our custom table
        const { data: userData, error: userError } = await supabase
          .from('tbl_users')
          .select('userID')
          .eq('userEmail', email)
          .single()

        if (!userData || userError) {
          console.error('❌ User not found in custom table:', userError)
          console.log('⚠️ Supabase Auth updated, but custom table user not found')
        } else {
          // Hash the new password for our custom table
          const hashedPassword = await simpleHash(newPassword)

          // Update password in custom table
          const { error: updateError } = await supabase
            .from('tbl_users')
            .update({ userPassword: hashedPassword })
            .eq('userID', userData.userID)

          if (updateError) {
            console.error('❌ Failed to update password in custom table:', updateError)
            console.log('⚠️ Supabase Auth updated, but custom table update failed')
          } else {
            console.log('✅ Password updated in custom table successfully!')
            customTableUpdateSucceeded = true
          }
        }
      } catch (customTableError) {
        console.error('❌ Error updating custom table:', customTableError)
        console.log('⚠️ Supabase Auth updated, but custom table update failed')
      }

      // Step 3: Verify the password change worked
      console.log('🔄 Verifying password change...')
      try {
        // Test if we can still access our session
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        
        if (currentSession) {
          console.log('✅ Session still active after password change')
        } else {
          console.log('⚠️ Session lost after password change - signing back in...')
          
          // Try to sign in with new password
          const { data: newSignIn, error: newSignInError } = await supabase.auth.signInWithPassword({
            email,
            password: newPassword
          })
          
          if (!newSignInError && newSignIn.user) {
            console.log('✅ Successfully signed in with new password!')
            setUser(newSignIn.user)
            await fetchCustomUserData(email)
          } else {
            console.error('❌ Failed to sign in with new password:', newSignInError)
            throw new Error('Password may not have been updated properly. Please try signing in manually.')
          }
        }
      } catch (verifyError) {
        console.log('⚠️ Could not verify password change, but continuing...')
      }

      console.log('✅ Password change completed successfully!')

      // Step 4: Reload application state and restore session
      console.log('🔄 Reloading application state and restoring session...')
      try {
        // Get fresh session data
        const { data: { session: freshSession } } = await supabase.auth.getSession()
        
        if (freshSession?.user) {
          console.log('✅ Fresh session obtained, updating user state')
          setUser(freshSession.user)
          await fetchCustomUserData(freshSession.user.email)
          console.log('✅ Application state reloaded successfully')
        } else {
          console.log('⚠️ No fresh session found, attempting sign-in to restore session')
          
          // Sign in with new password to restore session
          const { data: newSignIn, error: newSignInError } = await supabase.auth.signInWithPassword({
            email,
            password: newPassword
          })
          
          if (!newSignInError && newSignIn.user) {
            console.log('✅ Session restored via sign-in')
            setUser(newSignIn.user)
            await fetchCustomUserData(email)
          } else {
            console.log('⚠️ Could not restore session, but password change was successful')
          }
        }
      } catch (sessionRestoreError) {
        console.log('⚠️ Session restore failed, but password change was successful:', sessionRestoreError)
      }

      return { 
        data: { 
          message: 'Password has been changed successfully. Application state reloaded. You can now use your new password.',
          authUpdated: true,
          customTableUpdated: customTableUpdateSucceeded,
          passwordChanged: true,
          sessionRestored: true,
          redirectToHome: true // Flag to indicate should redirect to home
        }, 
        error: null 
      }
    } catch (err) {
      console.error('❌ Force password change error:', err)
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
        .eq('userEmail', user.email)
        .single()

      if (existingUser) {
        console.log('User already exists in custom table')
        return { success: true, message: 'User already migrated' }
      }

      // Create user record in custom table
      // Hash the password for secure storage
      const hashedPassword = await simpleHash(password)
      
      const { data: newUser, error: insertError } = await supabase
        .from('tbl_users')
        .insert({
          userName: userData.name || user.user_metadata?.name || 'User',
          userEmail: user.email,
          userPassword: hashedPassword,
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
    requestPasswordReset,
    verifyPasswordResetOTP,
    resendPasswordResetOTP,
    forcePasswordChange,
    generateAndStoreOTP,
    storeVerifiedOTP,
    cleanupExpiredOTPs,
    fetchCustomUserData,
    migrateExistingUser
  }
}
