#!/usr/bin/env node

/**
 * Script to reprocess all documents in a workspace to extract AI-based titles and descriptions
 * Usage: node reprocess-documents.js <API_URL> <SESSION_COOKIE> <WORKSPACE_ID>
 */

const API_URL = process.argv[2] || 'http://localhost:8787';
const SESSION_COOKIE = process.argv[3];
const WORKSPACE_ID = process.argv[4];

if (!SESSION_COOKIE || !WORKSPACE_ID) {
  console.log('Usage: node reprocess-documents.js <API_URL> <SESSION_COOKIE> <WORKSPACE_ID>');
  console.log('Example: node reprocess-documents.js http://localhost:8787 abc123session wks_123456');
  process.exit(1);
}

console.log('========================================');
console.log('Reprocessing Documents');
console.log('========================================');
console.log('API URL:', API_URL);
console.log('Workspace ID:', WORKSPACE_ID);
console.log('');

async function reprocessDocuments() {
  try {
    // Fetch all documents for the workspace
    console.log(`Fetching documents for workspace ${WORKSPACE_ID}...`);
    const documentsResponse = await fetch(`${API_URL}/api/workspaces/${WORKSPACE_ID}/documents`, {
      method: 'GET',
      headers: {
        'Cookie': `session=${SESSION_COOKIE}`,
        'Content-Type': 'application/json',
      },
    });

    if (!documentsResponse.ok) {
      throw new Error(`Failed to fetch documents: ${documentsResponse.statusText}`);
    }

    const documentsData = await documentsResponse.json();
    const documents = documentsData.documents || [];

    console.log(`Found ${documents.length} documents to reprocess\n`);

    // Process each document
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      console.log(`[${i + 1}/${documents.length}] Processing: ${doc.filename} (${doc.id})`);

      try {
        const processResponse = await fetch(
          `${API_URL}/api/workspaces/${WORKSPACE_ID}/documents/${doc.id}/process`,
          {
            method: 'POST',
            headers: {
              'Cookie': `session=${SESSION_COOKIE}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const result = await processResponse.json();

        if (result.success) {
          successCount++;
          console.log(`  ✓ Success!`);
          console.log(`    Title: ${result.title || 'N/A'}`);
          console.log(`    Description: ${result.description ? result.description.substring(0, 80) + '...' : 'N/A'}`);
        } else {
          failCount++;
          console.log(`  ✗ Failed: ${result.error || result.message || 'Unknown error'}`);
        }
      } catch (error) {
        failCount++;
        console.log(`  ✗ Error: ${error.message}`);
      }

      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('');
    }

    console.log('========================================');
    console.log('Reprocessing Complete!');
    console.log('========================================');
    console.log(`✓ Successful: ${successCount}`);
    console.log(`✗ Failed: ${failCount}`);
    console.log(`Total: ${documents.length}`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

reprocessDocuments();
