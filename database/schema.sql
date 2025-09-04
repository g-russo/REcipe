-- Database Schema for REcipe App
-- Execute these SQL commands in your Supabase SQL Editor

-- Create tbl_users table
CREATE TABLE IF NOT EXISTS tbl_users (
    userID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authID UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    userName VARCHAR(50) NOT NULL,
    userEmail VARCHAR(255) UNIQUE NOT NULL,
    userPassword VARCHAR(255) NOT NULL, -- Will store hashed password
    userBday DATE NOT NULL,
    isVerified BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tbl_OTP table
CREATE TABLE IF NOT EXISTS tbl_OTP (
    otpID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authID UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    userID UUID REFERENCES tbl_users(userID) ON DELETE CASCADE,
    otpCode VARCHAR(6) NOT NULL,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    timeout TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
    purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('signup', 'forgot_password')),
    isUsed BOOLEAN DEFAULT FALSE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON tbl_users(userEmail);
CREATE INDEX IF NOT EXISTS idx_users_authid ON tbl_users(authID);
CREATE INDEX IF NOT EXISTS idx_otp_code ON tbl_OTP(otpCode);
CREATE INDEX IF NOT EXISTS idx_otp_authid ON tbl_OTP(authID);
CREATE INDEX IF NOT EXISTS idx_otp_userid ON tbl_OTP(userID);
CREATE INDEX IF NOT EXISTS idx_otp_timeout ON tbl_OTP(timeout);

-- Create function to automatically update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedAt = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updatedAt for tbl_users
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON tbl_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to clean up expired OTPs
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
    DELETE FROM tbl_OTP 
    WHERE timeout < NOW() OR isUsed = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate 6-digit OTP
CREATE OR REPLACE FUNCTION generate_otp()
RETURNS VARCHAR(6) AS $$
BEGIN
    RETURN LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (RLS)
ALTER TABLE tbl_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tbl_OTP ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tbl_users
CREATE POLICY "Users can view own record" ON tbl_users
    FOR SELECT USING (auth.uid() = authID);

CREATE POLICY "Users can update own record" ON tbl_users
    FOR UPDATE USING (auth.uid() = authID);

-- Create RLS policies for tbl_OTP
CREATE POLICY "Users can view own OTPs" ON tbl_OTP
    FOR SELECT USING (auth.uid() = authID);

CREATE POLICY "System can insert OTPs" ON tbl_OTP
    FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update OTPs" ON tbl_OTP
    FOR UPDATE USING (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON tbl_users TO anon, authenticated;
GRANT ALL ON tbl_OTP TO anon, authenticated;
