# File Extractor

A simple Node.js utility that extracts multiple files from a single source file. Perfect for sharing multi-file projects through code snippets, chat interfaces, or documentation.

## Installation

## Usage

```bash
node extract-files.js <source-file> [output-directory]
```

### Arguments

- `<source-file>`: Path to the file containing code for multiple files
- `[output-directory]`: (Optional) Directory where extracted files will be saved. Defaults to a directory named after the source file.

### Example

```bash
node extract-files.js chatgpt-logger.txt my-extension
```

This will extract all files from `chatgpt-logger.txt` into the `my-extension` directory.

## Source File Format

Your source file should follow this format:

```
// filename.ext
content of first file

// another-file.js
content of second file

// subfolder/nested-file.txt
content of nested file
```

Each file section starts with a comment line containing the file path (`// filename.ext`), followed by the file content, and then another file marker or the end of the file.

## Example

The repository includes `chatgpt-logger.txt` as an example source file containing a complete Chrome extension. Run this command to extract it:

```bash
node extract-files.js chatgpt-logger.txt
```

## License

MIT
