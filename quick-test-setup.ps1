# Quick Test Setup Script for Auction Hub
# This script modifies the database directly to bypass the two-tier approval process
# for testing purposes. It fills in all required fields for bidding.
#
# Usage Examples:
#   .\quick-test-setup.ps1 -UserId <UUID>           # Setup user for AUC001 (default)
#   .\quick-test-setup.ps1 -UserId <UUID> -AuctionCode AUC002  # Setup for different auction
#   .\quick-test-setup.ps1 -ListUsers               # List all users
#   .\quick-test-setup.ps1 -ListAuctions            # List all auctions
#   .\quick-test-setup.ps1 -ListParticipants        # List all participants
#   .\quick-test-setup.ps1 -Help                    # Show help

param(
    [Parameter(Mandatory=$false)]
    [string]$UserId,
    
    [Parameter(Mandatory=$false)]
    [string]$AuctionCode = "AUC001",
    
    [Parameter(Mandatory=$false)]
    [switch]$ListUsers,
    
    [Parameter(Mandatory=$false)]
    [switch]$ListAuctions,
    
    [Parameter(Mandatory=$false)]
    [switch]$ListParticipants,
    
    [Parameter(Mandatory=$false)]
    [switch]$Help
)

$ContainerName = "auction-hub-postgres"
$DbUser = "user"
$DbName = "auction-hub"

function Run-SQL {
    param([string]$Query)
    docker exec -i $ContainerName psql -U $DbUser -d $DbName -c $Query
}

function Run-SQL-NoHeader {
    param([string]$Query)
    $result = docker exec -i $ContainerName psql -U $DbUser -d $DbName -t -c $Query 2>$null
    if ($result) {
        # Handle both string and array results, trim all whitespace/newlines
        $cleanResult = ($result | Out-String).Trim()
        return $cleanResult
    }
    return ""
}

# Function to generate JWT token
function New-JwtToken {
    param(
        [string]$UserId,
        [string]$Email,
        [string]$FullName,
        [string]$Role,
        [string]$Secret
    )
    
    # JWT Header (Base64Url encoded)
    $header = @{
        alg = "HS256"
        typ = "JWT"
    } | ConvertTo-Json -Compress
    $headerBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($header)) -replace '\+','-' -replace '/','_' -replace '='
    
    # Calculate timestamps
    $now = [int][double]::Parse((Get-Date -UFormat %s))
    $exp = $now + (24 * 60 * 60)  # 24 hours expiry
    
    # JWT Payload (Base64Url encoded) - matches Supabase JWT structure
    $payload = @{
        sub = $UserId
        email = $Email
        full_name = $FullName
        aud = "authenticated"
        role = $Role
        iat = $now
        exp = $exp
    } | ConvertTo-Json -Compress
    $payloadBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($payload)) -replace '\+','-' -replace '/','_' -replace '='
    
    # Create signature
    $dataToSign = "$headerBase64.$payloadBase64"
    $secretBytes = [Text.Encoding]::UTF8.GetBytes($Secret)
    $dataBytes = [Text.Encoding]::UTF8.GetBytes($dataToSign)
    
    $hmac = New-Object System.Security.Cryptography.HMACSHA256
    $hmac.Key = $secretBytes
    $signatureBytes = $hmac.ComputeHash($dataBytes)
    $signatureBase64 = [Convert]::ToBase64String($signatureBytes) -replace '\+','-' -replace '/','_' -replace '='
    
    return "$headerBase64.$payloadBase64.$signatureBase64"
}

# Function to read .env file
function Get-EnvValue {
    param([string]$Key, [string]$EnvPath)
    
    if (Test-Path $EnvPath) {
        $content = Get-Content $EnvPath
        foreach ($line in $content) {
            if ($line -match "^$Key=(.*)$") {
                return $matches[1].Trim()
            }
        }
    }
    return $null
}

# Show help
if ($Help) {
    Write-Host @"
=====================================================
   QUICK TEST SETUP SCRIPT FOR AUCTION HUB
=====================================================

DESCRIPTION:
  This script bypasses the two-tier approval process by directly modifying
  the database. It fills in all required fields that would normally be
  populated during the registration approval flow.

USAGE:
  .\quick-test-setup.ps1 -ListUsers                       # List all users
  .\quick-test-setup.ps1 -ListAuctions                    # List all auctions
  .\quick-test-setup.ps1 -ListParticipants                # List all participants
  .\quick-test-setup.ps1 -UserId <UUID>                   # Setup user for AUC001
  .\quick-test-setup.ps1 -UserId <UUID> -AuctionCode AUC002  # Setup for specific auction

PARAMETERS:
  -UserId <UUID>        User ID (UUID) to setup for bidding
  -AuctionCode <STRING> Auction code (default: AUC001)
  -ListUsers            List all users with their IDs
  -ListAuctions         List all auctions with their codes
  -ListParticipants     List all participants
  -Help                 Show this help message

WHAT THIS SCRIPT DOES:
  1. Queries the database to find the auction by code
  2. Sets auction status to 'live' with active time window
  3. Creates participant record if not exists
  4. Simulates Tier 1 approval: Documents verified
  5. Simulates Tier 2 approval: Deposit paid (uses auction's deposit amount)
  6. Simulates Final approval: Confirmed by admin
  7. Simulates Check-in: User checked in and ready to bid
  8. Clears any rejection/withdrawal flags

FIELDS POPULATED:
  Two-Tier Approval - Tier 1 (Document Verification):
    - registered_at         (registration timestamp)
    - submitted_at          (document submission timestamp)
    - documents_verified_at (Tier 1 approval timestamp)
    - documents_verified_by (admin who verified)

  Two-Tier Approval - Tier 2 (Deposit Payment):
    - deposit_paid_at       (deposit payment timestamp)
    - deposit_amount        (amount from auction's deposit_amount_required)
    - deposit_payment_id    (simulated payment ID)

  Final Approval & Check-in:
    - confirmed_at          (final approval timestamp)
    - confirmed_by          (admin who approved)
    - checked_in_at         (check-in timestamp)

  Cleared Fields:
    - documents_rejected_at, documents_rejected_reason (cleared)
    - rejected_at, rejected_reason (cleared)
    - withdrawn_at, withdrawal_reason (cleared)

EXAMPLES:
  # Quick setup for testing - just provide your user ID
  .\quick-test-setup.ps1 -UserId "550e8400-e29b-41d4-a716-446655440000"

  # Find your user ID first
  .\quick-test-setup.ps1 -ListUsers

  # Setup for a different auction
  .\quick-test-setup.ps1 -UserId "550e8400-..." -AuctionCode "AUC002"

"@
    exit
}

# List users
if ($ListUsers) {
    Write-Host "`n=== USERS ===" -ForegroundColor Cyan
    Run-SQL "SELECT id, email, full_name, role, is_verified FROM users ORDER BY created_at DESC LIMIT 30;"
    exit
}

# List auctions
if ($ListAuctions) {
    Write-Host "`n=== AUCTIONS ===" -ForegroundColor Cyan
    Run-SQL "SELECT id, code, name, status, starting_price, deposit_amount_required, auction_start_at, auction_end_at FROM auctions ORDER BY created_at DESC LIMIT 20;"
    exit
}

# List participants
if ($ListParticipants) {
    Write-Host "`n=== PARTICIPANTS ===" -ForegroundColor Cyan
    Run-SQL @"
SELECT 
    ap.id,
    u.email,
    a.code as auction_code,
    ap.confirmed_at IS NOT NULL as is_confirmed,
    ap.checked_in_at IS NOT NULL as is_checked_in,
    ap.documents_verified_at IS NOT NULL as docs_verified,
    ap.deposit_paid_at IS NOT NULL as deposit_paid,
    ap.rejected_at IS NOT NULL as is_rejected
FROM auction_participants ap
JOIN users u ON ap.user_id = u.id
JOIN auctions a ON ap.auction_id = a.id
ORDER BY ap.registered_at DESC
LIMIT 20;
"@
    exit
}

# Main setup logic
if (-not $UserId) {
    Write-Host "`n[ERROR] Please provide -UserId" -ForegroundColor Red
    Write-Host "Run with -Help for usage information`n" -ForegroundColor Yellow
    
    Write-Host "Quick commands:" -ForegroundColor Cyan
    Write-Host "  .\quick-test-setup.ps1 -ListUsers        # List users to find your user ID"
    Write-Host "  .\quick-test-setup.ps1 -ListAuctions     # List auctions to find codes"
    Write-Host "  .\quick-test-setup.ps1 -UserId <UUID>    # Setup user for AUC001`n"
    exit 1
}

Write-Host "`n=============================================" -ForegroundColor Green
Write-Host "   QUICK TEST SETUP - Auction Hub" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host "User ID:      $UserId" -ForegroundColor Yellow
Write-Host "Auction Code: $AuctionCode" -ForegroundColor Yellow
Write-Host "=============================================`n" -ForegroundColor Green

# Step 1: Get auction details from code
Write-Host "[1/6] Fetching auction details for '$AuctionCode'..." -ForegroundColor Cyan
$auctionData = Run-SQL-NoHeader "SELECT id FROM auctions WHERE code = '$AuctionCode';"

if ([string]::IsNullOrWhiteSpace($auctionData)) {
    Write-Host "`n[ERROR] Auction with code '$AuctionCode' not found!" -ForegroundColor Red
    Write-Host "Available auctions:" -ForegroundColor Yellow
    Run-SQL "SELECT code, name, status FROM auctions ORDER BY created_at DESC LIMIT 10;"
    exit 1
}

$AuctionId = $auctionData.Trim()
Write-Host "  -> Found auction ID: $AuctionId" -ForegroundColor Green

# Get deposit amount from auction
$depositAmount = Run-SQL-NoHeader "SELECT COALESCE(deposit_amount_required, 1000.00) FROM auctions WHERE id = '$AuctionId';"
$depositAmount = ($depositAmount -replace '^\s+|\s+$', '')
if ([string]::IsNullOrWhiteSpace($depositAmount) -or $depositAmount -eq "") {
    $depositAmount = "1000.00"
}
Write-Host "  -> Deposit amount: $depositAmount VND" -ForegroundColor Green

# Step 2: Verify user exists
Write-Host "[2/6] Verifying user exists..." -ForegroundColor Cyan
$userExists = Run-SQL-NoHeader "SELECT email FROM users WHERE id = '$UserId';"

if ([string]::IsNullOrWhiteSpace($userExists)) {
    Write-Host "`n[ERROR] User with ID '$UserId' not found!" -ForegroundColor Red
    Write-Host "Available users:" -ForegroundColor Yellow
    Run-SQL "SELECT id, email, full_name FROM users ORDER BY created_at DESC LIMIT 10;"
    exit 1
}
Write-Host "  -> Found user: $($userExists.Trim())" -ForegroundColor Green

# Step 3: Update auction to be live
Write-Host "[3/6] Setting auction to LIVE status..." -ForegroundColor Cyan
Run-SQL @"
UPDATE auctions 
SET 
    status = 'live',
    is_active = true,
    auction_start_at = NOW() - INTERVAL '1 hour',
    auction_end_at = NOW() + INTERVAL '2 hours',
    updated_at = NOW()
WHERE id = '$AuctionId';
"@

# Step 4: Check if participant exists, create if not
Write-Host "[4/6] Checking/Creating participant record..." -ForegroundColor Cyan
$existingParticipant = Run-SQL-NoHeader "SELECT id FROM auction_participants WHERE user_id = '$UserId' AND auction_id = '$AuctionId';"

if ([string]::IsNullOrWhiteSpace($existingParticipant)) {
    Write-Host "  -> Creating new participant record..." -ForegroundColor Yellow
    
    # Generate a simulated payment UUID for deposit
    $simulatedPaymentId = [guid]::NewGuid().ToString()
    
    Run-SQL @"
INSERT INTO auction_participants (
    user_id, 
    auction_id, 
    registered_at,
    submitted_at,
    documents_verified_at,
    documents_verified_by,
    deposit_paid_at,
    deposit_amount,
    deposit_payment_id,
    confirmed_at,
    confirmed_by,
    checked_in_at
) VALUES (
    '$UserId',
    '$AuctionId',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '1 day 12 hours',
    '$UserId',
    NOW() - INTERVAL '1 day',
    $depositAmount,
    '$simulatedPaymentId',
    NOW() - INTERVAL '12 hours',
    '$UserId',
    NOW() - INTERVAL '30 minutes'
);
"@
    Write-Host "  -> Created new participant with full approval chain" -ForegroundColor Green
} else {
    Write-Host "  -> Participant record exists, updating..." -ForegroundColor Green
}

# Step 5: Update participant with all approvals (Two-Tier + Check-in)
Write-Host "[5/6] Setting all two-tier approval fields..." -ForegroundColor Cyan

# Generate a simulated payment UUID for deposit if updating existing record
$simulatedPaymentId = [guid]::NewGuid().ToString()

Run-SQL @"
UPDATE auction_participants 
SET 
    -- Registration Phase
    registered_at = COALESCE(registered_at, NOW() - INTERVAL '2 days'),
    submitted_at = COALESCE(submitted_at, NOW() - INTERVAL '2 days'),
    
    -- Two-Tier Approval: Tier 1 - Document Verification
    documents_verified_at = COALESCE(documents_verified_at, NOW() - INTERVAL '1 day 12 hours'),
    documents_verified_by = COALESCE(documents_verified_by, '$UserId'),
    documents_rejected_at = NULL,
    documents_rejected_reason = NULL,
    
    -- Two-Tier Approval: Tier 2 - Deposit Payment
    deposit_paid_at = COALESCE(deposit_paid_at, NOW() - INTERVAL '1 day'),
    deposit_amount = COALESCE(deposit_amount, $depositAmount),
    deposit_payment_id = COALESCE(deposit_payment_id, '$simulatedPaymentId'),
    
    -- Final Approval
    confirmed_at = COALESCE(confirmed_at, NOW() - INTERVAL '12 hours'),
    confirmed_by = COALESCE(confirmed_by, '$UserId'),
    
    -- Check-in (Required to place bids)
    checked_in_at = NOW(),
    
    -- Clear legacy rejection/withdrawal flags
    rejected_at = NULL,
    rejected_reason = NULL,
    withdrawn_at = NULL,
    withdrawal_reason = NULL
WHERE user_id = '$UserId' AND auction_id = '$AuctionId';
"@

# Step 6: Verify the setup
Write-Host "[6/7] Verifying setup...`n" -ForegroundColor Cyan

Write-Host "--- AUCTION STATUS ---" -ForegroundColor Magenta
Run-SQL "SELECT code, name, status, is_active, auction_start_at, auction_end_at, starting_price, deposit_amount_required FROM auctions WHERE id = '$AuctionId';"

Write-Host "`n--- PARTICIPANT STATUS (Two-Tier Approval) ---" -ForegroundColor Magenta
Run-SQL @"
SELECT 
    registered_at IS NOT NULL as "1_registered",
    submitted_at IS NOT NULL as "2_submitted",
    documents_verified_at IS NOT NULL as "3_tier1_docs_verified",
    deposit_paid_at IS NOT NULL as "4_tier2_deposit_paid",
    confirmed_at IS NOT NULL as "5_final_approved",
    checked_in_at IS NOT NULL as "6_checked_in",
    rejected_at IS NULL as "not_rejected",
    withdrawn_at IS NULL as "not_withdrawn",
    deposit_amount as "deposit_amount"
FROM auction_participants 
WHERE user_id = '$UserId' AND auction_id = '$AuctionId';
"@

# Step 7: Generate JWT Token
Write-Host "`n[7/7] Generating JWT Token..." -ForegroundColor Cyan

# Get user details for JWT
$userEmail = $userExists.Trim()
$userFullName = Run-SQL-NoHeader "SELECT full_name FROM users WHERE id = '$UserId';"
$userRole = Run-SQL-NoHeader "SELECT role FROM users WHERE id = '$UserId';"

# Read JWT secret from .env file
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $scriptDir "server\.env"
$jwtSecret = Get-EnvValue -Key "SUPABASE_JWT_SECRET" -EnvPath $envPath

$jwtToken = $null
if ($jwtSecret) {
    $jwtToken = New-JwtToken -UserId $UserId -Email $userEmail -FullName $userFullName -Role $userRole -Secret $jwtSecret
    Write-Host "  -> JWT Token generated successfully (valid for 24 hours)" -ForegroundColor Green
} else {
    Write-Host "  -> WARNING: Could not read SUPABASE_JWT_SECRET from $envPath" -ForegroundColor Yellow
    Write-Host "  -> JWT token not generated. You'll need to login manually." -ForegroundColor Yellow
}

Write-Host "`n=============================================" -ForegroundColor Green
Write-Host "   SETUP COMPLETE!" -ForegroundColor Green
Write-Host "   User is now ready to place bids on $AuctionCode" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

Write-Host "`nTwo-Tier Approval Status:" -ForegroundColor Yellow
Write-Host "  [+] Tier 1: Documents submitted and verified" -ForegroundColor Green
Write-Host "  [+] Tier 2: Deposit paid ($depositAmount VND)" -ForegroundColor Green
Write-Host "  [+] Final: Registration approved" -ForegroundColor Green
Write-Host "  [+] Check-in: User checked in and ready to bid" -ForegroundColor Green

Write-Host "`n--- QUICK COPY VALUES ---" -ForegroundColor Cyan

Write-Host "`nAuction ID:" -ForegroundColor Yellow
Write-Host "$AuctionId" -ForegroundColor White

Write-Host "`nUser ID:" -ForegroundColor Yellow
Write-Host "$UserId" -ForegroundColor White

if ($jwtToken) {
    Write-Host "`nJWT Token (Bearer):" -ForegroundColor Yellow
    Write-Host "$jwtToken" -ForegroundColor White
    
    Write-Host "`nAuthorization Header:" -ForegroundColor Yellow
    Write-Host "Bearer $jwtToken" -ForegroundColor White
    
    # Copy to clipboard if possible
    try {
        $jwtToken | Set-Clipboard
        Write-Host "`n[Copied JWT token to clipboard!]" -ForegroundColor Green
    } catch {
        # Clipboard access might fail in some environments
    }
}

Write-Host "`n--- NEXT STEPS ---" -ForegroundColor Cyan
Write-Host "Option 1: WebSocket Testing" -ForegroundColor Yellow
Write-Host "  1. Open websocket-full-test.html in browser"
Write-Host "  2. Paste the JWT token in the 'JWT Token' field"
Write-Host "  3. Enter Auction ID: $AuctionId"
Write-Host "  4. Connect and place bids!"

Write-Host "`nOption 2: API Testing (Postman/curl)" -ForegroundColor Yellow
Write-Host "  Add header: Authorization: Bearer <JWT_TOKEN>"
Write-Host "  POST http://localhost:3000/api/manual-bid"
Write-Host "  Body: { `"auctionId`": `"$AuctionId`", `"amount`": 2050000000 }"

Write-Host ""
