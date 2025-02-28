// manifest.json
{
  "manifest_version": 3,
  "name": "ChatGPT Logger",
  "version": "1.0",
  "description": "Captures ChatGPT requests and responses to a file",
  "permissions": ["storage", "downloads", "webRequest", "declarativeNetRequest"],
  "host_permissions": ["https://chat.openai.com/*"],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "content_scripts": [{
    "matches": ["https://chat.openai.com/*"],
    "js": ["content.js"]
  }]
}

// background.js
let conversations = {};
let isLoggingEnabled = true;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ isLoggingEnabled: true, conversations: {} });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveConversation") {
    const { conversationId, messages } = request;
    conversations[conversationId] = messages;
    chrome.storage.local.set({ conversations });
    sendResponse({ success: true });
  } else if (request.action === "getConversations") {
    chrome.storage.local.get("conversations", (data) => {
      sendResponse({ conversations: data.conversations || {} });
    });
    return true; // Indicate async response
  } else if (request.action === "exportConversation") {
    exportConversation(request.conversationId);
    sendResponse({ success: true });
  } else if (request.action === "exportAllConversations") {
    exportAllConversations();
    sendResponse({ success: true });
  } else if (request.action === "toggleLogging") {
    isLoggingEnabled = request.enabled;
    chrome.storage.local.set({ isLoggingEnabled });
    sendResponse({ success: true });
  } else if (request.action === "getLoggingStatus") {
    chrome.storage.local.get("isLoggingEnabled", (data) => {
      sendResponse({ isLoggingEnabled: data.isLoggingEnabled });
    });
    return true; // Indicate async response
  }
});

function exportConversation(conversationId) {
  chrome.storage.local.get("conversations", (data) => {
    const conversations = data.conversations || {};
    const conversation = conversations[conversationId];
    
    if (conversation) {
      const json = JSON.stringify(conversation, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      
      chrome.downloads.download({
        url: url,
        filename: `chatgpt-conversation-${conversationId}-${timestamp}.json`,
        saveAs: true
      });
    }
  });
}

function exportAllConversations() {
  chrome.storage.local.get("conversations", (data) => {
    const conversations = data.conversations || {};
    const json = JSON.stringify(conversations, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    
    chrome.downloads.download({
      url: url,
      filename: `chatgpt-all-conversations-${timestamp}.json`,
      saveAs: true
    });
  });
}

// content.js
let currentConversationId = null;
let messages = [];
let observer = null;

// Function to extract the current conversation ID from the URL
function getConversationIdFromUrl() {
  const match = window.location.href.match(/\/c\/([a-zA-Z0-9-]+)/);
  return match ? match[1] : null;
}

// Function to check if logging is enabled
async function isLoggingEnabled() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "getLoggingStatus" }, (response) => {
      resolve(response.isLoggingEnabled);
    });
  });
}

// Function to save the current conversation
async function saveConversation() {
  if (!currentConversationId || !messages.length) return;
  
  const enabled = await isLoggingEnabled();
  if (!enabled) return;
  
  chrome.runtime.sendMessage({
    action: "saveConversation",
    conversationId: currentConversationId,
    messages
  });
}

// Function to extract text content from ChatGPT messages
function extractMessageContent(element) {
  // Clone the element to avoid modifying the original
  const clone = element.cloneNode(true);
  
  // Remove any code blocks, buttons, or other non-text elements
  const codeBlocks = clone.querySelectorAll('pre, button');
  codeBlocks.forEach(block => {
    block.parentNode.removeChild(block);
  });
  
  return clone.textContent.trim();
}

// Function to process ChatGPT conversation
async function processConversation() {
  const enabled = await isLoggingEnabled();
  if (!enabled) return;
  
  const newConversationId = getConversationIdFromUrl();
  
  if (newConversationId !== currentConversationId) {
    // If we have an existing conversation, save it first
    if (currentConversationId && messages.length) {
      await saveConversation();
    }
    
    // Start a new conversation
    currentConversationId = newConversationId;
    messages = [];
  }
  
  // Find all message elements
  const messageElements = document.querySelectorAll('.text-base');
  
  // Process each message
  const newMessages = [];
  let isUser = true; // Alternating user/assistant messages
  
  messageElements.forEach(element => {
    const content = extractMessageContent(element);
    if (content) {
      newMessages.push({
        role: isUser ? 'user' : 'assistant',
        content: content,
        timestamp: new Date().toISOString()
      });
      isUser = !isUser;
    }
  });
  
  // Update messages if we have new ones
  if (newMessages.length > messages.length) {
    messages = newMessages;
    await saveConversation();
  }
}

// Initialize the observer to watch for DOM changes
function initObserver() {
  if (observer) {
    observer.disconnect();
  }
  
  observer = new MutationObserver((mutations) => {
    processConversation();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Initialize on page load
window.addEventListener('load', () => {
  initObserver();
  processConversation();
});

// Also process when URL changes (for single-page application)
let lastUrl = window.location.href;
new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    setTimeout(processConversation, 1000); // Small delay to let content load
  }
}).observe(document, { subtree: true, childList: true });

// popup.html
<!DOCTYPE html>
<html>
<head>
  <title>ChatGPT Logger</title>
  <style>
    body {
      width: 300px;
      padding: 10px;
      font-family: Arial, sans-serif;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    .toggle-container {
      display: flex;
      align-items: center;
    }
    .toggle {
      position: relative;
      display: inline-block;
      width: 40px;
      height: 20px;
      margin-left: 10px;
    }
    .toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: .4s;
      border-radius: 20px;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 2px;
      bottom: 2px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }
    input:checked + .slider {
      background-color: #2196F3;
    }
    input:checked + .slider:before {
      transform: translateX(20px);
    }
    button {
      display: block;
      width: 100%;
      padding: 8px;
      margin: 5px 0;
      background-color: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover {
      background-color: #45a049;
    }
    .conversation-list {
      max-height: 300px;
      overflow-y: auto;
      margin-top: 10px;
    }
    .conversation {
      padding: 8px;
      margin: 5px 0;
      background-color: #f1f1f1;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .export-button {
      background-color: #2196F3;
      padding: 4px 8px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>ChatGPT Logger</h2>
    <div class="toggle-container">
      <span>Logging:</span>
      <label class="toggle">
        <input type="checkbox" id="logging-toggle" checked>
        <span class="slider"></span>
      </label>
    </div>
  </div>
  
  <button id="export-all">Export All Conversations</button>
  
  <h3>Saved Conversations</h3>
  <div id="conversation-list" class="conversation-list">
    <!-- Conversations will be listed here -->
  </div>
  
  <script src="popup.js"></script>
</body>
</html>

// popup.js
document.addEventListener('DOMContentLoaded', function() {
  const loggingToggle = document.getElementById('logging-toggle');
  const exportAllButton = document.getElementById('export-all');
  const conversationList = document.getElementById('conversation-list');
  
  // Initialize the logging toggle
  chrome.runtime.sendMessage({ action: "getLoggingStatus" }, (response) => {
    loggingToggle.checked = response.isLoggingEnabled;
  });
  
  // Toggle logging on/off
  loggingToggle.addEventListener('change', () => {
    chrome.runtime.sendMessage({ 
      action: "toggleLogging", 
      enabled: loggingToggle.checked 
    });
  });
  
  // Export all conversations
  exportAllButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "exportAllConversations" });
  });
  
  // Load and display saved conversations
  function loadConversations() {
    chrome.runtime.sendMessage({ action: "getConversations" }, (response) => {
      const conversations = response.conversations || {};
      conversationList.innerHTML = '';
      
      if (Object.keys(conversations).length === 0) {
        conversationList.innerHTML = '<p>No conversations saved yet.</p>';
        return;
      }
      
      for (const [id, messages] of Object.entries(conversations)) {
        const div = document.createElement('div');
        div.className = 'conversation';
        
        const firstMessage = messages.find(m => m.role === 'user');
        const preview = firstMessage ? 
          firstMessage.content.substring(0, 30) + (firstMessage.content.length > 30 ? '...' : '') : 
          'Conversation ' + id.substring(0, 8);
        
        div.innerHTML = `
          <span>${preview}</span>
          <button class="export-button" data-id="${id}">Export</button>
        `;
        
        conversationList.appendChild(div);
      }
      
      // Add event listeners to export buttons
      document.querySelectorAll('.export-button').forEach(button => {
        button.addEventListener('click', () => {
          const conversationId = button.getAttribute('data-id');
          chrome.runtime.sendMessage({ 
            action: "exportConversation", 
            conversationId 
          });
        });
      });
    });
  }
  
  // Load conversations when popup opens
  loadConversations();
});

// readme.md
# ChatGPT Logger Extension

This browser extension captures and saves conversations from the ChatGPT website, allowing you to export them to files.

## Features

- Automatically logs all conversations from chat.openai.com
- Toggle logging on/off via the popup interface
- Export individual conversations or all conversations at once as JSON files
- Simple user interface with conversation previews

## Installation

1. Download or clone this repository
2. Open Chrome or Edge and go to the extensions page (chrome://extensions or edge://extensions)
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the folder containing the extension files

## How It Works

- The extension uses a content script to monitor the ChatGPT webpage
- It captures user messages and ChatGPT responses by observing DOM changes
- Conversations are stored locally in the browser's storage
- You can access saved conversations and export them through the popup interface

## Privacy

This extension respects your privacy:
- All data is stored locally on your device
- No data is sent to external servers
- You can delete conversations at any time

## License

MIT
