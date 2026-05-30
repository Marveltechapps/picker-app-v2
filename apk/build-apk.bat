@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: Generic APK Build Script for React Native Expo Projects (Windows)
:: ============================================================================
::
:: HOW TO RUN (required - path / working directory):
::   1. Open terminal and go to frontend folder (parent of apk):
::        cd path\to\picker-app-v1-master\frontend
::   2. Go into apk folder:
::        cd apk
::   3. Run the script:
::        .\build-apk.bat
::
:: Usage: build-apk.bat [OPTIONS]
:: Options:
::   --help, -h              Show this help message
::   --cloud                 Use EAS Build cloud (requires 'eas init')
::   --local                 Local build (default, requires Android Studio)
::   --variant TYPE          Build variant: debug, release, staging (default: release)
::   --flavor NAME           Build flavor name (for multi-flavor projects)
::   --format TYPE           Output format: apk or aab (default: apk)
::   --profile NAME          Build profile: production, development, staging (default: production)
::   --interactive, -i       Enable interactive mode (prompts for confirmations)
::   --verbose, -v           Verbose output (detailed logs)
::   --quiet, -q             Quiet mode (minimal output)
::   --json                  JSON output mode (for CI/automation)
::   --no-cache              Disable build caching
::   --force-rebuild         Force Android project regeneration
:: ============================================================================

:: Script directory (apk folder); project root is parent (uses script location, not CD)
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
for %%I in ("%SCRIPT_DIR%\..") do set "PROJECT_DIR=%%~fI"
set "APK_FOLDER=%SCRIPT_DIR%"
set "PROJECT_DIR_FWD=%PROJECT_DIR:\=/%"

:: Ensure we can see project root (app.json must exist there)
if not exist "%PROJECT_DIR%\app.json" (
  echo [91mERR Frontend project not found or wrong path.[0m
  echo [93mRun from frontend folder, then:[0m
  echo   cd path\to\picker-app-v1-master\frontend
  echo   cd apk
  echo   .\build-apk.bat
  exit /b 1
)

:: Global configuration
set "BUILD_MODE=local"
set "BUILD_VARIANT=release"
set "BUILD_FLAVOR="
set "OUTPUT_FORMAT=apk"
set "BUILD_PROFILE=production"
set "INTERACTIVE_MODE=0"
set "VERBOSE_MODE=0"
set "QUIET_MODE=0"
set "JSON_MODE=0"
set "ENABLE_CACHE=1"
set "SKIP_PREBUILD_IF_EXISTS=1"

:: Start time (PowerShell)
for /f %%a in ('powershell -NoProfile -Command "[int][double]::Parse((Get-Date -UFormat %%s))"') do set "START_TIME=%%a"

:: Parse arguments
:parse_loop
if "%~1"=="" goto parse_done
if /i "%~1"=="--help" goto show_help
if /i "%~1"=="-h" goto show_help
if /i "%~1"=="--cloud" ( set "BUILD_MODE=cloud" & shift & goto parse_loop )
if /i "%~1"=="--local" ( set "BUILD_MODE=local" & shift & goto parse_loop )
if /i "%~1"=="--variant" ( set "BUILD_VARIANT=%~2" & shift & shift & goto parse_loop )
if /i "%~1"=="--flavor" ( set "BUILD_FLAVOR=%~2" & shift & shift & goto parse_loop )
if /i "%~1"=="--format" (
  set "OUTPUT_FORMAT=%~2"
  if /i not "!OUTPUT_FORMAT!"=="apk" if /i not "!OUTPUT_FORMAT!"=="aab" (
    call :output error "Invalid format: !OUTPUT_FORMAT!. Must be apk or aab"
    exit /b 1
  )
  shift & shift & goto parse_loop
)
if /i "%~1"=="--profile" ( set "BUILD_PROFILE=%~2" & shift & shift & goto parse_loop )
if /i "%~1"=="--interactive" ( set "INTERACTIVE_MODE=1" & shift & goto parse_loop )
if /i "%~1"=="-i" ( set "INTERACTIVE_MODE=1" & shift & goto parse_loop )
if /i "%~1"=="--verbose" ( set "VERBOSE_MODE=1" & shift & goto parse_loop )
if /i "%~1"=="-v" ( set "VERBOSE_MODE=1" & shift & goto parse_loop )
if /i "%~1"=="--quiet" ( set "QUIET_MODE=1" & set "VERBOSE_MODE=0" & shift & goto parse_loop )
if /i "%~1"=="-q" ( set "QUIET_MODE=1" & set "VERBOSE_MODE=0" & shift & goto parse_loop )
if /i "%~1"=="--json" ( set "JSON_MODE=1" & set "QUIET_MODE=0" & set "VERBOSE_MODE=0" & shift & goto parse_loop )
if /i "%~1"=="--no-cache" ( set "ENABLE_CACHE=0" & shift & goto parse_loop )
if /i "%~1"=="--force-rebuild" ( set "SKIP_PREBUILD_IF_EXISTS=0" & shift & goto parse_loop )
call :output error "Unknown option: %~1"
call :output info "Use --help for usage information"
exit /b 1
:parse_done

:: Show banner and load profile
if "%JSON_MODE%"=="0" (
  echo.
  echo [92mStarting APK build process for React Native Expo project...[0m
  echo [96mProject directory: %PROJECT_DIR%[0m
  echo [96mBuild mode: %BUILD_MODE%[0m
  echo [96mBuild variant: %BUILD_VARIANT%[0m
  if defined BUILD_FLAVOR echo [96mBuild flavor: %BUILD_FLAVOR%[0m
  echo [96mOutput format: %OUTPUT_FORMAT%[0m
  echo [96mBuild profile: %BUILD_PROFILE%[0m
  echo.
)

:: Load build profile from build-config.json if present
if exist "%PROJECT_DIR%\build-config.json" (
  for /f "delims=" %%v in ('node -e "try{const c=require('%PROJECT_DIR_FWD%/build-config.json');const p=c.profiles&&c.profiles['%BUILD_PROFILE%']||{};if(p.variant)console.log('V:'+p.variant);if(p.flavor)console.log('F:'+p.flavor);if(p.format)console.log('O:'+p.format);}catch(e){}" 2^>nul') do (
    set "line=%%v"
    if "!line:~0,2!"=="V:" set "BUILD_VARIANT=!line:~2!"
    if "!line:~0,2!"=="F:" set "BUILD_FLAVOR=!line:~2!"
    if "!line:~0,2!"=="O:" set "OUTPUT_FORMAT=!line:~2!"
  )
)

if not exist "%APK_FOLDER%" mkdir "%APK_FOLDER%"

:: Pre-flight checks
call :preflight_checks
if errorlevel 1 exit /b 1

:: Check Node
call :check_node_runtime
if errorlevel 1 exit /b 1

:: Install dependencies
call :install_dependencies
if errorlevel 1 (
  call :output warning "Dependency installation had issues, but continuing..."
  if not exist "%PROJECT_DIR%\node_modules" (
    call :output error "node_modules is missing. Cannot proceed."
    exit /b 1
  )
)

call :check_expo_cli
if "%BUILD_MODE%"=="cloud" call :check_eas_cli
if "%BUILD_MODE%"=="local" call :check_java

:: Build
if "%BUILD_MODE%"=="local" (
  call :do_local_build
  if errorlevel 1 exit /b 1
) else (
  call :do_cloud_build
  if errorlevel 1 exit /b 1
  goto summary_skip_copy
)

:: Find build output
set "BUILD_OUTPUT_PATH="
call :find_build_output "%OUTPUT_FORMAT%" "%BUILD_VARIANT%" "%BUILD_FLAVOR%"
if not defined BUILD_OUTPUT_PATH (
  timeout /t 3 /nobreak >nul
  call :find_build_output "%OUTPUT_FORMAT%" "%BUILD_VARIANT%" "%BUILD_FLAVOR%"
)
if not defined BUILD_OUTPUT_PATH (
  call :output error "Build output not found. Build may have failed."
  exit /b 1
)

:: App name and version from app.json
for /f "delims=" %%a in ('node -e "try{console.log(require('%PROJECT_DIR_FWD%/app.json').expo.name||'app');}catch(e){console.log('app');}" 2^>nul') do set "APP_NAME=%%a"
for /f "delims=" %%a in ('node -e "try{console.log(require('%PROJECT_DIR_FWD%/app.json').expo.version||'1.0.0');}catch(e){console.log('1.0.0');}" 2^>nul') do set "APP_VERSION=%%a"
for /f "delims=" %%a in ('node -e "var n=process.argv[1]||'app';console.log(n.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-'));" "%APP_NAME%" 2^>nul') do set "CLEAN_APP_NAME=%%a"
if not defined CLEAN_APP_NAME set "CLEAN_APP_NAME=app"

:: Timestamp and output filename (PowerShell for consistent format)
for /f "delims=" %%a in ('powershell -NoProfile -Command "Get-Date -Format 'yyyyMMdd-HHmmss'"') do set "TIMESTAMP=%%a"
if not defined TIMESTAMP set "TIMESTAMP=00000000-000000"
set "OUTPUT_FILENAME=%CLEAN_APP_NAME%-v%APP_VERSION%-%BUILD_VARIANT%-%TIMESTAMP%.%OUTPUT_FORMAT%"
set "OUTPUT_DESTINATION=%APK_FOLDER%\%OUTPUT_FILENAME%"

:: Copy to apk folder
call :output progress "Copying build output..."
copy /y "%BUILD_OUTPUT_PATH%" "%OUTPUT_DESTINATION%" >nul
copy /y "%BUILD_OUTPUT_PATH%" "%APK_FOLDER%\latest.%OUTPUT_FORMAT%" >nul

:summary_skip_copy
:: Total build time
for /f %%a in ('powershell -NoProfile -Command "[int][double]::Parse((Get-Date -UFormat %%s))"') do set "END_TIME=%%a"
set /a "TOTAL_DURATION=%END_TIME%-%START_TIME%" 2>nul
set /a "MINUTES=TOTAL_DURATION/60" 2>nul
set /a "SECONDS=TOTAL_DURATION%%60" 2>nul

if "%BUILD_MODE%"=="cloud" (
  call :output success "Build submitted to EAS. Check your email or EAS dashboard."
  endlocal
  exit /b 0
)

:: File size (PowerShell)
for /f "delims=" %%a in ('powershell -NoProfile -Command "(Get-Item '%OUTPUT_DESTINATION%').Length / 1MB" 2^>nul') do set "OUTPUT_SIZE_MB=%%a"
set "OUTPUT_SIZE=!OUTPUT_SIZE_MB! MB"

if "%JSON_MODE%"=="0" (
  echo.
  call :output success "Build completed successfully!"
  call :output info "Latest: %APK_FOLDER%\latest.%OUTPUT_FORMAT%"
  call :output info "Size: %OUTPUT_SIZE%"
  call :output info "Timestamped: %OUTPUT_FILENAME%"
  call :output info "Total build time: %MINUTES%m %SECONDS%s"
  echo.
) else (
  echo {"success":true,"output":{"path":"%OUTPUT_DESTINATION%","format":"%OUTPUT_FORMAT%","variant":"%BUILD_VARIANT%"},"timing":{"total_seconds":%TOTAL_DURATION%}}
)
exit /b 0

:: ----------------------------------------------------------------------------
:show_help
echo.
echo ============================================================================
echo                     APK Build Script for React Native Expo ^(Windows^)
echo ============================================================================
echo.
echo HOW TO RUN:
echo   1. cd to frontend:      cd path\to\picker-app-v1-master\frontend
echo   2. cd apk:              cd apk
echo   3. Run:                 .\build-apk.bat
echo.
echo USAGE: build-apk.bat [OPTIONS]
echo.
echo BUILD MODES:
echo   --cloud                 Use EAS Build cloud ^(requires 'eas init'^)
echo   --local                 Local build ^(default, requires Android Studio^)
echo.
echo BUILD OPTIONS:
echo   --variant TYPE          Build variant: debug, release, staging ^(default: release^)
echo   --flavor NAME           Build flavor name
echo   --format TYPE           Output format: apk or aab ^(default: apk^)
echo   --profile NAME          Build profile: production, development, staging
echo.
echo OUTPUT: --verbose -v ^| --quiet -q ^| --json ^| --interactive -i
echo OTHER:  --no-cache ^| --force-rebuild ^| --help -h
echo.
echo REQUIREMENTS: Node.js, Android Studio ^(local^), Java 11+ ^(local^)
echo ============================================================================
exit /b 0

:: ----------------------------------------------------------------------------
:output
set "OUT_LEVEL=%~1"
set "OUT_MSG=%~2"
if "%JSON_MODE%"=="1" (
  for /f "delims=" %%t in ('powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'"') do echo {"timestamp":"%%t","level":"%OUT_LEVEL%","message":"%OUT_MSG%"}
  goto :eof
)
if "%QUIET_MODE%"=="1" if not "%OUT_LEVEL%"=="error" if not "%OUT_LEVEL%"=="success" goto :eof
if "%OUT_LEVEL%"=="info" if "%VERBOSE_MODE%"=="0" goto :eof
if "%OUT_LEVEL%"=="success" ( echo [92m OK %OUT_MSG%[0m & goto :eof )
if "%OUT_LEVEL%"=="warning" ( echo [93m WARN %OUT_MSG%[0m & goto :eof )
if "%OUT_LEVEL%"=="error" ( echo [91m ERR %OUT_MSG%[0m >&2 & goto :eof )
if "%OUT_LEVEL%"=="progress" ( echo [96m ^>^> %OUT_MSG% [0m & goto :eof )
echo %OUT_MSG%
goto :eof

:: ----------------------------------------------------------------------------
:preflight_checks
call :output progress "Running pre-flight checks..."
if not exist "%PROJECT_DIR%\app.json" (
  call :output error "app.json not found in project root"
  exit /b 1
)
:: Validate app.json via script (argv[2]=path; avoids CWD/quoting issues)
node "%SCRIPT_DIR%\preflight-app-json.js" "%PROJECT_DIR%\app.json" 2>nul
set "PREFLIGHT_EXIT=!errorlevel!"
if !PREFLIGHT_EXIT! equ 2 (
  call :output error "app.json missing 'expo' field"
  exit /b 1
)
if !PREFLIGHT_EXIT! neq 0 (
  call :output error "app.json is not valid JSON"
  exit /b 1
)
if not exist "%PROJECT_DIR%\package.json" (
  call :output error "package.json not found"
  exit /b 1
)
if "%BUILD_MODE%"=="local" (
  if not defined ANDROID_HOME (
    if exist "%USERPROFILE%\AppData\Local\Android\Sdk" set "ANDROID_HOME=%USERPROFILE%\AppData\Local\Android\Sdk"
    if not exist "!ANDROID_HOME!" if exist "%USERPROFILE%\Android\Sdk" set "ANDROID_HOME=%USERPROFILE%\Android\Sdk"
    if not defined ANDROID_HOME (
      call :output warning "Android SDK not found. Set ANDROID_HOME or install Android Studio."
    )
  )
)
call :output success "Pre-flight checks passed"
exit /b 0

:: ----------------------------------------------------------------------------
:check_node_runtime
where node >nul 2>&1
if errorlevel 1 (
  call :output error "Node.js not found. Install from https://nodejs.org/"
  exit /b 1
)
for /f "delims=" %%v in ('node -v 2^>nul') do call :output success "Node.js found: %%v"
exit /b 0

:: ----------------------------------------------------------------------------
:install_dependencies
call :output progress "Checking project dependencies..."
if exist "%PROJECT_DIR%\node_modules" (
  node -e "const fs=require('fs');const p='%PROJECT_DIR_FWD%/node_modules/expo';if(fs.existsSync(p))process.exit(0);process.exit(1);" 2>nul
  if not errorlevel 1 (
    call :output info "Dependencies appear up to date"
    exit /b 0
  )
)
call :output progress "Installing project dependencies..."
pushd "%PROJECT_DIR%"
call npm install --legacy-peer-deps 2>nul
if errorlevel 1 call npm install 2>nul
if errorlevel 1 (
  call :output error "npm install failed"
  popd
  exit /b 1
)
call :output success "Dependencies installed"
popd
exit /b 0

:: ----------------------------------------------------------------------------
:check_expo_cli
where expo >nul 2>&1
if not errorlevel 1 (
  call :output info "Expo CLI found"
  exit /b 0
)
call :output info "Expo CLI will be used via npx"
exit /b 0

:: ----------------------------------------------------------------------------
:check_eas_cli
where eas >nul 2>&1
if not errorlevel 1 (
  call :output info "EAS CLI found"
  exit /b 0
)
call :output info "EAS CLI will be used via npx"
exit /b 0

:: ----------------------------------------------------------------------------
:check_java
where java >nul 2>&1
if errorlevel 1 (
  call :output warning "Java not found in PATH. Android Studio includes Java."
  exit /b 0
)
call :output info "Java found"
exit /b 0

:: ----------------------------------------------------------------------------
:setup_android_sdk
if defined ANDROID_HOME if exist "%ANDROID_HOME%" exit /b 0
if exist "%USERPROFILE%\AppData\Local\Android\Sdk" (
  set "ANDROID_HOME=%USERPROFILE%\AppData\Local\Android\Sdk"
  exit /b 0
)
if exist "%USERPROFILE%\Android\Sdk" (
  set "ANDROID_HOME=%USERPROFILE%\Android\Sdk"
  exit /b 0
)
exit /b 1

:: ----------------------------------------------------------------------------
:clean_ninja_caches
call :output progress "Cleaning Ninja/CMake caches .cxx..."
if exist "%PROJECT_DIR%\android\.cxx" (
  rmdir /s /q "%PROJECT_DIR%\android\.cxx" 2>nul
)
for %%p in (
  react-native-worklets-core
  react-native-worklets
  react-native-vision-camera
  react-native-reanimated
  expo-modules-core
  react-native-screens
  react-native-gesture-handler
) do (
  if exist "%PROJECT_DIR%\node_modules\%%p\android\.cxx" (
    rmdir /s /q "%PROJECT_DIR%\node_modules\%%p\android\.cxx" 2>nul
  )
)
if exist "%PROJECT_DIR%\android\gradlew.bat" (
  pushd "%PROJECT_DIR%\android"
  call gradlew.bat --stop 2>nul
  popd
)
exit /b 0

:: ----------------------------------------------------------------------------
:setup_local_properties
if not exist "%PROJECT_DIR%\android" exit /b 0
if not defined ANDROID_HOME exit /b 0
set "ANDROID_HOME_FWD=%ANDROID_HOME:\=/%"
echo sdk.dir=%ANDROID_HOME_FWD%> "%PROJECT_DIR%\android\local.properties"
exit /b 0

:: ----------------------------------------------------------------------------
:needs_prebuild
if not exist "%PROJECT_DIR%\android" exit /b 0
if "%SKIP_PREBUILD_IF_EXISTS%"=="0" exit /b 0
exit /b 1

:: ----------------------------------------------------------------------------
:do_local_build
call :output progress "Using local build..."
call :setup_android_sdk
if errorlevel 1 (
  call :output error "Android SDK not found. Install Android Studio or set ANDROID_HOME."
  exit /b 1
)

call :needs_prebuild
if not errorlevel 1 (
  call :output progress "Generating native Android project..."
  pushd "%PROJECT_DIR%"
  if exist "%PROJECT_DIR%\android" (
    call npx expo prebuild --platform android --clean
  ) else (
    call npx expo prebuild --platform android
  )
  if errorlevel 1 (
    call :output error "expo prebuild failed"
    popd
    exit /b 1
  )
  popd
) else (
  call :output info "Android project exists, skipping prebuild"
)

call :setup_local_properties

:: Clean Ninja/CMake caches to avoid "manifest build.ninja still dirty after 100 tries" on Windows
call :clean_ninja_caches

call :output progress "Checking dependency compatibility..."
pushd "%PROJECT_DIR%"
call npx expo install --check 2>nul
if errorlevel 1 (
  call npx expo install --fix 2>nul
  call npm install --legacy-peer-deps 2>nul
)
popd

call :output progress "Building %OUTPUT_FORMAT% with Gradle..."
if not exist "%PROJECT_DIR%\android\gradlew.bat" (
  call :output error "Gradle wrapper not found. Run expo prebuild first."
  exit /b 1
)

pushd "%PROJECT_DIR%\android"
call :setup_local_properties
if defined ANDROID_HOME set "ANDROID_HOME=%ANDROID_HOME%"

:: Gradle task: assembleRelease / assembleDebug or bundleRelease / bundleDebug (camelCase)
if /i "%BUILD_VARIANT%"=="release" set "GRADLE_VARIANT=Release"
if /i "%BUILD_VARIANT%"=="debug" set "GRADLE_VARIANT=Debug"
if /i "%BUILD_VARIANT%"=="staging" set "GRADLE_VARIANT=Staging"
if not defined GRADLE_VARIANT set "GRADLE_VARIANT=Release"
set "GRADLE_TASK=assemble%GRADLE_VARIANT%"
if /i "%OUTPUT_FORMAT%"=="aab" set "GRADLE_TASK=bundle%GRADLE_VARIANT%"

:: Single ABI (arm64-v8a) avoids Ninja "manifest still dirty" on Windows; skip clean when using it (clean expects all ABIs)
set "GRADLE_EXTRA=-PreactNativeArchitectures=arm64-v8a"
if "%GRADLE_EXTRA%"=="" call gradlew.bat clean 2>nul
call gradlew.bat %GRADLE_TASK% --no-daemon --no-parallel %GRADLE_EXTRA%
set "GRADLE_EXIT=!errorlevel!"
popd

if not !GRADLE_EXIT!==0 (
  call :output error "Gradle build failed"
  exit /b 1
)
call :output success "Build completed successfully"
exit /b 0

:: ----------------------------------------------------------------------------
:do_cloud_build
if not exist "%PROJECT_DIR%\.eas\project.json" (
  findstr /c:"extra.eas.projectId" "%PROJECT_DIR%\app.json" >nul 2>&1
  if errorlevel 1 (
    call :output error "EAS project not configured. Run 'eas init' first."
    exit /b 1
  )
)
if not exist "%PROJECT_DIR%\eas.json" (
  call :output error "eas.json not found"
  exit /b 1
)
call :output progress "Using EAS Build (cloud)..."
pushd "%PROJECT_DIR%"
call npx eas-cli build --platform android --profile %BUILD_PROFILE% --non-interactive
set "EAS_EXIT=!errorlevel!"
popd
if not !EAS_EXIT!==0 exit /b 1
exit /b 0

:: ----------------------------------------------------------------------------
:find_build_output
set "EXT=%~1"
set "VAR=%~2"
set "BUILD_OUTPUT_PATH="
set "OUT_DIR=%PROJECT_DIR%\android\app\build\outputs"
if "%EXT%"=="apk" (
  if exist "%OUT_DIR%\apk\%VAR%" (
    for /f "delims=" %%f in ('dir /b /s "%OUT_DIR%\apk\%VAR%\*.apk" 2^>nul') do ( set "BUILD_OUTPUT_PATH=%%f" & goto :eof )
  )
  for /f "delims=" %%f in ('dir /b /s "%OUT_DIR%\*.apk" 2^>nul') do ( set "BUILD_OUTPUT_PATH=%%f" & goto :eof )
)
if "%EXT%"=="aab" (
  for /f "delims=" %%f in ('dir /b /s "%OUT_DIR%\bundle\*.aab" 2^>nul') do ( set "BUILD_OUTPUT_PATH=%%f" & goto :eof )
)
goto :eof
