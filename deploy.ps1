param (
    [string]$ProjectID = "YOUR_PROJECT_ID",
    [string]$Region = "asia-south1",
    [string]$GeminiKey = "",
    [string]$RmId = "FBI2025",
    [string]$RmPassword = "abc1234",
    [string]$AdminId = "FBI_ADMIN",
    [string]$AdminPassword = "admin_pass_2026",
    [string]$ImageTag = $(Get-Date -Format "yyyyMMdd-HHmmss")
)

$ErrorActionPreference = "Continue"

if (-not $GeminiKey) {
    Write-Host "Warning: No GeminiKey provided. Deploying with PLACEHOLDER_NO_KEY. You will need to update the secret later." -ForegroundColor Yellow
    $GeminiKey = "PLACEHOLDER_NO_KEY"
}

$ServiceName = "agentloannext"
$RepoName = "fbi-agentloannext-images"
$ProjectNumber = (gcloud projects describe $ProjectID --format="value(projectNumber)").Trim()
$ImageUri = "$Region-docker.pkg.dev/$ProjectID/$RepoName/$ServiceName`:$ImageTag"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  AgentLoanNext · Future Bank of India · Cloud Run deploy (Win)" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  Project   : $ProjectID"
Write-Host "  Region    : $Region"
Write-Host "  Service   : $ServiceName"
Write-Host "  Image     : $ImageUri"
Write-Host ""

# 1. APIs
Write-Host "[1/7] Ensuring required GCP APIs are enabled..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com iam.googleapis.com secretmanager.googleapis.com speech.googleapis.com --project=$ProjectID

# 2. Artifact Registry
Write-Host "[2/7] Ensuring Artifact Registry repo '$RepoName' exists in $Region..." -ForegroundColor Yellow
$repoExists = gcloud artifacts repositories describe $RepoName --location=$Region --project=$ProjectID 2>&1
if ($LASTEXITCODE -ne 0) {
    gcloud artifacts repositories create $RepoName --repository-format=docker --location=$Region --description="AgentLoanNext (Future Bank of India) container images" --project=$ProjectID
}
else {
    Write-Host "    repo already exists - reusing."
}

# 3. Secret Manager
function Ensure-Secret {
    param([string]$Name, [string]$Value, [string]$Desc)
    $secretExists = gcloud secrets describe $Name --project=$ProjectID 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "    creating secret $Name..."
        gcloud secrets create $Name --replication-policy=automatic --labels=app=agentloannext, operator=future-bank-of-india --project=$ProjectID
    }
    
    $tmpFile = New-TemporaryFile
    Set-Content -Path $tmpFile.FullName -Value $Value -NoNewline
    gcloud secrets versions add $Name --data-file=$tmpFile.FullName --project=$ProjectID | Out-Null
    Remove-Item $tmpFile.FullName
    Write-Host "    $($Name): latest version posted ($Desc)."
}

Write-Host "[3/7] Provisioning Secret Manager secrets..." -ForegroundColor Yellow
$SessionSecret = -join ((48..57) + (97..122) | Get-Random -Count 32 | % { [char]$_ })
if ($GeminiKey -ne "PLACEHOLDER_NO_KEY") {
    Ensure-Secret "fbi-gemini-api-key" $GeminiKey "Gemini API key"
}
Ensure-Secret "fbi-session-secret" $SessionSecret "session signing key"
Ensure-Secret "fbi-rm-password" $RmPassword "RM password"
Ensure-Secret "fbi-admin-password" $AdminPassword "Admin password"

# 4. IAM
Write-Host "[4/7] Granting Cloud Run service account permissions..." -ForegroundColor Yellow
$ComputeSA = "$ProjectNumber-compute@developer.gserviceaccount.com"

$secrets = @("fbi-gemini-api-key", "fbi-session-secret", "fbi-rm-password", "fbi-admin-password")
foreach ($s in $secrets) {
    gcloud secrets add-iam-policy-binding $s --member="serviceAccount:$ComputeSA" --role="roles/secretmanager.secretAccessor" --project=$ProjectID | Out-Null
}

Write-Host "    granting roles/speech.client to $ComputeSA..."
gcloud projects add-iam-policy-binding $ProjectID --member="serviceAccount:$ComputeSA" --role="roles/speech.client" --condition=None | Out-Null

Write-Host "    granting roles/aiplatform.user to $ComputeSA..."
gcloud projects add-iam-policy-binding $ProjectID --member="serviceAccount:$ComputeSA" --role="roles/aiplatform.user" --condition=None | Out-Null

# 5. Build
Write-Host "[5/7] Building & pushing image with Cloud Build..." -ForegroundColor Yellow
gcloud builds submit --tag $ImageUri --project $ProjectID --region $Region .

# 6. Deploy
Write-Host "[6/7] Deploying to Cloud Run ($Region)..." -ForegroundColor Yellow
gcloud run deploy $ServiceName `
    --image $ImageUri `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --port 8080 `
    --memory "1Gi" `
    --cpu "2" `
    --concurrency 80 `
    --timeout "300s" `
    --min-instances 0 `
    --max-instances 1 `
    --service-account $ComputeSA `
    --set-env-vars "STATIC_DIR=/app/static,APP_OPERATOR=Future Bank of India,DEPLOY_REGION=$Region,APP_ENV=production,FBI_RM_ID=$RmId,FBI_ADMIN_ID=$AdminId,ALLOW_ADMIN_VAULT=true,GEMINI_MODEL=gemini-flash-latest" `
    --set-secrets "GEMINI_API_KEY=fbi-gemini-api-key:latest,SESSION_SECRET=fbi-session-secret:latest,FBI_RM_PASSWORD=fbi-rm-password:latest,FBI_ADMIN_PASSWORD=fbi-admin-password:latest" `
    --labels "app=agentloannext,operator=future-bank-of-india,domain=msme-lending,env=production" `
    --project $ProjectID

# 7. Verify
Write-Host "[7/7] Fetching service URL..." -ForegroundColor Yellow
$URL = gcloud run services describe $ServiceName --region $Region --project $ProjectID --format="value(status.url)"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  Deployment complete." -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  Service URL     :  $URL"
Write-Host "  RM Login        :  $URL/login/rm        ($RmId / $RmPassword)"
Write-Host "  Customer Login  :  $URL/login/customer"
Write-Host "  Admin Vault     :  $URL/admin/vault     (RM session required)"
Write-Host ""
