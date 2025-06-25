(function () {
  let currentBox = null;
  let extensionValid = true;

  // Check if extension context is still valid
  function isExtensionContextValid() {
    try {
      // Try to access chrome.runtime
      if (!chrome || !chrome.runtime || !chrome.runtime.id) {
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // Periodically check extension context
  function checkExtensionContext() {
    if (!isExtensionContextValid()) {
      extensionValid = false;
      console.log('Extension context invalidated. Content script will stop functioning.');
      // Optionally show a notification to the user
      if (currentBox) {
        showBox("⚠️ Extension was reloaded. Please refresh this page to continue using the AI assistant.");
      }
      return false;
    }
    return true;
  }

  // Check context every 5 seconds
  setInterval(checkExtensionContext, 5000);

  // Ensure styles are injected after page load
  window.addEventListener("load", () => {
    if (!checkExtensionContext()) return;
    
    const style = document.createElement("style");
    style.innerHTML = `
      * {
        user-select: text !important;
        -webkit-user-select: text !important;
      }
    `;
    document.head.appendChild(style);
  });

  // Detect selection
  document.addEventListener("mouseup", () => {
    setTimeout(() => {
      // Early exit if extension context is invalid
      if (!extensionValid || !checkExtensionContext()) {
        return;
      }

      const sel = window.getSelection().toString().trim();
      if (!sel || sel.length < 5) return;

      const prompt = `You are a knowledgeable web development assistant. Read the question and return a short and accurate answer. If the question expects code, reply with the exact HTML, CSS, or JS code snippet only.\n\nQuestion:\n${sel}`;

      showBox("🧠 Thinking...");

      try {
        chrome.runtime.sendMessage({ type: "cohere_query", prompt }, (response) => {
          // Check for extension context invalidation
          if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message;
            
            if (errorMsg.includes("Extension context invalidated") || 
                errorMsg.includes("message port closed") ||
                errorMsg.includes("Receiving end does not exist")) {
              extensionValid = false;
              showBox("⚠️ Extension context lost. Please refresh the page and try again.");
              return;
            }
            
            showBox("❌ Error: " + errorMsg);
            return;
          }

          if (response?.error) {
            showBox("❌ " + response.error);
            return;
          }

          const answer = response.answer?.trim() || "No response";
          const sanitizedAnswer = sanitizeHTML(answer);
          showBox(`<strong>💡 Answer:</strong><br><br><pre style="white-space:pre-wrap;">${sanitizedAnswer}</pre>`);
        });
      } catch (err) {
        if (err.message.includes("Extension context invalidated")) {
          extensionValid = false;
          showBox("⚠️ Extension context lost. Please refresh the page.");
        } else {
          showBox("❌ Exception: " + err.message);
        }
      }
    }, 30);
  });

  // Basic HTML sanitization
  function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Display box
  function showBox(html) {
    removeBox();
    currentBox = document.createElement("div");
    currentBox.id = "ai-answer-box";
    currentBox.innerHTML = `
      <div id="ai-box-header" style="cursor:move;font-weight:bold;padding-bottom:8px;">
        🧠 AI Answer <span id="ai-close-btn" style="float:right;cursor:pointer">×</span>
      </div>
      <div>${html}</div>
    `;
    Object.assign(currentBox.style, {
      position: "fixed",
      top: "100px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#fff",
      padding: "16px",
      border: "1px solid #ccc",
      borderRadius: "8px",
      boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
      zIndex: "999999",
      width: "400px",
      maxWidth: "90vw",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      maxHeight: "70vh",
      overflow: "auto"
    });

    document.body.appendChild(currentBox);
    
    // Add close button functionality
    const closeBtn = document.getElementById("ai-close-btn");
    if (closeBtn) {
      closeBtn.onclick = removeBox;
    }

    // Make it draggable with proper cleanup
    makeDraggable(currentBox);

    // Auto-close after 30 seconds for error messages
    if (html.includes("⚠️") || html.includes("❌")) {
      setTimeout(() => {
        if (currentBox && currentBox.parentNode) {
          removeBox();
        }
      }, 30000);
    }
  }

  function makeDraggable(box) {
    const header = document.getElementById("ai-box-header");
    if (!header) return;

    let dragging = false, offsetX = 0, offsetY = 0;

    const handleMouseMove = (e) => {
      if (!dragging) return;
      e.preventDefault();
      box.style.left = `${e.clientX - offsetX}px`;
      box.style.top = `${e.clientY - offsetY}px`;
      box.style.transform = "";
    };

    const handleMouseUp = () => {
      dragging = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };

    header.addEventListener('mousedown', (e) => {
      dragging = true;
      const rect = box.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none'; // Prevent text selection while dragging
      e.preventDefault();
    });
  }

  function removeBox() {
    if (currentBox && currentBox.parentNode) {
      currentBox.remove();
      currentBox = null;
    }
  }

  // Handle page unload
  window.addEventListener('beforeunload', () => {
    removeBox();
  });

  // Initial context check
  checkExtensionContext();
})();