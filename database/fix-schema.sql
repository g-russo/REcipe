-- FIX SCHEMA: Drop and recreate tables with correct structure
-- Run this in Supabase SQL Editor to fix the column mismatch issue

-- First, drop existing tables if they have wrong structure
DROP TABLE IF EXISTS tbl_OTP CASCADE;
DROP TABLE IF EXISTS tbl_users CASCADE;

-- Now create them with the EXACT structure your code expects
CREATE TABLE tbl_users (
    userID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authID UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    userName VARCHAR(50) NOT NULL,
    userEmail VARCHAR(255) UNIQUE NOT NULL,
    userPassword VARCHAR(255) NOT NULL,
    userBday DATE NOT NULL,
    isVerified BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE tbl_OTP (
    otpID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authID UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    userID UUID REFERENCES tbl_users(userID) ON DELETE CASCADE,
    otpCode VARCHAR(6) NOT NULL,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    timeout TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
    purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('signup', 'forgot_password')),
    isUsed BOOLEAN DEFAULT FALSE
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON tbl_users(userEmail);
CREATE INDEX idx_users_authid ON tbl_users(authID);
CREATE INDEX idx_otp_code ON tbl_OTP(otpCode);
CREATE INDEX idx_otp_authid ON tbl_OTP(authID);
CREATE INDEX idx_otp_userid ON tbl_OTP(userID);
CREATE INDEX idx_otp_timeout ON tbl_OTP(timeout);

-- Enable Row Level Security
ALTER TABLE tbl_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tbl_OTP ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tbl_users
CREATE POLICY "Users can view own record" ON tbl_users
    FOR SELECT USING (auth.uid() = authID);

CREATE POLICY "Users can update own record" ON tbl_users
    FOR UPDATE USING (auth.uid() = authID);

CREATE POLICY "System can insert users" ON tbl_users
    FOR INSERT WITH CHECK (true);

-- Create RLS policies for tbl_OTP
CREATE POLICY "Users can view own OTPs" ON tbl_OTP
    FOR SELECT USING (auth.uid() = authID);

CREATE POLICY "System can insert OTPs" ON tbl_OTP
    FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update OTPs" ON tbl_OTP
    FOR UPDATE USING (true);

CREATE POLICY "System can delete OTPs" ON tbl_OTP
    FOR DELETE USING (true);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON tbl_users TO anon, authenticated;
GRANT ALL ON tbl_OTP TO anon, authenticated;
