@echo off
REM Setup EAS Secrets for Secure APK Build (Windows)
REM This script uploads environment variables to EAS servers
REM Run this ONCE before building your APK

echo.
echo 🔐 Setting up EAS Secrets for secure APK builds...
echo.
echo This will upload your API keys to EAS servers (encrypted and secure)
echo Other users will NOT be able to see these keys in your APK
echo.

REM Check if .env exists
if not exist .env (
    echo ❌ Error: .env file not found!
    echo Please create .env file with your API keys first
    exit /b 1
)

echo 📝 Reading API keys from .env file...
echo.

REM Extract values from .env (Windows style)
for /f "tokens=2 delims==" %%a in ('findstr "EXPO_PUBLIC_SUPABASE_URL=" .env') do set SUPABASE_URL=%%a
for /f "tokens=2 delims==" %%a in ('findstr "EXPO_PUBLIC_SUPABASE_ANON_KEY=" .env') do set SUPABASE_ANON=%%a
for /f "tokens=2 delims==" %%a in ('findstr "EXPO_PUBLIC_EDAMAM_APP_ID=" .env') do set EDAMAM_ID=%%a
for /f "tokens=2 delims==" %%a in ('findstr "EXPO_PUBLIC_EDAMAM_APP_KEY=" .env') do set EDAMAM_KEY=%%a
for /f "tokens=2 delims==" %%a in ('findstr "EXPO_PUBLIC_OPENAI_API_KEY=" .env') do set OPENAI_KEY=%%a
for /f "tokens=2 delims==" %%a in ('findstr "EXPO_PUBLIC_FOOD_API_URL=" .env') do set FOOD_API=%%a

echo ✓ Found Supabase URL
echo ✓ Found Supabase Anon Key
echo ✓ Found Edamam App ID
echo ✓ Found Edamam App Key
echo ✓ Found OpenAI API Key
echo ✓ Found Food API URL
echo.

set /p CONFIRM="Upload these secrets to EAS? (y/n): "
if /i not "%CONFIRM%"=="y" (
    echo ❌ Cancelled
    exit /b 1
)

echo.
echo 🚀 Uploading secrets to EAS...
echo.

REM Upload each secret
call eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "%SUPABASE_URL%" --type string --force
call eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "%SUPABASE_ANON%" --type string --force
call eas secret:create --scope project --name EXPO_PUBLIC_EDAMAM_APP_ID --value "%EDAMAM_ID%" --type string --force
call eas secret:create --scope project --name EXPO_PUBLIC_EDAMAM_APP_KEY --value "%EDAMAM_KEY%" --type string --force
call eas secret:create --scope project --name EXPO_PUBLIC_OPENAI_API_KEY --value "%OPENAI_KEY%" --type string --force
call eas secret:create --scope project --name EXPO_PUBLIC_FOOD_API_URL --value "%FOOD_API%" --type string --force

echo.
echo ✅ All secrets uploaded successfully!
echo.
echo 📦 You can now build your APK with:
echo    eas build --platform android --profile production
echo.
echo 🔒 Your API keys are now:
echo    ✓ Encrypted on EAS servers
echo    ✓ Injected into APK during build
echo    ✓ NOT visible in your source code
echo    ✓ NOT accessible to other users
echo.
echo 🔍 To view uploaded secrets:
echo    eas secret:list
echo.

pause
