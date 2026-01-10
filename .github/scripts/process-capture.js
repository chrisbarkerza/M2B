#!/usr/bin/env node

/**
 * Second Brain Capture Processor
 *
 * This script:
 * 1. Receives capture text from GitHub Issue
 * 2. Calls Claude API to classify using m2b-inbox logic
 * 3. Writes to appropriate markdown file(s)
 * 4. Logs to inbox-log.md
 * 5. Returns result for GitHub Action to comment
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

// Initialize Claude API
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Get capture text from issue
const issueBody = process.env.ISSUE_BODY || '';
const issueTitle = process.env.ISSUE_TITLE || '';
const issueNumber = process.env.ISSUE_NUMBER || 'unknown';

// Combine title and body for full capture
const captureText = issueTitle ? `${issueTitle}\n\n${issueBody}` : issueBody;

// Today's date
const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]; // YYYY-MM-DD HH:MM:SS

console.log('Processing capture:', captureText);

// Read the m2b-inbox skill for classification logic
const skillPath = path.join(process.cwd(), '.claude/skills/m2b-inbox/skill.md');
let classifierPrompt = '';

try {
  classifierPrompt = fs.readFileSync(skillPath, 'utf8');
} catch (e) {
  console.error('Error reading m2b-inbox skill:', e);
  process.exit(1);
}

// Build the prompt for Claude
const systemPrompt = `${classifierPrompt}

CRITICAL INSTRUCTIONS:
- Today's date is ${today}
- You MUST respond with a valid JSON object and nothing else
- No markdown, no code blocks, no explanations - ONLY the JSON object
- The JSON must follow this exact schema:

{
  "category": "shopping|admin_urgent|admin_longer_term|project|person|idea|note",
  "confidence": 85,
  "context": "personal|work",
  "classification_reason": "Brief explanation",
  "extracted_data": {
    // Category-specific fields
  },
  "file_operations": [
    {
      "action": "append|create|update",
      "file_path": "relative/path/to/file.md",
      "content": "content to write"
    }
  ]
}`;

async function classifyCapture() {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Classify this capture and return JSON:\n\n${captureText}`
        }
      ],
    });

    // Extract JSON from response
    const responseText = message.content[0].text;
    console.log('Claude response:', responseText);

    // Try to parse JSON (handle potential markdown code blocks)
    let jsonText = responseText;

    // Remove markdown code blocks if present
    if (jsonText.includes('```')) {
      const match = jsonText.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
      if (match) {
        jsonText = match[1];
      }
    }

    const classification = JSON.parse(jsonText.trim());

    console.log('Classification:', JSON.stringify(classification, null, 2));

    return classification;
  } catch (error) {
    console.error('Error calling Claude API:', error);
    throw error;
  }
}

function executeFileOperations(classification) {
  const operations = classification.file_operations || [];
  const filesModified = [];

  operations.forEach(op => {
    const filePath = path.join(process.cwd(), op.file_path);
    console.log(`Executing ${op.action} on ${op.file_path}`);

    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (op.action === 'create') {
        // Create new file
        fs.writeFileSync(filePath, op.content, 'utf8');
        filesModified.push(op.file_path);
      } else if (op.action === 'append') {
        // Append to existing file (or create if doesn't exist)
        if (fs.existsSync(filePath)) {
          const existing = fs.readFileSync(filePath, 'utf8');
          // Append after the frontmatter and Active section
          let updated;
          if (existing.includes('## Active')) {
            updated = existing.replace('## Active', `## Active\n${op.content}`);
          } else {
            updated = existing + '\n' + op.content;
          }
          // Update the 'updated' date in frontmatter
          updated = updated.replace(/updated: \d{4}-\d{2}-\d{2}/, `updated: ${today}`);
          fs.writeFileSync(filePath, updated, 'utf8');
        } else {
          fs.writeFileSync(filePath, op.content, 'utf8');
        }
        filesModified.push(op.file_path);
      } else if (op.action === 'update') {
        // Update existing file
        fs.writeFileSync(filePath, op.content, 'utf8');
        filesModified.push(op.file_path);
      }
    } catch (error) {
      console.error(`Error executing ${op.action} on ${op.file_path}:`, error);
    }
  });

  return filesModified;
}

function logToInbox(classification, captureText, filesModified) {
  const inboxLogPath = path.join(process.cwd(), 'md/inbox/inbox-log.md');

  let logEntry = `\n## ${timestamp} [GitHub Issue #${issueNumber}]\n`;
  logEntry += `**Input**: "${captureText.substring(0, 200)}${captureText.length > 200 ? '...' : ''}"\n`;
  logEntry += `**Classification**: ${classification.category}\n`;
  logEntry += `**Confidence**: ${classification.confidence}%\n`;
  logEntry += `**Context**: ${classification.context}\n`;

  if (filesModified.length === 1) {
    logEntry += `**Location**: ${filesModified[0]}\n`;
  } else if (filesModified.length > 1) {
    logEntry += `**Locations**:\n`;
    filesModified.forEach(file => {
      logEntry += `  - ${file}\n`;
    });
  }

  if (classification.classification_reason) {
    logEntry += `**Reason**: ${classification.classification_reason}\n`;
  }

  logEntry += `\n---\n`;

  // Append to inbox log
  if (fs.existsSync(inboxLogPath)) {
    const existing = fs.readFileSync(inboxLogPath, 'utf8');
    // Insert after the header
    const lines = existing.split('\n');
    const headerEnd = lines.findIndex(line => line.includes('<!-- Entries will be appended'));
    if (headerEnd !== -1) {
      lines.splice(headerEnd + 1, 0, logEntry);
      fs.writeFileSync(inboxLogPath, lines.join('\n'), 'utf8');
    } else {
      fs.appendFileSync(inboxLogPath, logEntry, 'utf8');
    }
  } else {
    fs.writeFileSync(inboxLogPath, logEntry, 'utf8');
  }
}

function writeResult(classification, filesModified) {
  const result = {
    category: classification.category,
    confidence: classification.confidence,
    context: classification.context,
    location: filesModified[0] || 'unknown',
    additional_locations: filesModified.slice(1),
  };

  // Write result for GitHub Action to read
  const resultPath = path.join(process.cwd(), '.github/result.json');
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf8');
}

// Main execution
(async () => {
  try {
    if (!captureText.trim()) {
      console.error('No capture text provided');
      process.exit(1);
    }

    // Step 1: Classify with Claude
    const classification = await classifyCapture();

    // Step 2: Execute file operations
    const filesModified = executeFileOperations(classification);

    // Step 3: Log to inbox
    logToInbox(classification, captureText, filesModified);

    // Step 4: Write result for GitHub Action
    writeResult(classification, filesModified);

    console.log('✓ Capture processed successfully');
    console.log('Files modified:', filesModified);

  } catch (error) {
    console.error('Fatal error processing capture:', error);
    process.exit(1);
  }
})();
