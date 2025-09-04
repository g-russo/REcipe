# Quick Database Setup for REcipe App

## 🚨 **IMPORTANT: You need to set up your database tables first!**

The sign-up errors you encountered happen because the custom database tables (`tbl_users` and `tbl_OTP`) don't exist yet in your Supabase project.

## 🔧 **Quick Fix (5 minutes):**

### Step 1: Open Supabase Dashboard

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your REcipe project
3. Go to **SQL Editor** (left sidebar)

### Step 2: Run the Database Schema

1. Copy the entire contents of `database/schema.sql`
2. Paste it into the SQL Editor
3. Click **Run** button

### Step 3: Verify Tables Created

Go to **Table Editor** and verify you see:

- `tbl_users` table
- `tbl_OTP` table

### Step 4: Restart Your App

```bash
npx expo start
```

## ✅ **What This Fixes:**

- **ERROR creating custom user** → Tables will exist
- **ERROR generating OTP** → OTP table will be available
- **User not found** → User data will be stored properly

## 🔄 **Current App Behavior:**

Right now your app works with **Supabase Auth only**:

- ✅ Sign-up creates Supabase auth user
- ✅ OTP email is sent by Supabase
- ✅ OTP verification works with Supabase
- ❌ Custom user data not stored in your tables
- ❌ Custom OTP tracking not available

## 📧 **Email Templates:**

Your email templates are ready! After setting up tables:

1. Go to **Authentication → Settings** in Supabase
2. Update **Email Templates** with your HTML files
3. Use `otp-verification.html` for signup emails

## 🧪 **Test After Setup:**

1. **Sign Up** → Should create user in both Supabase auth AND `tbl_users`
2. **OTP Verification** → Should work with your custom templates
3. **Forgot Password** → Should use your custom OTP system
4. **Home Screen** → Should show green "Database Ready" status

---

**💡 The app will work for basic auth without tables, but you need them for the full feature set!**
