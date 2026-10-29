"use strict";

const API_URL = "/ask";
const questionInput = document.getElementById("question");
const chatForm = document.getElementById("chatForm");
const sendBtn = document.getElementById("sendBtn");
const messages = document.getElementById("messages");
const welcome = document.getElementById("welcome");
const conversation = document.getElementById("conversation");
const historyNav = document.getElementById("history");
const historyEmpty = document.getElementById("historyEmpty");
const sidebar = document.getElementById("sidebar");
const mobileScrim = document.getElementById("mobileScrim");

let isLoading = false;
let currentConversationId = null;
let conversations = [];

function scrollToBottom() {
  requestAnimationFrame(() => {
    conversation.scrollTop = conversation.scrollHeight;
  });
}

function closeMobileSidebar() {
  sidebar.classList.remove("open");
  mobileScrim.classList.remove("visible");
}

function openConversationView() {
  welcome.hidden = true;
  conversation.classList.add("has-messages");
}

function addMessage(role, content, isError = false) {
  const article = document.createElement("article");
  article.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "Y" : "◈";
  avatar.setAttribute("aria-hidden", "true");

  const body = document.createElement("div");
  body.className = "message-content";

  const name = document.createElement("div");
  name.className = "message-name";
  name.textContent = role === "user" ? "You" : "Ollama";

  const text = document.createElement("div");
  text.className = "message-text";

  if (role === "assistant" && !isError && window.marked && window.DOMPurify) {
    const rendered = window.marked.parse(content || "", { gfm: true, breaks: false });
    text.innerHTML = window.DOMPurify.sanitize(rendered, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ["target", "rel"]
    });

    text.querySelectorAll("a").forEach(link => {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });

    text.querySelectorAll("pre > code").forEach(code => {
      if (window.hljs) window.hljs.highlightElement(code);
      const pre = code.parentElement;
      const langClass = [...code.classList].find(cls => cls.startsWith("language-"));
      const lang = langClass ? langClass.substring("language-".length) : "code";

      const toolbar = document.createElement("div");
      toolbar.className = "code-toolbar";
      const label = document.createElement("span");
      label.textContent = lang.toUpperCase();

      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "Copy code";
      copy.addEventListener("click", async () => {
        try {
          await copyText(code.textContent);
          copy.textContent = "Copied!";
        } catch {
          copy.textContent = "Copy unavailable";
        }
        window.setTimeout(() => copy.textContent = "Copy code", 1400);
      });

      toolbar.append(label, copy);
      pre.prepend(toolbar);
    });
  } else {
    // Safe fallback when CDN libraries are unavailable.
    text.textContent = content;
  }

  if (isError) text.classList.add("error-text");
  body.append(name, text);
  article.append(avatar, body);
  messages.append(article);
  scrollToBottom();

  return { article, body, text };
}

async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const area = document.createElement("textarea");
  area.value = value;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  const success = document.execCommand("copy");
  area.remove();
  if (!success) throw new Error("Clipboard copy failed");
}

function addCopyResponse(message) {
  const actions = document.createElement("div");
  actions.className = "message-actions";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "Copy response";
  copy.addEventListener("click", async () => {
    try {
      await copyText(message.text.textContent);
      copy.textContent = "Copied!";
    } catch {
      copy.textContent = "Copy unavailable";
    }
    window.setTimeout(() => copy.textContent = "Copy response", 1400);
  });
  actions.append(copy);
  message.body.append(actions);
}

function showTypingIndicator() {
  const article = document.createElement("article");
  article.className = "message assistant";
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = "◈";
  const body = document.createElement("div");
  body.className = "message-content";
  const name = document.createElement("div");
  name.className = "message-name";
  name.textContent = "Ollama";
  const typing = document.createElement("div");
  typing.className = "typing-row";
  typing.setAttribute("role", "status");
  typing.setAttribute("aria-label", "Ollama is generating a response");
  const dots = document.createElement("span");
  dots.className = "typing-dots";
  for (let i = 0; i < 3; i++) dots.append(document.createElement("span"));
  const label = document.createElement("span");
  label.textContent = "Thinking";
  typing.append(dots, label);
  body.append(name, typing);
  article.append(avatar, body);
  messages.append(article);
  scrollToBottom();
  return article;
}

function renderHistory() {
  historyNav.replaceChildren();
  if (conversations.length === 0) {
    historyNav.append(historyEmpty);
    historyEmpty.hidden = false;
    return;
  }
  historyEmpty.hidden = true;
  conversations.forEach(item => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item" + (item.id === currentConversationId ? " active" : "");
    button.textContent = item.title;
    button.title = item.title;
    button.addEventListener("click", () => {
      if (isLoading) return;
      loadConversation(item.id);
      closeMobileSidebar();
    });
    historyNav.append(button);
  });
}

function startNewConversation() {
  if (isLoading) return;
  currentConversationId = null;
  messages.replaceChildren();
  welcome.hidden = false;
  conversation.scrollTop = 0;
  questionInput.value = "";
  resizeInput();
  renderHistory();
  questionInput.focus();
  closeMobileSidebar();
}

function loadConversation(id) {
  const item = conversations.find(conversation => conversation.id === id);
  if (!item) return;
  currentConversationId = id;
  messages.replaceChildren();
  welcome.hidden = item.messages.length > 0 ? true : false;
  item.messages.forEach(message => {
    const rendered = addMessage(message.role, message.content, message.isError);
    if (message.role === "assistant" && !message.isError) addCopyResponse(rendered);
  });
  renderHistory();
  scrollToBottom();
}

function ensureConversation(question) {
  if (currentConversationId) {
    return conversations.find(item => item.id === currentConversationId);
  }
  const item = {
    id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
    title: question.length > 42 ? question.slice(0, 42) + "…" : question,
    messages: []
  };
  conversations.unshift(item);
  currentConversationId = item.id;
  renderHistory();
  return item;
}

async function askOllama(question) {
  if (isLoading || !question.trim()) return;

  isLoading = true;
  sendBtn.disabled = true;
  questionInput.disabled = true;
  openConversationView();

  const chat = ensureConversation(question);
  chat.messages.push({ role: "user", content: question });
  addMessage("user", question);
  const loading = showTypingIndicator();
  renderHistory();

  try {
    const url = `${API_URL}?question=${encodeURIComponent(question)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { "Accept": "text/plain" }
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `Request failed (HTTP ${response.status})`);
    }

    const answer = (await response.text()).trim();
    loading.remove();
    const content = answer || "The model returned an empty response.";
    chat.messages.push({ role: "assistant", content });
    const rendered = addMessage("assistant", content);
    addCopyResponse(rendered);
  } catch (error) {
    loading.remove();
    const message = error instanceof TypeError
      ? "Could not reach the Spring Boot server. Check that the application is running and try again."
      : `Unable to get a response: ${error.message}`;
    chat.messages.push({ role: "assistant", content: message, isError: true });
    addMessage("assistant", message, true);
    console.error("Ollama request failed:", error);
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    questionInput.disabled = false;
    questionInput.focus();
    scrollToBottom();
  }
}

function resizeInput() {
  questionInput.style.height = "auto";
  questionInput.style.height = Math.min(questionInput.scrollHeight, 180) + "px";
}

chatForm.addEventListener("submit", event => {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (!question || isLoading) return;
  questionInput.value = "";
  resizeInput();
  askOllama(question);
});

questionInput.addEventListener("input", resizeInput);
questionInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

document.querySelectorAll(".suggestion").forEach(button => {
  button.addEventListener("click", () => {
    questionInput.value = button.dataset.prompt || "";
    resizeInput();
    chatForm.requestSubmit();
  });
});

document.getElementById("newChat").addEventListener("click", startNewConversation);
document.getElementById("toggleSidebar").addEventListener("click", () => {
  if (window.matchMedia("(max-width: 680px)").matches) {
    sidebar.classList.toggle("open");
    mobileScrim.classList.toggle("visible", sidebar.classList.contains("open"));
  } else {
    sidebar.classList.toggle("collapsed");
  }
});
mobileScrim.addEventListener("click", closeMobileSidebar);

document.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    startNewConversation();
  }
});

questionInput.focus();
