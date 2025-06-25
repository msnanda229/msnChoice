const API_KEY = "yEztbMI19Uh8O38BKDZyQipyF0O0AWhtdwqCjYOX";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "cohere_query") {
    fetch("https://api.cohere.ai/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "command-r",
        message: msg.prompt,
        temperature: 0.2,
        max_tokens: 150
      })
    })
      .then(res => res.json())
      .then(data => {
        const reply = data.text || data.reply || "No response";
        sendResponse({ answer: reply });
      })
      .catch(err => {
        sendResponse({ error: err.message });
      });
    return true; // Important to keep message channel open for async response
  }
});
