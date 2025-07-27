
# Google Document AI Setup Guide

This guide will help you set up Google Document AI for enhanced tax document processing in the tax filing application.

## Prerequisites

1. Google Cloud Platform account with billing enabled
2. Basic understanding of Google Cloud Console

## Step 1: Create Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID - you'll need this later

## Step 2: Enable Document AI API

1. In the Google Cloud Console, go to **APIs & Services** > **Library**
2. Search for "Document AI API"
3. Click on the Document AI API and click **Enable**

## Step 3: Create Document AI Processors

### Create W-2 Processor
1. Go to **Document AI** > **Processors** in the Google Cloud Console
2. Click **Create processor**
3. Select **Form W2 Processor** from the list
4. Choose a processor name (e.g., "Tax W2 Processor")
5. Select region (recommend "us" for US tax documents)
6. Click **Create**
7. Note the **Processor ID** from the processor details page

### Create 1099 Processor (Optional)
1. Repeat the above steps but select a 1099 processor type
2. Note: 1099 processors may have limited availability depending on your region
3. If not available, the system will fall back to LLM processing for 1099 forms

## Step 4: Create Service Account

1. Go to **IAM & Admin** > **Service Accounts**
2. Click **Create Service Account**
3. Enter service account details:
   - Name: `document-ai-service`
   - Description: `Service account for Document AI processing`
4. Click **Create and Continue**

## Step 5: Assign Permissions

1. In the service account creation wizard, add these roles:
   - **Document AI Editor** (`roles/documentai.editor`)
   - **Document AI API User** (`roles/documentai.apiUser`)
2. Click **Continue** and then **Done**

## Step 6: Generate Service Account Key

1. Find your newly created service account in the list
2. Click on the service account name
3. Go to the **Keys** tab
4. Click **Add Key** > **Create new key**
5. Select **JSON** format
6. Click **Create**
7. The JSON key file will be downloaded to your computer
8. **Important**: Store this file securely and never commit it to version control

## Step 7: Configure Environment Variables

1. Copy the `.env.example` file to `.env.local` in your project root
2. Update the following variables:

```bash
# Google Document AI Configuration
GOOGLE_CLOUD_PROJECT_ID="your-actual-project-id"
GOOGLE_CLOUD_LOCATION="us"  # or your chosen region
GOOGLE_CLOUD_W2_PROCESSOR_ID="your-actual-w2-processor-id"
GOOGLE_CLOUD_1099_PROCESSOR_ID="your-actual-1099-processor-id"  # optional
GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"
```

### How to find your Processor IDs:
1. Go to **Document AI** > **Processors** in Google Cloud Console
2. Click on each processor you created
3. Copy the Processor ID from the processor details page

## Step 8: Set Up Authentication

### Option 1: Service Account Key File (Recommended for Development)
1. Place your downloaded JSON key file in a secure location
2. Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to the full path of this file

### Option 2: Application Default Credentials (Production)
For production deployments, consider using:
- Google Cloud Run with service account attached
- Google Kubernetes Engine with Workload Identity
- Compute Engine with service account attached

## Step 9: Test the Setup

1. Start your application with the new environment variables
2. Upload a test W-2 or 1099 document
3. Check the console logs to see if Document AI is being used:
   - Success: "Using Google Document AI for processing"
   - Fallback: "Google Document AI not configured, using LLM fallback"

## Pricing Information

Google Document AI pricing (as of 2024):
- **W-2 Processor**: ~$1.50 per 1,000 pages
- **Form Parser**: ~$1.50 per 1,000 pages
- **Custom Extractors**: ~$3.00 per 1,000 pages

The system includes intelligent fallback to LLM processing if Document AI fails or is not configured.

## Troubleshooting

### Common Issues:

1. **"Permission denied" errors**
   - Verify your service account has the correct roles
   - Check that the JSON key file path is correct
   - Ensure the file is accessible by the application

2. **"Processor not found" errors**
   - Verify the processor ID is correct
   - Ensure the processor is in the same project
   - Check that the processor is in the correct region

3. **"API not enabled" errors**
   - Make sure Document AI API is enabled in your project
   - Wait a few minutes after enabling the API

4. **Regional issues**
   - Ensure your processor region matches the `GOOGLE_CLOUD_LOCATION` setting
   - For non-US regions, the API endpoint will be automatically adjusted

### Testing Fallback Behavior:
To test that the LLM fallback works correctly:
1. Temporarily comment out the Document AI environment variables
2. Upload a document - it should process using LLM
3. Restore the environment variables to use Document AI

## Security Best Practices

1. **Never commit service account keys to version control**
2. **Restrict service account permissions** to only what's needed
3. **Rotate service account keys** regularly
4. **Use IAM conditions** to restrict access by IP or time if needed
5. **Monitor usage** through Google Cloud Console

## Support

- **Google Cloud Documentation**: https://cloud.google.com/document-ai/docs
- **Processor Types**: https://cloud.google.com/document-ai/docs/processors-list
- **API Reference**: https://cloud.google.com/document-ai/docs/reference

The application will automatically use Google Document AI when properly configured, with seamless fallback to LLM processing for maximum reliability.
