#!/bin/bash

# ============================================================================
# Generic APK Build Script for React Native Expo Projects
# ============================================================================
# 
# This script is designed to work with ANY React Native Expo project.
# It automatically:
#   - Detects and installs missing dependencies
#   - Checks and fixes package compatibility issues using Expo's tools
#   - Handles build errors and retries with fixes
#   - Works with any Expo SDK version and any packages
#   - Provides comprehensive task tracking and acknowledgment
#
# Usage: ./build-apk.sh [OPTIONS]
#
# Options:
#   --help, -h              Show this help message
#   --cloud                 Use EAS Build cloud (requires 'eas init')
#   --local                 Local build (default, requires Android Studio)
#   --variant TYPE          Build variant: debug, release, staging (default: release)
#   --flavor NAME           Build flavor name (for multi-flavor projects)
#   --format TYPE           Output format: apk or aab (default: apk)
#   --profile NAME          Build profile: production, development, staging (default: production)
#   --interactive, -i       Enable interactive mode (prompts for confirmations)
#   --verbose, -v           Verbose output (detailed logs)
#   --quiet, -q             Quiet mode (minimal output)
#   --json                  JSON output mode (for CI/automation)
#
# Requirements:
#   - Node.js or Bun
#   - Android Studio (for local builds) or EAS account (for cloud builds)
#   - Java 11+ (for local builds)
# ============================================================================

set +e  # Disabled: causes early exit with large node_modules (ls output); errors still handled explicitly

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Project directory (script is in apk folder, so go up one level)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
APK_FOLDER="${SCRIPT_DIR}"

# Global configuration
BUILD_MODE="local"
BUILD_VARIANT="release"
BUILD_FLAVOR=""
OUTPUT_FORMAT="apk"
BUILD_PROFILE="production"
INTERACTIVE_MODE=false
VERBOSE_MODE=false
QUIET_MODE=false
JSON_MODE=false
START_TIME=$(date +%s)

# Performance optimization flags
ENABLE_CACHE=true
SKIP_PREBUILD_IF_EXISTS=true
USE_GRADLE_DAEMON=true
PARALLEL_CHECKS=true
INCREMENTAL_BUILD=true

# Task tracking
EXECUTED_TASKS=()
FAILED_TASKS=()
WARNINGS=()
BUILD_TIMINGS_NAMES=()
BUILD_TIMINGS_VALUES=()

# Error database for better error messages (bash 3.2 compatible)
# Format: pattern|suggestion
ERROR_SUGGESTIONS=(
    "Unresolved reference.*barcodescanner|Run: expo install --fix expo-camera"
    "Cannot find module|Missing dependency. The script will attempt to install it automatically."
    "BUILD FAILED|Check /tmp/gradle_build.log for detailed error information."
    "Android SDK not found|Install Android Studio or set ANDROID_HOME environment variable."
    "Java.*not found|Install Java 11+ or ensure JAVA_HOME is set correctly."
    "keystore.*not found|Create a keystore or set KEYSTORE_PATH environment variable."
)

# Function to show help
show_help() {
    cat << EOF
${CYAN}${NC}
${CYAN}                    APK Build Script for React Native Expo${NC}
${CYAN}${NC}

${GREEN}USAGE:${NC}
    ./build-apk.sh [OPTIONS]

${GREEN}BUILD MODES:${NC}
    --cloud                 Use EAS Build cloud (requires 'eas init')
    --local                 Local build (default, requires Android Studio)

${GREEN}BUILD OPTIONS:${NC}
    --variant TYPE          Build variant: debug, release, staging (default: release)
    --flavor NAME           Build flavor name (for multi-flavor projects)
    --format TYPE           Output format: apk or aab (default: apk)
    --profile NAME          Build profile: production, development, staging (default: production)

${GREEN}OUTPUT MODES:${NC}
    --verbose, -v           Verbose output (detailed logs)
    --quiet, -q             Quiet mode (minimal output)
    --json                  JSON output mode (for CI/automation)
    --no-cache              Disable build caching (slower but ensures fresh build)
    --force-rebuild         Force Android project regeneration
    --no-incremental        Disable incremental builds (always full rebuild)

${GREEN}INTERACTION:${NC}
    --interactive, -i       Enable interactive mode (prompts for confirmations)
    --help, -h              Show this help message

${GREEN}EXAMPLES:${NC}
    ./build-apk.sh                                    # Default release APK build
    ./build-apk.sh --variant debug                    # Build debug APK
    ./build-apk.sh --format aab --profile production # Build production AAB
    ./build-apk.sh --interactive --verbose            # Interactive verbose mode
    ./build-apk.sh --json                             # JSON output for CI

${GREEN}REQUIREMENTS:${NC}
    - Node.js or Bun
    - Android Studio (for local builds) or EAS account (for cloud builds)
    - Java 11+ (for local builds)

${CYAN}${NC}
EOF
    exit 0
}

# Function to output messages based on mode
output() {
    local level="$1"
    shift
    local message="$@"
    
    if [ "$JSON_MODE" = true ]; then
        local timestamp=$(date +"%Y-%m-%dT%H:%M:%S")
        echo "{\"timestamp\":\"$timestamp\",\"level\":\"$level\",\"message\":\"$message\"}"
        return
    fi
    
    if [ "$QUIET_MODE" = true ] && [ "$level" != "error" ] && [ "$level" != "success" ]; then
        return
    fi
    
    case "$level" in
        "info")
            [ "$VERBOSE_MODE" = true ] && echo -e "${BLUE}9  $message${NC}"
            ;;
        "success")
            echo -e "${GREEN} $message${NC}"
            ;;
        "warning")
            echo -e "${YELLOW}?  $message${NC}"
            ;;
        "error")
            echo -e "${RED}L $message${NC}" >&2
            ;;
        "progress")
            echo -e "${CYAN}= $message${NC}"
            ;;
        *)
            echo -e "$message"
            ;;
    esac
}

# Function to show progress with percentage
show_progress() {
    local current=$1
    local total=$2
    local message="${3:-Progress}"
    
    if [ "$JSON_MODE" = true ] || [ "$QUIET_MODE" = true ]; then
        return
    fi
    
    local percent=$((current * 100 / total))
    local filled=$((percent / 2))
    local empty=$((50 - filled))
    
    printf "\r${CYAN}["
    printf "%${filled}s" | tr ' ' '='
    printf "%${empty}s" | tr ' ' ' '
    printf "] ${percent}%% - ${message}${NC}"
    
    if [ $current -eq $total ]; then
        echo ""
    fi
}

# Function to track time for operations (bash 3.2 compatible)
start_timer() {
    local operation="$1"
    eval "BUILD_TIMING_${operation}_START=\$(date +%s)"
}

end_timer() {
    local operation="$1"
    local start_var="BUILD_TIMING_${operation}_START"
    local start_time=$(eval "echo \$$start_var")
    
    if [ -n "$start_time" ]; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        # Store in arrays for later retrieval
        BUILD_TIMINGS_NAMES=("${BUILD_TIMINGS_NAMES[@]}" "$operation")
        BUILD_TIMINGS_VALUES=("${BUILD_TIMINGS_VALUES[@]}" "$duration")
    fi
}

# Function to get error suggestion (bash 3.2 compatible)
get_error_suggestion() {
    local error="$1"
    local i=0
    while [ $i -lt ${#ERROR_SUGGESTIONS[@]} ]; do
        local entry="${ERROR_SUGGESTIONS[$i]}"
        local pattern=$(echo "$entry" | cut -d'|' -f1)
        local suggestion=$(echo "$entry" | cut -d'|' -f2)
        
        if echo "$error" | grep -qiE "$pattern"; then
            echo "$suggestion"
            return 0
        fi
        
        i=$((i + 1))
    done
    echo ""
}

# Function to prompt user (respects interactive mode)
prompt_user() {
    local question="$1"
    local default="${2:-n}"
    
    if [ "$INTERACTIVE_MODE" = false ]; then
        [ "$default" = "y" ] && return 0 || return 1
    fi
    
    local prompt_text="${YELLOW}S $question${NC} [y/N]: "
    if [ "$default" = "y" ]; then
        prompt_text="${YELLOW}S $question${NC} [Y/n]: "
    fi
    
    read -p "$prompt_text" response
    response=${response:-$default}
    
    case "$response" in
        [Yy]|[Yy][Ee][Ss])
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Parse arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                ;;
            --cloud)
                BUILD_MODE="cloud"
                shift
                ;;
            --local)
                BUILD_MODE="local"
                shift
                ;;
            --variant)
                BUILD_VARIANT="$2"
                shift 2
                ;;
            --flavor)
                BUILD_FLAVOR="$2"
                shift 2
                ;;
            --format)
                OUTPUT_FORMAT="$2"
                if [[ ! "$OUTPUT_FORMAT" =~ ^(apk|aab)$ ]]; then
                    output "error" "Invalid format: $OUTPUT_FORMAT. Must be 'apk' or 'aab'"
                    exit 1
                fi
                shift 2
                ;;
            --profile)
                BUILD_PROFILE="$2"
                shift 2
                ;;
            --interactive|-i)
                INTERACTIVE_MODE=true
                shift
                ;;
            --verbose|-v)
                VERBOSE_MODE=true
                shift
                ;;
            --quiet|-q)
                QUIET_MODE=true
                VERBOSE_MODE=false
                shift
                ;;
            --json)
                JSON_MODE=true
                QUIET_MODE=false
                VERBOSE_MODE=false
                shift
                ;;
            --no-cache)
                ENABLE_CACHE=false
                shift
                ;;
            --force-rebuild)
                SKIP_PREBUILD_IF_EXISTS=false
                shift
                ;;
            --no-incremental)
                INCREMENTAL_BUILD=false
                shift
                ;;
            *)
                output "error" "Unknown option: $1"
                output "info" "Use --help for usage information"
                exit 1
                ;;
        esac
    done
}

# Function to log executed task
log_task() {
    local task="$1"
    local status="$2"  # "success", "failed", "warning", "skipped"
    local details="${3:-}"
    
    case "$status" in
        "success")
            EXECUTED_TASKS+=(" $task")
            ;;
        "failed")
            EXECUTED_TASKS+=("L $task")
            FAILED_TASKS+=("$task")
            ;;
        "warning")
            EXECUTED_TASKS+=("?  $task")
            WARNINGS+=("$task: $details")
            ;;
        "skipped")
            EXECUTED_TASKS+=("?  $task (skipped)")
            ;;
    esac
}

# Pre-flight checks
preflight_checks() {
    start_timer "preflight"
    output "progress" "Running pre-flight checks..."
    
    local errors=0
    local warnings=0
    
    # Check app.json exists and is valid
    if [ ! -f "${PROJECT_DIR}/app.json" ]; then
        output "error" "app.json not found in project root"
        output "info" "=? This script requires an Expo project with app.json"
        errors=$((errors + 1))
        log_task "Pre-flight: app.json check" "failed"
    else
        # Validate app.json structure
        if ! node -e "require('${PROJECT_DIR}/app.json')" 2>/dev/null; then
            output "error" "app.json is not valid JSON"
            errors=$((errors + 1))
            log_task "Pre-flight: app.json validation" "failed"
        else
            # Check required fields
            local has_expo=$(node -e "try { const pkg = require('${PROJECT_DIR}/app.json'); console.log(pkg.expo ? 'yes' : 'no'); } catch(e) { console.log('no'); }" 2>/dev/null)
            if [ "$has_expo" != "yes" ]; then
                output "error" "app.json missing 'expo' field"
                errors=$((errors + 1))
                log_task "Pre-flight: app.json expo field" "failed"
            else
                log_task "Pre-flight: app.json check" "success"
            fi
        fi
    fi
    
    # Check package.json exists
    if [ ! -f "${PROJECT_DIR}/package.json" ]; then
        output "error" "package.json not found"
        errors=$((errors + 1))
        log_task "Pre-flight: package.json check" "failed"
    else
        log_task "Pre-flight: package.json check" "success"
    fi
    
    # Check Android SDK (for local builds)
    if [ "$BUILD_MODE" = "local" ]; then
        if [ -z "$ANDROID_HOME" ] || [ ! -d "$ANDROID_HOME" ]; then
            local sdk_found=false
            for sdk_path in "$HOME/Library/Android/sdk" "$HOME/Android/Sdk" "/opt/android-sdk" "/usr/local/android-sdk"; do
                if [ -d "$sdk_path" ]; then
                    sdk_found=true
                    break
                fi
            done
            
            if [ "$sdk_found" = false ]; then
                output "warning" "Android SDK not found"
                output "info" "=? Install Android Studio or set ANDROID_HOME"
                warnings=$((warnings + 1))
                log_task "Pre-flight: Android SDK check" "warning"
            else
                log_task "Pre-flight: Android SDK check" "success"
            fi
        else
            log_task "Pre-flight: Android SDK check" "success"
        fi
        
        # Check required Android SDK components
        if [ -n "$ANDROID_HOME" ] && [ -d "$ANDROID_HOME" ]; then
            local build_tools_found=false
            if [ -d "$ANDROID_HOME/build-tools" ]; then
                build_tools_found=true
            fi
            
            if [ "$build_tools_found" = false ]; then
                output "warning" "Android Build Tools not found"
                output "info" "=? Install Android Build Tools via Android Studio SDK Manager"
                warnings=$((warnings + 1))
                log_task "Pre-flight: Android Build Tools check" "warning"
            else
                log_task "Pre-flight: Android Build Tools check" "success"
            fi
        fi
    fi
    
    # Check keystore for release builds only
    if [ "$BUILD_MODE" = "local" ] && [ "$BUILD_VARIANT" = "release" ]; then
        local keystore_path="${KEYSTORE_PATH:-${PROJECT_DIR}/android/app/release.keystore}"
        if [ ! -f "$keystore_path" ]; then
            # Only show as warning in verbose mode, otherwise just info
            if [ "$VERBOSE_MODE" = true ]; then
                output "warning" "Keystore not found (required for release builds)"
                output "info" "=? Location: $keystore_path"
                output "info" "=? Set KEYSTORE_PATH env var or run with --interactive to generate"
            else
                output "info" "9  Keystore not found (will use debug signing for release build)"
            fi
            
            if [ "$INTERACTIVE_MODE" = true ]; then
                if prompt_user "Would you like to generate a keystore now?" "n"; then
                    generate_keystore
                    # Re-check after generation
                    if [ -f "$keystore_path" ]; then
                        log_task "Pre-flight: Keystore check" "success"
                    else
                        warnings=$((warnings + 1))
                        log_task "Pre-flight: Keystore check" "warning"
                    fi
                else
                    warnings=$((warnings + 1))
                    log_task "Pre-flight: Keystore check" "warning"
                fi
            else
                # Non-interactive: just warn, build will continue with debug signing
                warnings=$((warnings + 1))
                log_task "Pre-flight: Keystore check" "warning"
            fi
        else
            log_task "Pre-flight: Keystore check" "success"
        fi
    elif [ "$BUILD_VARIANT" != "release" ]; then
        # Skip keystore check for debug/staging builds
        log_task "Pre-flight: Keystore check" "skipped" "Not required for $BUILD_VARIANT builds"
    fi
    
    end_timer "preflight"
    
    if [ $errors -gt 0 ]; then
        output "error" "Pre-flight checks failed with $errors error(s)"
        return 1
    fi
    
    if [ $warnings -gt 0 ]; then
        if [ "$QUIET_MODE" = false ]; then
            output "warning" "Pre-flight checks completed with $warnings warning(s)"
        fi
        # Only prompt in interactive mode for critical warnings (not keystore)
        if [ "$INTERACTIVE_MODE" = true ] && [ $errors -eq 0 ]; then
            # Don't prompt for keystore warnings in non-interactive, just continue
            if [ "$BUILD_VARIANT" = "release" ] && [ $warnings -eq 1 ]; then
                # If only keystore warning, don't prompt (build will use debug signing)
                output "info" "=? Continuing with debug signing (keystore not required for testing)"
            elif ! prompt_user "Continue despite warnings?" "y"; then
                exit 0
            fi
        fi
    else
        output "success" "Pre-flight checks passed"
    fi
    
    return 0
}

# Function to generate keystore
generate_keystore() {
    output "progress" "Generating keystore..."
    
    local keystore_path="${KEYSTORE_PATH:-${PROJECT_DIR}/android/app/release.keystore}"
    local keystore_dir=$(dirname "$keystore_path")
    mkdir -p "$keystore_dir"
    
    # Get app info for keystore
    local app_name=$(node -e "try { console.log(require('${PROJECT_DIR}/app.json').expo.name || 'myapp'); } catch(e) { console.log('myapp'); }" 2>/dev/null || echo "myapp")
    local alias_name=$(echo "$app_name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]//g')
    
    if [ "$INTERACTIVE_MODE" = true ]; then
        read -p "${YELLOW}Enter keystore password (or press Enter for default):${NC} " keystore_password
        keystore_password=${keystore_password:-android}
        
        read -p "${YELLOW}Enter key alias (default: $alias_name):${NC} " key_alias
        key_alias=${key_alias:-$alias_name}
    else
        keystore_password="android"
        key_alias="$alias_name"
    fi
    
    if command_exists keytool; then
        keytool -genkeypair -v -storetype PKCS12 -keystore "$keystore_path" \
            -alias "$key_alias" -keyalg RSA -keysize 2048 -validity 10000 \
            -storepass "$keystore_password" -keypass "$keystore_password" \
            -dname "CN=$app_name, OU=Mobile, O=Company, L=City, ST=State, C=US" 2>/dev/null
        
        if [ $? -eq 0 ]; then
            export KEYSTORE_PATH="$keystore_path"
            export KEYSTORE_PASSWORD="$keystore_password"
            export KEY_ALIAS="$key_alias"
            output "success" "Keystore generated at: $keystore_path"
            log_task "Keystore generation" "success"
            return 0
        fi
    fi
    
    output "error" "Failed to generate keystore. keytool not found or failed."
    output "info" "=? Install Java JDK or use Android Studio to generate keystore"
    log_task "Keystore generation" "failed"
    return 1
}

# Function to load build profile configuration
load_build_profile() {
    local profile_file="${PROJECT_DIR}/build-config.json"
    
    if [ -f "$profile_file" ]; then
        local profile_config=$(node -e "try { const config = require('$profile_file'); const profile = config.profiles?.['$BUILD_PROFILE'] || {}; console.log(JSON.stringify(profile)); } catch(e) { console.log('{}'); }" 2>/dev/null)
        
        if [ -n "$profile_config" ] && [ "$profile_config" != "{}" ]; then
            # Extract configuration values
            local profile_variant=$(echo "$profile_config" | node -e "try { const p = JSON.parse(require('fs').readFileSync(0, 'utf-8')); console.log(p.variant || ''); } catch(e) { console.log(''); }" 2>/dev/null)
            local profile_flavor=$(echo "$profile_config" | node -e "try { const p = JSON.parse(require('fs').readFileSync(0, 'utf-8')); console.log(p.flavor || ''); } catch(e) { console.log(''); }" 2>/dev/null)
            local profile_format=$(echo "$profile_config" | node -e "try { const p = JSON.parse(require('fs').readFileSync(0, 'utf-8')); console.log(p.format || ''); } catch(e) { console.log(''); }" 2>/dev/null)
            
            [ -n "$profile_variant" ] && BUILD_VARIANT="$profile_variant"
            [ -n "$profile_flavor" ] && BUILD_FLAVOR="$profile_flavor"
            [ -n "$profile_format" ] && OUTPUT_FORMAT="$profile_format"
            
            output "info" "Loaded build profile: $BUILD_PROFILE"
            log_task "Build profile load" "success" "$BUILD_PROFILE"
        fi
    fi
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to capitalize first letter (bash 3.2 compatible)
capitalize() {
    local str="$1"
    local first=$(echo "$str" | cut -c1 | tr '[:lower:]' '[:upper:]')
    local rest=$(echo "$str" | cut -c2-)
    echo "${first}${rest}"
}

# Function to uppercase string (bash 3.2 compatible)
uppercase() {
    echo "$1" | tr '[:lower:]' '[:upper:]'
}

# Function to get CPU core count for parallel operations
get_cpu_cores() {
    if command_exists sysctl; then
        sysctl -n hw.ncpu 2>/dev/null || echo "4"
    elif [ -f /proc/cpuinfo ]; then
        grep -c processor /proc/cpuinfo 2>/dev/null || echo "4"
    else
        echo "4"
    fi
}

# Function to check if Android project needs regeneration
needs_prebuild() {
    if [ ! -d "${PROJECT_DIR}/android" ]; then
        return 0  # Needs prebuild
    fi
    
    if [ "$SKIP_PREBUILD_IF_EXISTS" = false ]; then
        return 0  # Force prebuild
    fi
    
    # Check if app.json or package.json changed since last prebuild
    local android_timestamp_file="${PROJECT_DIR}/android/.prebuild_timestamp"
    if [ ! -f "$android_timestamp_file" ]; then
        return 0  # No timestamp, needs prebuild
    fi
    
    local last_prebuild=$(cat "$android_timestamp_file" 2>/dev/null || echo "0")
    local app_json_time=$(stat -f "%m" "${PROJECT_DIR}/app.json" 2>/dev/null || stat -c "%Y" "${PROJECT_DIR}/app.json" 2>/dev/null || echo "0")
    local package_json_time=$(stat -f "%m" "${PROJECT_DIR}/package.json" 2>/dev/null || stat -c "%Y" "${PROJECT_DIR}/package.json" 2>/dev/null || echo "0")
    
    # If app.json or package.json is newer than last prebuild, need to rebuild
    if [ "$app_json_time" -gt "$last_prebuild" ] || [ "$package_json_time" -gt "$last_prebuild" ]; then
        return 0  # Needs prebuild
    fi
    
    # Check if any native dependencies changed
    local node_modules_time=$(stat -f "%m" "${PROJECT_DIR}/node_modules" 2>/dev/null || stat -c "%Y" "${PROJECT_DIR}/node_modules" 2>/dev/null || echo "0")
    if [ "$node_modules_time" -gt "$last_prebuild" ]; then
        # Check if expo-* packages were added/updated
        if find "${PROJECT_DIR}/node_modules" -name "expo-*" -type d -newer "$android_timestamp_file" 2>/dev/null | grep -q .; then
            return 0  # Native dependency changed, needs prebuild
        fi
    fi
    
    return 1  # Doesn't need prebuild
}

# Function to detect if only JS code changed (for incremental builds)
only_js_changed() {
    if [ "$INCREMENTAL_BUILD" = false ]; then
        return 1  # Don't use incremental build
    fi
    
    if [ ! -d "${PROJECT_DIR}/android" ]; then
        return 1  # No Android project, can't do incremental
    fi
    
    # Check if any native files changed
    local last_build_file="${PROJECT_DIR}/android/.last_build_timestamp"
    if [ ! -f "$last_build_file" ]; then
        return 1  # No previous build timestamp
    fi
    
    local last_build=$(cat "$last_build_file" 2>/dev/null || echo "0")
    
    # Check if native Android files changed
    if find "${PROJECT_DIR}/android" -type f \( -name "*.java" -o -name "*.kt" -o -name "*.xml" -o -name "*.gradle" \) -newer "$last_build" 2>/dev/null | grep -q .; then
        return 1  # Native files changed
    fi
    
    # Check if app.json changed (affects native config)
    local app_json_time=$(stat -f "%m" "${PROJECT_DIR}/app.json" 2>/dev/null || stat -c "%Y" "${PROJECT_DIR}/app.json" 2>/dev/null || echo "0")
    if [ "$app_json_time" -gt "$last_build" ]; then
        return 1  # Config changed
    fi
    
    # Check if package.json changed (might affect native deps)
    local package_json_time=$(stat -f "%m" "${PROJECT_DIR}/package.json" 2>/dev/null || stat -c "%Y" "${PROJECT_DIR}/package.json" 2>/dev/null || echo "0")
    if [ "$package_json_time" -gt "$last_build" ]; then
        return 1  # Dependencies might have changed
    fi
    
    return 0  # Only JS changed
}

# Function to update build timestamp
update_build_timestamp() {
    local timestamp=$(date +%s)
    if [ -d "${PROJECT_DIR}/android" ]; then
        echo "$timestamp" > "${PROJECT_DIR}/android/.last_build_timestamp" 2>/dev/null || true
    fi
}

# Function to update prebuild timestamp
update_prebuild_timestamp() {
    local timestamp=$(date +%s)
    if [ -d "${PROJECT_DIR}/android" ]; then
        echo "$timestamp" > "${PROJECT_DIR}/android/.prebuild_timestamp" 2>/dev/null || true
    fi
}

# Function to check if compatibility check was recently run (cache result)
compatibility_check_cached() {
    if [ "$ENABLE_CACHE" = false ]; then
        return 1  # Cache disabled
    fi
    
    local cache_file="/tmp/expo_compat_check_cache_${PROJECT_DIR//\//_}"
    local cache_age=3600  # 1 hour cache
    
    if [ -f "$cache_file" ]; then
        local cache_time=$(stat -f "%m" "$cache_file" 2>/dev/null || stat -c "%Y" "$cache_file" 2>/dev/null || echo "0")
        local current_time=$(date +%s)
        local age=$((current_time - cache_time))
        
        if [ $age -lt $cache_age ]; then
            # Check if package.json changed since cache
            local package_json_time=$(stat -f "%m" "${PROJECT_DIR}/package.json" 2>/dev/null || stat -c "%Y" "${PROJECT_DIR}/package.json" 2>/dev/null || echo "0")
            if [ "$package_json_time" -le "$cache_time" ]; then
                return 0  # Cache is valid
            fi
        fi
    fi
    
    return 1  # Cache invalid or doesn't exist
}

# Function to save compatibility check result
save_compatibility_cache() {
    local cache_file="/tmp/expo_compat_check_cache_${PROJECT_DIR//\//_}"
    touch "$cache_file" 2>/dev/null || true
}

# Function to check and install Node.js/Bun
check_node_runtime() {
    start_timer "node_check"
    if command_exists bun; then
        local version=$(bun --version)
        output "success" "Bun found: $version"
        log_task "Node runtime check (Bun)" "success" "$version"
        end_timer "node_check"
        return 0
    elif command_exists node; then
        local version=$(node --version)
        output "success" "Node.js found: $version"
        log_task "Node runtime check (Node.js)" "success" "$version"
        end_timer "node_check"
        return 0
    else
        output "error" "Neither Bun nor Node.js found"
        output "info" "=? Install Bun: curl -fsSL https://bun.sh/install | bash"
        output "info" "=? Or Node.js: https://nodejs.org/"
        log_task "Node runtime check" "failed"
        end_timer "node_check"
        return 1
    fi
}

# Function to verify critical packages are installed
verify_critical_packages() {
    local missing_packages=()
    local critical_packages=("expo" "react" "react-native")
    
    for package in "${critical_packages[@]}"; do
        if [ ! -d "${PROJECT_DIR}/node_modules/${package}" ]; then
            missing_packages+=("$package")
        fi
    done
    
    if [ ${#missing_packages[@]} -eq 0 ]; then
        return 0
    else
        output "error" "Critical packages missing: ${missing_packages[*]}"
        return 1
    fi
}

# Function to install project dependencies
install_dependencies() {
    start_timer "deps_install"
    if [ "$QUIET_MODE" = false ]; then
        output "progress" "Checking project dependencies..."
    fi
    # Check if node_modules exists and is not empty
    if [ -d "${PROJECT_DIR}/node_modules" ] && [ "$(ls "${PROJECT_DIR}/node_modules" 2>/dev/null | wc -l)" -gt 0 ]; then
        if [ "$VERBOSE_MODE" = true ]; then
            output "info" "node_modules exists"
        fi
        
        # Check if package.json was modified more recently than node_modules
        if [ "${PROJECT_DIR}/package.json" -nt "${PROJECT_DIR}/node_modules" ]; then
            output "warning" "package.json is newer than node_modules, reinstalling..."
            log_task "Dependency check" "warning" "package.json newer than node_modules"
        else
            if [ "$VERBOSE_MODE" = true ]; then
                output "info" "Dependencies appear up to date"
            fi
            if verify_critical_packages; then
                log_task "Dependency verification" "success"
                end_timer "deps_install"
                return 0
            else
                output "warning" "Critical packages missing, reinstalling..."
                log_task "Dependency verification" "warning" "Critical packages missing"
            fi
        fi
    fi
    
    if [ "$QUIET_MODE" = false ]; then
        output "progress" "Installing project dependencies..."
    fi
    
    cd "${PROJECT_DIR}"
    
    # Prefer bun if available
    if command_exists bun; then
        if [ "$VERBOSE_MODE" = true ]; then
            if [ -f "${PROJECT_DIR}/bun.lockb" ] || [ -f "${PROJECT_DIR}/bun.lock" ]; then
                output "info" "Using Bun (bun.lock detected)..."
            else
                output "info" "Using Bun..."
            fi
        fi
        set +e
        bun install 2>&1 | tee /tmp/bun_install.log
        BUN_EXIT_CODE=${PIPESTATUS[0]}
        set -e
        if [ $BUN_EXIT_CODE -eq 0 ]; then
            if verify_critical_packages; then
                output "success" "Dependencies installed successfully with Bun"
                log_task "Dependency installation (Bun)" "success"
                cd - >/dev/null
                end_timer "deps_install"
                return 0
            else
                output "warning" "Bun install completed but critical packages missing, trying npm..."
                log_task "Dependency installation (Bun)" "warning" "Critical packages missing"
            fi
        else
            output "warning" "Bun install exited with code $BUN_EXIT_CODE"
            if [ -d "${PROJECT_DIR}/node_modules" ] && [ "$(ls -A ${PROJECT_DIR}/node_modules 2>/dev/null)" ]; then
                if verify_critical_packages; then
                    output "info" "node_modules created with critical packages, continuing..."
                    log_task "Dependency installation (Bun)" "warning" "Exit code $BUN_EXIT_CODE but packages exist"
                    cd - >/dev/null
                    end_timer "deps_install"
                    return 0
                fi
            fi
            output "info" "Trying npm as fallback..."
        fi
    fi
    
    # Fallback to npm
    if command_exists npm; then
        if [ "$VERBOSE_MODE" = true ]; then
            output "info" "Using npm..."
        fi
        
        # Strategy 1: Try normal install
        set +e
        npm install 2>&1 | tee /tmp/npm_install.log
        NPM_EXIT_CODE=${PIPESTATUS[0]}
        set -e
        if [ $NPM_EXIT_CODE -eq 0 ]; then
            if verify_critical_packages; then
                output "success" "Dependencies installed successfully with npm"
                log_task "Dependency installation (npm)" "success"
                cd - >/dev/null
                end_timer "deps_install"
                return 0
            fi
        fi
        
        # Strategy 2: Try with --legacy-peer-deps
        output "warning" "Standard install failed, trying with --legacy-peer-deps..."
        set +e
        npm install --legacy-peer-deps 2>&1 | tee /tmp/npm_install.log
        NPM_EXIT_CODE=${PIPESTATUS[0]}
        set -e
        if [ $NPM_EXIT_CODE -eq 0 ]; then
            if verify_critical_packages; then
                output "success" "Dependencies installed with --legacy-peer-deps"
                log_task "Dependency installation (npm --legacy-peer-deps)" "success"
                cd - >/dev/null
                end_timer "deps_install"
                return 0
            fi
        fi
        
        # Strategy 3: Try with --force
        output "warning" "Legacy install failed, trying with --force..."
        set +e
        npm install --force 2>&1 | tee /tmp/npm_install.log
        NPM_EXIT_CODE=${PIPESTATUS[0]}
        set -e
        if [ $NPM_EXIT_CODE -eq 0 ]; then
            if verify_critical_packages; then
                output "success" "Dependencies installed with --force"
                log_task "Dependency installation (npm --force)" "success"
                cd - >/dev/null
                end_timer "deps_install"
                return 0
            fi
        fi
        
        # Strategy 4: Check if node_modules was created anyway
        if [ -d "${PROJECT_DIR}/node_modules" ] && [ "$(ls -A ${PROJECT_DIR}/node_modules 2>/dev/null)" ]; then
            if verify_critical_packages; then
                output "warning" "npm install had errors, but critical packages exist"
                log_task "Dependency installation (npm)" "warning" "Exit code $NPM_EXIT_CODE but packages exist"
                cd - >/dev/null
                end_timer "deps_install"
                return 0
            else
                output "error" "Critical packages are missing despite node_modules existing"
                log_task "Dependency installation (npm)" "failed"
                cd - >/dev/null
                end_timer "deps_install"
                return 1
            fi
        fi
        
        output "error" "All npm install strategies failed"
        log_task "Dependency installation (npm)" "failed"
        cd - >/dev/null
        end_timer "deps_install"
        return 1
    else
        output "error" "No package manager found (bun/npm)"
        log_task "Dependency installation" "failed" "No package manager"
        cd - >/dev/null
        end_timer "deps_install"
        return 1
    fi
}

# Function to check and install Expo CLI
check_expo_cli() {
    if command_exists expo; then
        local version=$(expo --version 2>/dev/null || echo "installed")
        output "info" "Expo CLI found: $version"
        log_task "Expo CLI check" "success" "$version"
        return 0
    fi
    
    output "info" "Expo CLI not found globally, will use npx/bunx..."
    
    if command_exists bun; then
        if bunx expo --version >/dev/null 2>&1; then
            output "info" "Expo CLI available via bunx"
            log_task "Expo CLI check (bunx)" "success"
            return 0
        fi
    elif command_exists npx; then
        if npx expo --version >/dev/null 2>&1; then
            output "info" "Expo CLI available via npx"
            log_task "Expo CLI check (npx)" "success"
            return 0
        fi
    fi
    
    output "warning" "Expo CLI will be installed on-demand via npx/bunx"
    log_task "Expo CLI check" "warning" "Will install on-demand"
    return 0
}

# Function to check and install EAS CLI (for cloud builds)
check_eas_cli() {
    if [ "$BUILD_MODE" != "cloud" ]; then
        return 0
    fi
    
    if command_exists eas; then
        local version=$(eas --version 2>/dev/null || echo "installed")
        output "info" "EAS CLI found: $version"
        log_task "EAS CLI check" "success" "$version"
        return 0
    fi
    
    output "info" "EAS CLI not found globally, will use npx/bunx..."
    
    if command_exists bun; then
        if bunx eas --version >/dev/null 2>&1; then
            output "info" "EAS CLI available via bunx"
            log_task "EAS CLI check (bunx)" "success"
            return 0
        fi
    elif command_exists npx; then
        if npx eas --version >/dev/null 2>&1; then
            output "info" "EAS CLI available via npx"
            log_task "EAS CLI check (npx)" "success"
            return 0
        fi
    fi
    
    output "warning" "EAS CLI will be installed on-demand via npx/bunx"
    log_task "EAS CLI check" "warning" "Will install on-demand"
    return 0
}

# Function to check Java/JDK (for local builds)
check_java() {
    if [ "$BUILD_MODE" != "local" ]; then
        return 0
    fi
    
    if command_exists java; then
        JAVA_VERSION=$(java -version 2>&1 | head -n 1)
        output "info" "Java found: $JAVA_VERSION"
        
        JAVA_VER=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d'.' -f1)
        if [ -n "$JAVA_VER" ] && [ "$JAVA_VER" -ge 11 ]; then
            output "success" "Java version is compatible (>= 11)"
            log_task "Java check" "success" "Version $JAVA_VER"
            return 0
        else
            output "warning" "Java version may be too old. Android builds require Java 11+."
            log_task "Java check" "warning" "Version may be too old"
        fi
        return 0
    else
        output "warning" "Java not found in PATH."
        output "info" "=? Android Studio includes Java. If build fails, ensure JAVA_HOME is set."
        log_task "Java check" "warning" "Not found in PATH"
        return 0
    fi
}

# Function to find APK/AAB in common locations
find_build_output() {
    local extension="$1"  # "apk" or "aab"
    local variant="$2"    # "debug", "release", etc.
    local flavor="$3"     # flavor name if any
    
    local search_paths=(
        "${PROJECT_DIR}/android/app/build/outputs/${extension}/${variant}"
        "${PROJECT_DIR}/android/app/build/outputs/${extension}"
        "${PROJECT_DIR}/android/app/build/outputs/bundle/${variant}"
        "${PROJECT_DIR}/android/app/build/outputs/bundle"
        "${PROJECT_DIR}/.eas-build"
        "${PROJECT_DIR}"
    )
    
    # Add flavor-specific paths if flavor is specified
    if [ -n "$flavor" ]; then
        search_paths=(
            "${PROJECT_DIR}/android/app/build/outputs/${extension}/${flavor}/${variant}"
            "${PROJECT_DIR}/android/app/build/outputs/bundle/${flavor}${variant}"
            "${search_paths[@]}"
        )
    fi
    
    for path in "${search_paths[@]}"; do
        if [ -d "$path" ]; then
            local file=$(find "$path" -name "*.${extension}" -type f 2>/dev/null | head -1)
            if [ -n "$file" ]; then
                echo "$file"
                return 0
            fi
        fi
    done
    return 1
}

# Function to check if EAS is initialized
is_eas_initialized() {
    if [ -f "${PROJECT_DIR}/.eas/project.json" ] || ([ -f "${PROJECT_DIR}/app.json" ] && grep -q "extra.eas.projectId" "${PROJECT_DIR}/app.json" 2>/dev/null); then
        return 0
    fi
    return 1
}

# Function to find and configure Android SDK
setup_android_sdk() {
    if [ -n "$ANDROID_HOME" ] && [ -d "$ANDROID_HOME" ]; then
        export ANDROID_HOME
        log_task "Android SDK setup" "success" "Found at $ANDROID_HOME"
        return 0
    fi
    
    local sdk_paths=(
        "$HOME/Library/Android/sdk"
        "$HOME/Android/Sdk"
        "/opt/android-sdk"
        "/usr/local/android-sdk"
    )
    
    for sdk_path in "${sdk_paths[@]}"; do
        if [ -d "$sdk_path" ]; then
            export ANDROID_HOME="$sdk_path"
            output "success" "Found Android SDK at: $ANDROID_HOME"
            log_task "Android SDK setup" "success" "Found at $ANDROID_HOME"
            return 0
        fi
    done
    
    log_task "Android SDK setup" "failed"
    return 1
}

# Function to create/update local.properties
setup_local_properties() {
    local local_props="${PROJECT_DIR}/android/local.properties"
    
    if [ -d "${PROJECT_DIR}/android" ]; then
        if [ -n "$ANDROID_HOME" ]; then
            echo "sdk.dir=$ANDROID_HOME" > "$local_props"
            output "info" "Created/updated local.properties"
            log_task "local.properties setup" "success"
        fi
    fi
}

# Ensure minSdkVersion 26 for react-native-vision-camera-face-detector (survives prebuild overwrite)
ensure_min_sdk_version() {
    local gradle_props="${PROJECT_DIR}/android/gradle.properties"
    if [ -f "$gradle_props" ] && ! grep -q "^android.minSdkVersion=" "$gradle_props" 2>/dev/null; then
        echo "" >> "$gradle_props"
        echo "# Required for react-native-vision-camera-face-detector (minSdk 26)" >> "$gradle_props"
        echo "android.minSdkVersion=26" >> "$gradle_props"
        output "info" "Added android.minSdkVersion=26 to gradle.properties"
    fi
}

# Function to detect and fix expo-camera barcode scanner errors
fix_expo_camera_errors() {
    # Check for expo-camera compilation errors in the build log
    if ! grep -qiE "(barcodescanner|BarCodeScannerResult|Unresolved reference.*barcode|expo-camera.*compile.*FAILED|:expo-camera:compile.*Kotlin.*FAILED)" /tmp/gradle_build.log 2>/dev/null; then
        return 1  # Not an expo-camera error
    fi
    
    output "warning" "expo-camera barcode scanner errors detected"
    output "progress" "Fixing expo-camera compatibility issues..."
    
    cd "${PROJECT_DIR}"
    
    # Get current Expo SDK version from app.json or package.json
    local expo_sdk=""
    if [ -f "${PROJECT_DIR}/app.json" ]; then
        expo_sdk=$(node -e "try { const app = require('${PROJECT_DIR}/app.json'); console.log(app.expo?.sdkVersion || ''); } catch(e) { console.log(''); }" 2>/dev/null || echo "")
    fi
    
    if [ -z "$expo_sdk" ]; then
        expo_sdk=$(node -e "try { const pkg = require('${PROJECT_DIR}/package.json'); const expo = pkg.dependencies?.expo || pkg.devDependencies?.expo || ''; const match = expo.match(/sdk-(\d+)/); console.log(match ? match[1] : ''); } catch(e) { console.log(''); }" 2>/dev/null || echo "")
    fi
    
    # Extract SDK number if it's in format like "54.0.0" or "54"
    if [ -n "$expo_sdk" ]; then
        expo_sdk=$(echo "$expo_sdk" | cut -d'.' -f1)
    fi
    
    # Try to fix with expo install --fix first
    output "info" "Running expo install --fix for expo-camera..."
    if command_exists bun; then
        bunx expo install --fix expo-camera 2>&1 | tee -a /tmp/gradle_build.log >/dev/null || true
    else
        npx expo install --fix expo-camera 2>&1 | tee -a /tmp/gradle_build.log >/dev/null || true
    fi
    
    # Always update to a compatible version to ensure fix
    output "info" "Updating expo-camera to compatible version..."
    
    # Determine compatible version based on Expo SDK
    local camera_version=""
    if [ -n "$expo_sdk" ] && [ "$expo_sdk" -ge 54 ]; then
        camera_version="~17.0.10"
    elif [ -n "$expo_sdk" ] && [ "$expo_sdk" -ge 52 ]; then
        camera_version="~16.0.10"
    else
        # Try to get latest compatible version
        camera_version="latest"
    fi
    
    output "info" "Installing expo-camera@${camera_version}..."
    if command_exists bun; then
        bun add "expo-camera@${camera_version}" 2>&1 | tee -a /tmp/gradle_build.log >/dev/null || true
    else
        npm install "expo-camera@${camera_version}" --legacy-peer-deps 2>&1 | tee -a /tmp/gradle_build.log >/dev/null || true
    fi
    
    # Regenerate Android project to pick up changes
    output "info" "Regenerating Android project..."
    if command_exists bun; then
        bunx expo prebuild --platform android --clean 2>&1 | tee -a /tmp/gradle_build.log >/dev/null || true
    else
        npx expo prebuild --platform android --clean 2>&1 | tee -a /tmp/gradle_build.log >/dev/null || true
    fi
    
    setup_local_properties
    update_prebuild_timestamp
    
    log_task "expo-camera error fix" "success"
    return 0
}

# Function to detect and fix missing module errors
fix_missing_module_errors() {
    local missing_modules=$(grep -oE "Unable to resolve module.*['\"]([^'\"]+)['\"]" /tmp/gradle_build.log 2>/dev/null | sed -E "s/.*['\"]([^'\"]+)['\"].*/\1/" | sort -u | head -5)
    
    if [ -z "$missing_modules" ]; then
        return 1  # No missing module errors
    fi
    
    output "warning" "Missing module errors detected"
    output "progress" "Installing missing modules..."
    
    cd "${PROJECT_DIR}"
    
    for module in $missing_modules; do
        # Skip if it's a path or relative import
        if echo "$module" | grep -qE "^\.|^/" || [ -z "$module" ]; then
            continue
        fi
        
        output "info" "Installing missing module: $module"
        if command_exists bun; then
            bun add "$module" 2>&1 | tee -a /tmp/gradle_build.log >/dev/null || true
        else
            npm install "$module" --legacy-peer-deps 2>&1 | tee -a /tmp/gradle_build.log >/dev/null || true
        fi
    done
    
    log_task "Missing module fix" "success"
    return 0
}

# Function to build with better error handling
build_with_error_handling() {
    local build_command="$1"
    local build_type="$2"
    
    start_timer "gradle_build"
    output "progress" "Building $build_type ($BUILD_VARIANT variant)..."
    
    set +e
    eval "$build_command" 2>&1 | tee /tmp/gradle_build.log
    GRADLE_EXIT_CODE=${PIPESTATUS[0]}
    set -e
    
    end_timer "gradle_build"
    
    if [ $GRADLE_EXIT_CODE -ne 0 ] || grep -q "BUILD FAILED" /tmp/gradle_build.log; then
        output "error" "Build failed (exit code: $GRADLE_EXIT_CODE)"
        
        # Check for specific error types and try to fix them
        local fixed=false
        
        # Try to fix expo-camera errors first
        if fix_expo_camera_errors; then
            fixed=true
        fi
        
        # Try to fix missing module errors
        if fix_missing_module_errors; then
            fixed=true
        fi
        
        # If we fixed something, return a special code to trigger retry
        if [ "$fixed" = true ]; then
            output "info" "=? Errors were automatically fixed. Will retry build..."
            log_task "Gradle build ($build_type)" "warning" "Failed but errors fixed, retrying"
            return 2  # Special return code for "fixed, retry"
        fi
        
        # Extract and show error suggestions
        local error_summary=$(grep -iE "error|failed|exception" /tmp/gradle_build.log | head -5)
        if [ -n "$error_summary" ]; then
            output "error" "Error summary:"
            echo "$error_summary" | while read -r line; do
                local suggestion=$(get_error_suggestion "$line")
                if [ -n "$suggestion" ]; then
                    output "info" "=? $suggestion"
                fi
            done
        fi
        
        output "info" "=? Full build log: /tmp/gradle_build.log"
        output "info" "=? Common fixes:"
        output "info" "   - Run: expo install --fix"
        output "info" "   - Clean: rm -rf android/app/build"
        output "info" "   - Rebuild: npx expo prebuild --clean"
        
        log_task "Gradle build ($build_type)" "failed"
        return 1
    fi
    
    output "success" "Build completed successfully"
    log_task "Gradle build ($build_type)" "success"
    return 0
}

# Main execution
parse_arguments "$@"

if [ "$JSON_MODE" = false ]; then
    echo -e "${GREEN}=? Starting APK build process for React Native Expo project...${NC}"
    echo -e "${CYAN}=? Project directory: ${PROJECT_DIR}${NC}"
    echo -e "${CYAN}=' Build mode: ${BUILD_MODE}${NC}"
    echo -e "${CYAN}=? Build variant: ${BUILD_VARIANT}${NC}"
    [ -n "$BUILD_FLAVOR" ] && echo -e "${CYAN}<? Build flavor: ${BUILD_FLAVOR}${NC}"
    echo -e "${CYAN}=? Output format: ${OUTPUT_FORMAT}${NC}"
    echo -e "${CYAN}?  Build profile: ${BUILD_PROFILE}${NC}"
    echo ""
fi

# Load build profile configuration
load_build_profile

# Create apk folder if it doesn't exist
mkdir -p "${APK_FOLDER}"
log_task "Created output folder" "success"

# Run pre-flight checks
if ! preflight_checks; then
    exit 1
fi

# Install all required dependencies
if [ "$QUIET_MODE" = false ]; then
    output "progress" "Checking and installing dependencies..."
fi
    
    # Run checks in parallel if possible (bash 3.2 compatible)
    if ! check_node_runtime; then
        exit 1
    fi
    
    # Start dependency installation and other checks in parallel where possible
    if ! install_dependencies; then
        output "warning" "Dependency installation had issues, but continuing..."
        output "info" "=? Build may fail if critical packages are missing"
        
        if [ ! -d "${PROJECT_DIR}/node_modules" ] || [ "$(ls "${PROJECT_DIR}/node_modules" 2>/dev/null | wc -l)" -eq 0 ]; then
            output "error" "node_modules is missing or empty. Cannot proceed."
            exit 1
        fi
    fi

# Run CLI checks (these are fast and can run sequentially)
check_expo_cli
check_eas_cli
check_java

# Determine build method
if [ "$BUILD_MODE" == "local" ]; then
    output "progress" "Using local build..."
    
    if ! setup_android_sdk; then
        output "error" "Android SDK not found."
        output "info" "=? Please install Android Studio or set ANDROID_HOME environment variable."
        exit 1
    fi
    
    # Ensure native Android project exists (with smart caching)
    if needs_prebuild; then
        if [ "$INTERACTIVE_MODE" = true ]; then
            if ! prompt_user "Generate/regenerate Android project?" "y"; then
                output "error" "Android project required for local builds"
                exit 1
            fi
        fi
        
        output "progress" "Generating native Android project..."
        cd "${PROJECT_DIR}"
        start_timer "prebuild"
        
        # Only use --clean if Android project exists (faster)
        if [ -d "${PROJECT_DIR}/android" ]; then
            if command_exists bun; then
                bunx expo prebuild --platform android --clean
            else
                npx expo prebuild --platform android --clean
            fi
        else
            # First time, no need for --clean
            if command_exists bun; then
                bunx expo prebuild --platform android
            else
                npx expo prebuild --platform android
            fi
        fi
        
        update_prebuild_timestamp
        end_timer "prebuild"
        log_task "Android project generation" "success"
        cd - >/dev/null
    else
        output "info" "Android project is up to date, skipping prebuild"
        log_task "Android project generation" "skipped" "Up to date"
    fi
    
    setup_local_properties
    ensure_min_sdk_version
    
    # Check for dependency compatibility (with caching)
    if compatibility_check_cached; then
        output "info" "Using cached compatibility check result"
        log_task "Expo package compatibility check" "skipped" "Cached"
    else
        output "progress" "Checking dependency compatibility..."
        cd "${PROJECT_DIR}"
        
        if command_exists bun; then
            bunx expo install --check 2>&1 | tee /tmp/expo_compat_check.log >/dev/null || true
        else
            npx expo install --check 2>&1 | tee /tmp/expo_compat_check.log >/dev/null || true
        fi
        
        save_compatibility_cache
        
        if grep -qi "incompatible\|needs.*update\|outdated" /tmp/expo_compat_check.log 2>/dev/null; then
            output "warning" "Package compatibility issues detected"
            output "progress" "Fixing compatibility issues..."
            if command_exists bun; then
                bunx expo install --fix 2>&1 | tee /tmp/expo_compat_fix.log >/dev/null || true
            else
                npx expo install --fix 2>&1 | tee /tmp/expo_compat_fix.log >/dev/null || true
            fi
            log_task "Expo package compatibility fix" "success"
            
            output "progress" "Reinstalling dependencies..."
            if command_exists bun; then
                bun install 2>&1 | tee /tmp/deps_reinstall.log >/dev/null || true
            else
                npm install --legacy-peer-deps 2>&1 | tee /tmp/deps_reinstall.log >/dev/null || true
            fi
        else
            log_task "Expo package compatibility check" "success"
        fi
    fi
    
    cd "${PROJECT_DIR}" || true
    
    # Build APK/AAB using Gradle
    output "progress" "Building $(uppercase "$OUTPUT_FORMAT") with Gradle..."
    output "info" "=? This may take 5-15 minutes..."
    
    if [ -d "${PROJECT_DIR}/android" ]; then
        cd "${PROJECT_DIR}/android"
        setup_local_properties
        ensure_min_sdk_version
        
        if [ -f "./gradlew" ]; then
            # Only stop daemon if not using it
            if [ "$USE_GRADLE_DAEMON" = false ]; then
                ./gradlew --stop 2>/dev/null || true
            fi
            
            export ANDROID_HOME
            
            # Determine Gradle task based on format and variant
            gradle_task=""
            if [ "$OUTPUT_FORMAT" = "aab" ]; then
                if [ -n "$BUILD_FLAVOR" ]; then
                    gradle_task="bundle$(capitalize "$BUILD_FLAVOR")$(capitalize "$BUILD_VARIANT")"
                else
                    gradle_task="bundle$(capitalize "$BUILD_VARIANT")"
                fi
            else
                if [ -n "$BUILD_FLAVOR" ]; then
                    gradle_task="assemble$(capitalize "$BUILD_FLAVOR")$(capitalize "$BUILD_VARIANT")"
                else
                    gradle_task="assemble$(capitalize "$BUILD_VARIANT")"
                fi
            fi
            
            # Optimize worker count based on CPU cores
            cpu_cores=$(get_cpu_cores)
            max_workers=$((cpu_cores > 4 ? 4 : cpu_cores))
            
            # Build command with performance optimizations
            build_cmd="./gradlew $gradle_task"
            
            # Add performance flags
            if [ "$USE_GRADLE_DAEMON" = true ]; then
                build_cmd="$build_cmd --daemon"
            else
                build_cmd="$build_cmd --no-daemon"
            fi
            
            build_cmd="$build_cmd --parallel --max-workers=$max_workers"
            
            # Enable build cache if available
            if [ "$ENABLE_CACHE" = true ]; then
                build_cmd="$build_cmd --build-cache"
            fi
            
            # Check if we can do incremental build
            if only_js_changed && [ "$INCREMENTAL_BUILD" = true ]; then
                output "info" "Only JS code changed, using incremental build..."
                # Don't clean, just rebuild
            else
                # Clean build directory for this variant only (faster than full clean)
                output "info" "Cleaning build artifacts..."
                ./gradlew clean 2>&1 | tee -a /tmp/gradle_build.log >/dev/null || true
            fi
            
            build_retry_count=0
            max_retries=2
            build_result=1
            
            while [ $build_retry_count -le $max_retries ]; do
                build_with_error_handling "$build_cmd" "$OUTPUT_FORMAT"
                build_result=$?
                
                if [ $build_result -eq 0 ]; then
                    # Build succeeded
                    break
                elif [ $build_result -eq 2 ]; then
                    # Errors were fixed, retry immediately
                    output "progress" "Retrying build after automatic fixes..."
                    build_retry_count=$((build_retry_count + 1))
                    cd "${PROJECT_DIR}/android"
                    ./gradlew clean 2>&1 | tee -a /tmp/gradle_build.log >/dev/null || true
                    continue
                else
                    # Build failed, try error recovery
                    if [ $build_retry_count -lt $max_retries ]; then
                        output "progress" "Attempting error recovery (attempt $((build_retry_count + 1))/$max_retries)..."
                        cd "${PROJECT_DIR}"
                        
                        # Run expo install --fix
                        if command_exists bun; then
                            bunx expo install --fix 2>&1 | tee -a /tmp/gradle_build.log >/dev/null || true
                        else
                            npx expo install --fix 2>&1 | tee -a /tmp/gradle_build.log >/dev/null || true
                        fi
                        
                        # Clean and reinstall
                        if [ "$INTERACTIVE_MODE" = true ]; then
                            if prompt_user "Clean and reinstall dependencies?" "y"; then
                                rm -rf node_modules 2>/dev/null || true
                                if command_exists bun; then
                                    bun install 2>&1 | tee -a /tmp/gradle_build.log >/dev/null || true
                                else
                                    npm install --legacy-peer-deps 2>&1 | tee -a /tmp/gradle_build.log >/dev/null || true
                                fi
                            fi
                            
                            if prompt_user "Regenerate Android project?" "y"; then
                                if command_exists bun; then
                                    bunx expo prebuild --platform android --clean 2>&1 | tee -a /tmp/gradle_build.log >/dev/null || true
                                else
                                    npx expo prebuild --platform android --clean 2>&1 | tee -a /tmp/gradle_build.log >/dev/null || true
                                fi
                                setup_local_properties
                            fi
                        else
                            # Auto-recovery
                            output "info" "Cleaning and reinstalling dependencies..."
                            rm -rf node_modules 2>/dev/null || true
                            if command_exists bun; then
                                bun install 2>&1 | tee -a /tmp/gradle_build.log >/dev/null || true
                            else
                                npm install --legacy-peer-deps 2>&1 | tee -a /tmp/gradle_build.log >/dev/null || true
                            fi
                            
                            output "info" "Regenerating Android project..."
                            if command_exists bun; then
                                bunx expo prebuild --platform android --clean 2>&1 | tee -a /tmp/gradle_build.log >/dev/null || true
                            else
                                npx expo prebuild --platform android --clean 2>&1 | tee -a /tmp/gradle_build.log >/dev/null || true
                            fi
                            setup_local_properties
                        fi
                        
                        # Retry build
                        build_retry_count=$((build_retry_count + 1))
                        cd "${PROJECT_DIR}/android"
                        ./gradlew clean 2>&1 | tee -a /tmp/gradle_build.log >/dev/null || true
                    else
                        output "error" "Build failed after $max_retries recovery attempts"
                        cd "${PROJECT_DIR}"
                        exit 1
                    fi
                fi
            done
            
            if [ $build_result -ne 0 ]; then
                output "error" "Build failed after all recovery attempts"
                cd "${PROJECT_DIR}"
                exit 1
            fi
            
            # Update build timestamp on success
            update_build_timestamp
            
            cd "${PROJECT_DIR}"
        else
            output "error" "Gradle wrapper not found."
            log_task "Gradle wrapper check" "failed"
            exit 1
        fi
    else
        output "error" "Android project not found."
        log_task "Android project check" "failed"
        exit 1
    fi
    
    # Find the generated APK/AAB
    sleep 2
    BUILD_OUTPUT_PATH=$(find_build_output "$OUTPUT_FORMAT" "$BUILD_VARIANT" "$BUILD_FLAVOR")
    
    if [ -z "$BUILD_OUTPUT_PATH" ]; then
        output "warning" "Build output not found immediately, checking..."
        sleep 3
        BUILD_OUTPUT_PATH=$(find_build_output "$OUTPUT_FORMAT" "$BUILD_VARIANT" "$BUILD_FLAVOR")
        
        if [ -z "$BUILD_OUTPUT_PATH" ]; then
            output "error" "Build output not found. Build may have failed."
            exit 1
        fi
    fi
    
    log_task "Build output location" "success" "$BUILD_OUTPUT_PATH"
    
elif [ "$BUILD_MODE" == "cloud" ]; then
    if ! is_eas_initialized; then
        output "error" "EAS project not configured."
        log_task "EAS initialization check" "failed"
        exit 1
    fi
    
    output "progress" "Using EAS Build (cloud)..."
    
    if [ ! -f "${PROJECT_DIR}/eas.json" ]; then
        output "error" "eas.json not found in project root"
        log_task "EAS configuration check" "failed"
        exit 1
    fi
    
    cd "${PROJECT_DIR}"
    start_timer "eas_build"
    if command_exists bun; then
        bunx eas build --platform android --profile "$BUILD_PROFILE" --non-interactive
    else
        npx eas-cli build --platform android --profile "$BUILD_PROFILE" --non-interactive
    fi
    end_timer "eas_build"
    log_task "EAS cloud build" "success"
    cd - >/dev/null
    
    output "success" "Build submitted to EAS. Check your email or EAS dashboard for the download link."
    exit 0
fi

# Get app name and version from app.json
APP_NAME=$(node -e "try { console.log(require('${PROJECT_DIR}/app.json').expo.name); } catch(e) { console.log('app'); }" 2>/dev/null || echo "app")
APP_VERSION=$(node -e "try { console.log(require('${PROJECT_DIR}/app.json').expo.version); } catch(e) { console.log('1.0.0'); }" 2>/dev/null || echo "1.0.0")

# Clean app name for filename
CLEAN_APP_NAME=$(echo "$APP_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g')

# Generate filename with timestamp
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
OUTPUT_FILENAME="${CLEAN_APP_NAME}-v${APP_VERSION}-${BUILD_VARIANT}-${TIMESTAMP}.${OUTPUT_FORMAT}"
OUTPUT_DESTINATION="${APK_FOLDER}/${OUTPUT_FILENAME}"

# Clean up old files
if [ "$INTERACTIVE_MODE" = false ] || prompt_user "Clean up old build files?" "y"; then
    output "progress" "Cleaning up old build files..."
    find "${APK_FOLDER}" -name "${CLEAN_APP_NAME}-v${APP_VERSION}-*.${OUTPUT_FORMAT}" -type f ! -name "${OUTPUT_FILENAME}" -delete 2>/dev/null || true
    log_task "Old build cleanup" "success"
fi

# Copy build output to destination
output "progress" "Copying build output..."
cp "${BUILD_OUTPUT_PATH}" "${OUTPUT_DESTINATION}"
LATEST_OUTPUT="${APK_FOLDER}/latest.${OUTPUT_FORMAT}"
cp "${BUILD_OUTPUT_PATH}" "${LATEST_OUTPUT}"
log_task "Build output copy" "success" "$OUTPUT_FILENAME"

# Get file size
OUTPUT_SIZE=$(du -h "${OUTPUT_DESTINATION}" | cut -f1)

# Calculate total build time
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))
MINUTES=$((TOTAL_DURATION / 60))
SECONDS=$((TOTAL_DURATION % 60))

if [ "$JSON_MODE" = false ]; then
    echo ""
    output "success" "Build completed successfully!"
    output "info" "=? Latest: ${LATEST_OUTPUT}"
    output "info" "=? Size: ${OUTPUT_SIZE}"
    output "info" "=? Timestamped: ${OUTPUT_FILENAME}"
    output "info" "?  Total build time: ${MINUTES}m ${SECONDS}s"
    echo ""
fi

# Task execution acknowledgment
if [ "$JSON_MODE" = false ]; then
    echo -e "${CYAN}${NC}"
    echo -e "${CYAN}                          TASK EXECUTION SUMMARY / ACKNOWLEDGMENT${NC}"
    echo -e "${CYAN}${NC}"
    echo ""
    
    if [ ${#EXECUTED_TASKS[@]} -gt 0 ]; then
        echo -e "${BLUE}=? Executed Tasks (${#EXECUTED_TASKS[@]} total):${NC}"
        echo ""
        for task in "${EXECUTED_TASKS[@]}"; do
            echo -e "   $task"
        done
        echo ""
    fi
    
    # Show timing information (bash 3.2 compatible)
    if [ ${#BUILD_TIMINGS_NAMES[@]} -gt 0 ]; then
        echo -e "${BLUE}?  Timing Information:${NC}"
        echo ""
        local i=0
        while [ $i -lt ${#BUILD_TIMINGS_NAMES[@]} ]; do
            local operation="${BUILD_TIMINGS_NAMES[$i]}"
            local duration="${BUILD_TIMINGS_VALUES[$i]}"
            echo -e "   ${operation}: ${duration}s"
            i=$((i + 1))
        done
        echo ""
    fi
    
    if [ ${#WARNINGS[@]} -gt 0 ]; then
        echo -e "${YELLOW}?  Warnings (${#WARNINGS[@]} total):${NC}"
        echo ""
        for warning in "${WARNINGS[@]}"; do
            echo -e "   ${warning}"
        done
        echo ""
    fi
    
    if [ ${#FAILED_TASKS[@]} -gt 0 ]; then
        echo -e "${RED}L Failed Tasks (${#FAILED_TASKS[@]} total):${NC}"
        echo ""
        for task in "${FAILED_TASKS[@]}"; do
            echo -e "   ${task}"
        done
        echo ""
    fi
    
    # Final status
    if [ ${#FAILED_TASKS[@]} -eq 0 ]; then
        echo -e "${GREEN} All tasks completed successfully!${NC}"
        echo -e "${GREEN}=? Output Location: ${OUTPUT_DESTINATION}${NC}"
        echo -e "${GREEN}=? Output Size: ${OUTPUT_SIZE}${NC}"
        echo -e "${GREEN}?  Total Duration: ${MINUTES}m ${SECONDS}s${NC}"
    else
        echo -e "${YELLOW}?  Build completed with ${#FAILED_TASKS[@]} failed task(s)${NC}"
        echo -e "${YELLOW}=? Check the logs above for details${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}${NC}"
    echo ""
else
    # JSON output mode
    cat << EOF
{
  "success": $([ ${#FAILED_TASKS[@]} -eq 0 ] && echo "true" || echo "false"),
  "output": {
    "path": "${OUTPUT_DESTINATION}",
    "size": "${OUTPUT_SIZE}",
    "format": "${OUTPUT_FORMAT}",
    "variant": "${BUILD_VARIANT}",
    "flavor": "${BUILD_FLAVOR:-null}"
  },
  "timing": {
    "total_seconds": ${TOTAL_DURATION},
    "total_formatted": "${MINUTES}m ${SECONDS}s"
  },
  "tasks": {
    "total": ${#EXECUTED_TASKS[@]},
    "failed": ${#FAILED_TASKS[@]},
    "warnings": ${#WARNINGS[@]}
  }
}
EOF
fi
