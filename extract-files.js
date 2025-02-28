#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * A utility script to extract files from a source file containing multiple file contents
 * 
 * Usage: 
 *   node extract-files.js <source-file> [output-directory]
 * 
 * Arguments:
 *   source-file: Path to the file containing code for multiple files
 *   output-directory: (Optional) Directory where extracted files will be saved.
 *                     Defaults to a directory named after the source file
 */

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 1) {
  console.error('Error: Please provide a source file path.');
  console.log('Usage: node extract-files.js <source-file> [output-directory]');
  process.exit(1);
}

const sourceFilePath = args[0];
const baseOutputDir = args[1] || path.basename(sourceFilePath, path.extname(sourceFilePath));
const outputDir = path.resolve(process.cwd(), baseOutputDir);

// Check if source file exists
if (!fs.existsSync(sourceFilePath)) {
  console.error(`Error: Source file '${sourceFilePath}' not found.`);
  process.exit(1);
}

// Read the source file
let sourceCode;
try {
  sourceCode = fs.readFileSync(sourceFilePath, 'utf8');
} catch (error) {
  console.error(`Error reading source file: ${error.message}`);
  process.exit(1);
}

// Create the main output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Regular expression to find file sections
// Matches "// filename.ext" followed by content until the next file marker or end of file
const fileRegex = /\/\/\s*([\w\-\.\/]+)\s*\n([\s\S]*?)(?=\n\/\/\s*[\w\-\.\/]+\s*\n|$)/g;

// Process found files
let match;
let filesExtracted = 0;

console.log(`\nExtracting files from '${sourceFilePath}' to '${outputDir}'...\n`);

while ((match = fileRegex.exec(sourceCode)) !== null) {
  const [_, filePath, content] = match;
  
  // Skip if filename or content is empty
  if (!filePath || !content.trim()) continue;
  
  // Create subdirectories if needed
  const fullPath = path.join(outputDir, filePath);
  const dirName = path.dirname(fullPath);
  
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }
  
  // Write file content
  try {
    fs.writeFileSync(fullPath, content.trim());
    console.log(`✓ Created: ${filePath}`);
    filesExtracted++;
  } catch (error) {
    console.error(`✗ Failed to create ${filePath}: ${error.message}`);
  }
}

if (filesExtracted > 0) {
  console.log(`\nExtraction complete! ${filesExtracted} file(s) extracted to '${outputDir}'.`);
} else {
  console.log('\nNo files were found to extract. Make sure your source file contains properly formatted file markers.');
  console.log('Each file should start with a comment line like: // filename.ext');
}

// Special handling for the ChatGPT Logger Extension - create icons directory and placeholders if needed
const iconsDir = path.join(outputDir, 'icons');
if (filesExtracted > 0 && sourceCode.includes('ChatGPT Logger') && !fs.existsSync(iconsDir)) {
  console.log('\nDetected ChatGPT Logger Extension code. Creating icon placeholders...');
  
  // Create icons directory
  fs.mkdirSync(iconsDir, { recursive: true });
  
  // Create placeholder icon files
  const sizes = [16, 48, 128];
  sizes.forEach(size => {
    const iconPath = path.join(iconsDir, `icon${size}.png`);
    fs.writeFileSync(iconPath, '');
    console.log(`✓ Created placeholder: icons/icon${size}.png`);
  });
  
  console.log('\nNote: You need to replace the placeholder icon files with real PNG icons for the extension to work properly.');
}
