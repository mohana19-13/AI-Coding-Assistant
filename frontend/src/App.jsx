
import { useState, useEffect } from "react";
import "./App.css";

const USER_ID = 4;
const API = "http://127.0.0.1:8000";

const suggestions = [
  {
    icon: "🐍",
    title: "Generate Python Code",
    description: "Create Python programs with explanations.",
    prompt: "Write a Python program to reverse a string and explain each line."
  },
  {
    icon: "☕",
    title: "Learn Java",
    description: "Understand Java concepts with examples.",
    prompt: "Explain Java arrays with a simple example for a beginner."
  },
  {
    icon: "🗄️",
    title: "SQL Assistant",
    description: "Practice SQL queries and databases.",
    prompt: "Explain SQL joins with simple examples."
  },
  {
    icon: "🛠️",
    title: "Debug My Code",
    description: "Find errors and understand how to fix them.",
    prompt: "Explain common Python errors and how to debug them."
  }
];

// FORMAT AI RESPONSES AND CODE BLOCKS
function formatMessage(content) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const codeContent = part.slice(3, -3).replace(/^\r?\n/, "");
      const firstNewline = codeContent.indexOf("\n");

      let language = "code";
      let code = codeContent;

      if (firstNewline !== -1) {
        const firstLine = codeContent.slice(0, firstNewline).trim();

        if (/^[a-zA-Z0-9_+#.-]+$/.test(firstLine)) {
          language = firstLine;
          code = codeContent.slice(firstNewline + 1);
        }
      }

      return (
        <div key={index} className="code-block">
          <div className="code-header">
            <span>{language}</span>
          </div>

          <pre className="code-content">
            <code>{code.trim()}</code>
          </pre>
        </div>
      );
    }

    return part.trim() ? (
      <p key={index} className="message-text">
        {part.trim()}
      </p>
    ) : null;
  });
}

function App() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [historyError, setHistoryError] = useState("");
  const [activePage, setActivePage] = useState("chat");

  // AI AGENT STATE
  const [agentQuestion, setAgentQuestion] = useState("");
  const [agentAnswer, setAgentAnswer] = useState("");
  const [selectedTool, setSelectedTool] = useState("");
  const [agentSources, setAgentSources] = useState([]);
  const [agentLoading, setAgentLoading] = useState(false);

  // RAG DOCUMENT ASSISTANT STATE
  const [documentFile, setDocumentFile] = useState(null);
  const [documentInfo, setDocumentInfo] = useState(null);
  const [documentStatus, setDocumentStatus] = useState("");
  const [documentQuestion, setDocumentQuestion] = useState("");
  const [documentAnswer, setDocumentAnswer] = useState("");
  const [documentSources, setDocumentSources] = useState([]);
  const [documentLoading, setDocumentLoading] = useState(false);

  // LOAD ALL CONVERSATIONS
  const fetchHistory = async () => {
    try {
      const response = await fetch(
        `${API}/chat/conversations/user/${USER_ID}`
      );

      if (!response.ok) {
        throw new Error("Unable to load conversations");
      }

      const data = await response.json();

      setHistory(data);
      setHistoryError("");
    } catch (error) {
      console.error("History error:", error);
      setHistoryError("Unable to load history");
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // CREATE NEW CONVERSATION
  const createConversation = async (title) => {
    const response = await fetch(`${API}/chat/conversations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_id: USER_ID,
        title: title.slice(0, 45)
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Unable to create conversation");
    }

    return data.id;
  };

  // SEND MESSAGE TO AI
  const sendMessage = async (customQuestion) => {
    setActivePage("chat");

    const userQuestion = (customQuestion ?? question).trim();

    if (!userQuestion || loading) return;

    setMessages((previous) => [
      ...previous,
      {
        role: "user",
        text: userQuestion
      }
    ]);

    setQuestion("");
    setLoading(true);

    try {
      let conversationId = activeConversationId;

      if (!conversationId) {
        conversationId = await createConversation(userQuestion);

        setActiveConversationId(conversationId);
        await fetchHistory();
      }

      const response = await fetch(`${API}/chat/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          user_id: USER_ID,
          conversation_id: conversationId,
          question: userQuestion
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "AI request failed");
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "ai",
          text: data.answer
        }
      ]);

      await fetchHistory();

    } catch (error) {
      console.error("Chat error:", error);

      setMessages((previous) => [
        ...previous,
        {
          role: "ai",
          text: "Error: " + error.message
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // OPEN PREVIOUS CONVERSATION
  const openChat = async (conversation) => {
    if (loading) return;

    setLoading(true);

    try {
      const response = await fetch(
        `${API}/chat/conversations/${conversation.id}/messages`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to open conversation");
      }

      const loadedMessages = [];

      data.forEach((chat) => {
        loadedMessages.push({
          role: "user",
          text: chat.question
        });

        loadedMessages.push({
          role: "ai",
          text: chat.answer || ""
        });
      });

      setMessages(loadedMessages);
      setActivePage("chat");
      setActiveConversationId(conversation.id);
      setQuestion("");

    } catch (error) {
      console.error("Open chat error:", error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  // ASK AI FOR ANOTHER HINT
  const askForHint = () => {
    sendMessage(
      "Please give me one more small hint for the current programming problem. Do not reveal the complete code. Guide me step by step."
    );
  };

  // ASK AI TO SHOW COMPLETE SOLUTION
  const showSolution = () => {
    sendMessage(
      "Now show me the complete solution for the current programming problem. Explain the code step by step in simple English."
    );
  };

  // START NEW CHAT
  const startNewChat = () => {
    if (loading) return;

    setMessages([]);
    setActivePage("chat");
    setQuestion("");
    setActiveConversationId(null);
    setCopiedIndex(null);
  };

  // COPY COMPLETE AI ANSWER
  const copyAnswer = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);

      setCopiedIndex(index);

      setTimeout(() => {
        setCopiedIndex(null);
      }, 1800);

    } catch {
      alert("Unable to copy. Please copy manually.");
    }
  };

  // REFRESH HISTORY
  const refreshHistory = () => {
    fetchHistory();
  };

  // UPLOAD A PDF OR TXT DOCUMENT
  const uploadDocument = async () => {
    if (!documentFile || documentLoading) return;

    setDocumentLoading(true);
    setDocumentStatus("Uploading document...");
    setDocumentInfo(null);
    setDocumentAnswer("");
    setDocumentSources([]);

    try {
      const formData = new FormData();
      formData.append("file", documentFile);

      const response = await fetch(`${API}/documents/upload`, {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Document upload failed");
      }

      setDocumentInfo(data);
      setDocumentStatus("Document uploaded successfully!");

    } catch (error) {
      console.error("Document upload error:", error);
      setDocumentStatus("Upload error: " + error.message);
    } finally {
      setDocumentLoading(false);
    }
  };

  // ASK A QUESTION USING DOCUMENT CHUNKS
  const askDocument = async () => {
    if (!documentQuestion.trim() || !documentInfo || documentLoading) return;

    setDocumentLoading(true);
    setDocumentAnswer("");
    setDocumentSources([]);

    try {
      const response = await fetch(
        `${API}/documents/ask?question=${encodeURIComponent(documentQuestion)}`,
        { method: "POST" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to get an answer from the document"
        );
      }

      setDocumentAnswer(data.answer || "No answer was returned.");
      setDocumentSources(
        Array.isArray(data.sources) ? data.sources : []
      );

    } catch (error) {
      console.error("Document question error:", error);
      setDocumentAnswer("Error: " + error.message);
    } finally {
      setDocumentLoading(false);
    }
  };

  // ==========================================
  // AI AGENT - AUTOMATIC TOOL SELECTION
  // ==========================================
  const askAgent = async () => {
    if (!agentQuestion.trim() || agentLoading) return;

    setAgentLoading(true);
    setAgentAnswer("");
    setSelectedTool("");
    setAgentSources([]);

    try {
      const response = await fetch(`${API}/agent/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: agentQuestion.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "AI Agent request failed");
      }

      setAgentAnswer(data.answer || "No answer received.");
      setSelectedTool(data.selected_tool || "unknown");

      const uniqueSources = Array.isArray(data.sources)
        ? data.sources.filter((source, index, array) =>
            index === array.findIndex(
              (item) =>
                item.filename === source.filename &&
                item.page_number === source.page_number
            )
          )
        : [];

      setAgentSources(uniqueSources);

    } catch (error) {
      console.error("Agent error:", error);
      setAgentAnswer("Error: " + error.message);
    } finally {
      setAgentLoading(false);
    }
  };

  return (
    <div className="app">

      {/* SIDEBAR */}
      <aside className="sidebar">

        <div className="brand">
          <div className="brand-icon">⚡</div>

          <div>
            <h2>CodeAI</h2>
            <span>YOUR CODING PARTNER</span>
          </div>
        </div>

        <button
          className="new-chat"
          onClick={startNewChat}
          disabled={loading}
        >
          <span>＋</span> New Chat
        </button>

        {/* WORKSPACE */}
        <div className="sidebar-section">
          <p className="section-label">WORKSPACE</p>

          <button
            className={`nav-item ${activePage === "chat" ? "active" : ""}`}
            onClick={() => setActivePage("chat")}
          >
            <span>◈</span> AI Assistant
          </button>

          <button
            className={`nav-item ${activePage === "documents" ? "active" : ""}`}
            onClick={() => setActivePage("documents")}
          >
            <span>📄</span> Documents
          </button>

          {/* NEW AI AGENT NAVIGATION */}
          <button
            className={`nav-item ${activePage === "agent" ? "active" : ""}`}
            onClick={() => setActivePage("agent")}
          >
            <span>🤖</span> AI Agent
          </button>
        </div>

        {/* LANGUAGES */}
        <div className="sidebar-section">
          <p className="section-label">LANGUAGES</p>

          <button
            className="nav-item"
            onClick={() =>
              sendMessage("Teach me Python programming from beginner level.")
            }
            disabled={loading}
          >
            🐍 Python
          </button>

          <button
            className="nav-item"
            onClick={() =>
              sendMessage("Teach me Java programming from beginner level.")
            }
            disabled={loading}
          >
            ☕ Java
          </button>

          <button
            className="nav-item"
            onClick={() =>
              sendMessage("Teach me SQL from beginner level.")
            }
            disabled={loading}
          >
            🗄️ SQL
          </button>
        </div>

        {/* RECENT CHATS */}
        <div className="sidebar-section history-section">

          <div className="history-heading">
            <p className="section-label">RECENT CHATS</p>

            <button
              onClick={refreshHistory}
              disabled={loading}
              title="Refresh history"
            >
              ↻
            </button>
          </div>

          <div className="history-list">

            {historyError && (
              <p className="empty-history">{historyError}</p>
            )}

            {!historyError && history.length === 0 && (
              <p className="empty-history">
                No conversations yet
              </p>
            )}

            {history.map((conversation) => (
              <button
                key={conversation.id}
                className={`history-item ${
                  activeConversationId === conversation.id
                    ? "selected"
                    : ""
                }`}
                onClick={() => openChat(conversation)}
                title={conversation.title}
                disabled={loading}
              >
                <span>💬</span>

                <span className="history-question">
                  {conversation.title}
                </span>
              </button>
            ))}

          </div>
        </div>

        {/* PROFILE */}
        <div className="sidebar-bottom">

          <div className="profile-avatar">M</div>

          <div className="profile-info">
            <strong>Mohana</strong>
            <span>AI Developer</span>
          </div>

          <span className="online-dot"></span>

        </div>

      </aside>

      {/* MAIN DASHBOARD */}
      <main className="main">

        {/* TOPBAR */}
        <header className="topbar">

          <div>
            <span className="topbar-title">
              {activePage === "documents"
                ? "Document Assistant"
                : activePage === "agent"
                  ? "AI Agent"
                  : "AI Coding Assistant"}
            </span>

            <span className="topbar-subtitle">
              {activePage === "documents"
                ? "/ Documents"
                : activePage === "agent"
                  ? "/ Autonomous Workspace"
                  : "/ Workspace"}
            </span>
          </div>

          <div className="ai-status">
            <span className="status-dot"></span>
            AI Online
          </div>

        </header>

        {/* ======================================
            AI AGENT PAGE
        ====================================== */}
        {activePage === "agent" ? (

          <section
            className="content"
            style={{
              display: "block",
              padding: "28px 32px",
              overflowY: "auto"
            }}
          >

            <div
              style={{
                maxWidth: "900px",
                margin: "12px auto",
                padding: "28px",
                background: "#101b2d",
                border: "1px solid #294568",
                borderRadius: "16px",
                color: "#ffffff",
                boxShadow: "0 16px 40px rgba(0, 0, 0, 0.18)"
              }}
            >

              <div
                style={{
                  fontSize: "13px",
                  color: "#60a5fa",
                  fontWeight: 700,
                  letterSpacing: "1.5px"
                }}
              >
                INTELLIGENT TOOL SELECTION
              </div>

              <h1 style={{ margin: "10px 0 8px", fontSize: "28px" }}>
                🤖 AI Agent
              </h1>

              <p style={{ color: "#a9bdd5", lineHeight: 1.7 }}>
                Ask any question. The AI Agent automatically selects the
                appropriate tool: Coding Assistant or Document Search.
              </p>

              {/* AVAILABLE TOOLS */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "14px",
                  marginTop: "24px"
                }}
              >

                <div
                  style={{
                    padding: "18px",
                    background: "#0b1728",
                    border: "1px solid #294568",
                    borderRadius: "12px"
                  }}
                >
                  <div style={{ fontSize: "25px" }}>💻</div>

                  <h3 style={{ margin: "10px 0 6px" }}>
                    Coding Assistant
                  </h3>

                  <p style={{ color: "#9fb3cc", fontSize: "13px", lineHeight: 1.6 }}>
                    Answers Python, Java, SQL and programming questions.
                  </p>
                </div>

                <div
                  style={{
                    padding: "18px",
                    background: "#0b1728",
                    border: "1px solid #294568",
                    borderRadius: "12px"
                  }}
                >
                  <div style={{ fontSize: "25px" }}>📚</div>

                  <h3 style={{ margin: "10px 0 6px" }}>
                    Document Search
                  </h3>

                  <p style={{ color: "#9fb3cc", fontSize: "13px", lineHeight: 1.6 }}>
                    Searches uploaded PDF and TXT documents using RAG.
                  </p>
                </div>

              </div>

              {/* AGENT QUESTION */}
              <div style={{ marginTop: "28px" }}>

                <h3 style={{ marginBottom: "10px" }}>
                  Ask your AI Agent
                </h3>

                <textarea
                  value={agentQuestion}
                  onChange={(event) => setAgentQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      askAgent();
                    }
                  }}
                  placeholder="Example: Explain Python functions or What topics are covered in the uploaded document?"
                  disabled={agentLoading}
                  rows={4}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "15px",
                    borderRadius: "9px",
                    border: "1px solid #405570",
                    background: "#07111f",
                    color: "white",
                    resize: "vertical",
                    fontSize: "14px",
                    lineHeight: 1.6
                  }}
                />

                <button
                  type="button"
                  onClick={askAgent}
                  disabled={!agentQuestion.trim() || agentLoading}
                  style={{
                    marginTop: "14px",
                    padding: "12px 24px",
                    background:
                      !agentQuestion.trim() || agentLoading
                        ? "#334155"
                        : "#2563eb",
                    color: "white",
                    border: 0,
                    borderRadius: "8px",
                    cursor:
                      !agentQuestion.trim() || agentLoading
                        ? "not-allowed"
                        : "pointer",
                    fontWeight: 600
                  }}
                >
                  {agentLoading ? "Agent is working..." : "🤖 Ask AI Agent"}
                </button>

              </div>

              {/* LOADING */}
              {agentLoading && (
                <div
                  style={{
                    marginTop: "22px",
                    padding: "15px",
                    color: "#93c5fd",
                    background: "#0b1728",
                    borderRadius: "9px"
                  }}
                >
                  <span>⚙️</span> AI Agent is selecting and executing a tool.
                  Please wait...
                </div>
              )}

              {/* SELECTED TOOL */}
              {selectedTool && (
                <div
                  style={{
                    marginTop: "22px",
                    padding: "15px",
                    background: "#0b2b27",
                    border: "1px solid #166653",
                    borderRadius: "10px"
                  }}
                >

                  <strong style={{ color: "#86efac" }}>
                    ✓ Selected Tool
                  </strong>

                  <div
                    style={{
                      marginTop: "7px",
                      color: "#e2e8f0",
                      fontSize: "14px"
                    }}
                  >
                    {selectedTool === "document_search"
                      ? "📚 Document Search"
                      : selectedTool === "coding_assistant"
                        ? "💻 Coding Assistant"
                        : selectedTool}
                  </div>

                </div>
              )}

              {/* AGENT ANSWER */}
              {agentAnswer && (
                <div
                  style={{
                    marginTop: "22px",
                    padding: "20px",
                    background: "#07111f",
                    border: "1px solid #263e5b",
                    borderRadius: "10px",
                    lineHeight: 1.7
                  }}
                >

                  <strong style={{ color: "#93c5fd" }}>
                    ⚡ AI Agent Answer
                  </strong>

                  <div style={{ marginTop: "12px" }}>
                    {formatMessage(agentAnswer)}
                  </div>

                  {/* SOURCES */}
                  {agentSources.length > 0 && (
                    <div
                      style={{
                        marginTop: "22px",
                        paddingTop: "16px",
                        borderTop: "1px solid #263e5b"
                      }}
                    >

                      <strong style={{ color: "#93c5fd", fontSize: "14px" }}>
                        📚 Document Sources
                      </strong>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "10px",
                          marginTop: "12px"
                        }}
                      >

                        {agentSources.map((source, index) => (
                          <div
                            key={`${source.filename}-${source.page_number ?? "txt"}-${index}`}
                            style={{
                              padding: "10px 12px",
                              background: "#101b2d",
                              border: "1px solid #294568",
                              borderRadius: "9px"
                            }}
                          >

                            <div
                              style={{
                                color: "#e2e8f0",
                                fontSize: "13px",
                                fontWeight: 600
                              }}
                            >
                              📄 {source.filename}
                            </div>

                            <div
                              style={{
                                color: "#94a3b8",
                                fontSize: "12px",
                                marginTop: "4px"
                              }}
                            >
                              {source.page_number != null
                                ? `Page ${source.page_number}`
                                : "Text document"}
                            </div>

                          </div>
                        ))}

                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          </section>

        ) : activePage === "documents" ? (

          /* ======================================
             DOCUMENT ASSISTANT PAGE
          ====================================== */
          <section
            className="content"
            style={{
              display: "block",
              padding: "28px 32px",
              overflowY: "auto"
            }}
          >

            <div
              style={{
                maxWidth: "900px",
                margin: "12px auto",
                padding: "28px",
                background: "#101b2d",
                border: "1px solid #294568",
                borderRadius: "16px",
                color: "#ffffff",
                boxShadow: "0 16px 40px rgba(0, 0, 0, 0.18)"
              }}
            >

              <div style={{
                fontSize: "13px",
                color: "#60a5fa",
                fontWeight: 700,
                letterSpacing: "1.5px"
              }}>
                YOUR KNOWLEDGE WORKSPACE
              </div>

              <h1 style={{ margin: "10px 0 8px", fontSize: "28px" }}>
                📄 Document Assistant
              </h1>

              <p style={{ color: "#a9bdd5", lineHeight: 1.7, marginTop: 0 }}>
                Upload a PDF or TXT file and ask questions. CodeAI will find
                relevant information from your document.
              </p>

              {/* UPLOAD DOCUMENT */}
              <div
                style={{
                  marginTop: "24px",
                  padding: "24px",
                  border: "1px dashed #41658f",
                  borderRadius: "12px",
                  background: "#0b1728"
                }}
              >

                <div style={{ fontSize: "30px", marginBottom: "10px" }}>
                  ☁️
                </div>

                <h3 style={{ margin: "0 0 8px" }}>
                  Upload your document
                </h3>

                <p style={{ color: "#9fb3cc", fontSize: "13px", marginTop: 0 }}>
                  Supported formats: PDF and TXT
                </p>

                <div style={{
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginTop: "16px"
                }}>

                  <input
                    type="file"
                    accept=".pdf,.txt"
                    disabled={documentLoading}
                    onChange={(event) => {
                      setDocumentFile(event.target.files?.[0] || null);
                      setDocumentInfo(null);
                      setDocumentAnswer("");
                      setDocumentSources([]);
                      setDocumentStatus("");
                    }}
                    style={{ maxWidth: "100%", color: "#dbeafe" }}
                  />

                  <button
                    type="button"
                    onClick={uploadDocument}
                    disabled={!documentFile || documentLoading}
                    style={{
                      padding: "11px 20px",
                      background:
                        !documentFile || documentLoading
                          ? "#334155"
                          : "#2563eb",
                      color: "white",
                      border: 0,
                      borderRadius: "8px",
                      cursor:
                        !documentFile || documentLoading
                          ? "not-allowed"
                          : "pointer",
                      fontWeight: 600
                    }}
                  >
                    {documentLoading && !documentInfo
                      ? "Uploading..."
                      : "Upload Document"}
                  </button>

                </div>
              </div>

              {/* UPLOAD STATUS */}
              {documentStatus && (
                <p style={{
                  color: documentStatus.startsWith("Upload error")
                    ? "#fca5a5"
                    : "#93c5fd",
                  fontSize: "13px",
                  marginTop: "14px"
                }}>
                  {documentStatus}
                </p>
              )}

              {/* UPLOAD SUCCESS */}
              {documentInfo && (
                <div style={{
                  marginTop: "18px",
                  padding: "14px 16px",
                  borderRadius: "10px",
                  background: "#0b2b27",
                  border: "1px solid #166653"
                }}>

                  <div style={{ color: "#86efac", fontWeight: 600 }}>
                    ✓ Document uploaded successfully
                  </div>

                  <div style={{
                    color: "#cbd5e1",
                    fontSize: "13px",
                    marginTop: "6px"
                  }}>
                    {documentInfo.filename} · {documentInfo.total_chunks} text
                    chunks processed
                  </div>

                </div>
              )}

              {/* ASK DOCUMENT */}
              <div style={{ marginTop: "26px" }}>

                <h3 style={{ marginBottom: "8px" }}>
                  Ask your document
                </h3>

                <p style={{
                  color: "#9fb3cc",
                  fontSize: "13px",
                  marginTop: 0
                }}>
                  {documentInfo
                    ? "Enter a question about the uploaded file."
                    : "Upload a document first to enable questions."}
                </p>

                <div style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap"
                }}>

                  <input
                    type="text"
                    placeholder="e.g. What are the main topics in this document?"
                    value={documentQuestion}
                    onChange={(event) =>
                      setDocumentQuestion(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") askDocument();
                    }}
                    disabled={!documentInfo || documentLoading}
                    style={{
                      flex: 1,
                      minWidth: "220px",
                      padding: "13px",
                      borderRadius: "8px",
                      border: "1px solid #405570",
                      background: "#07111f",
                      color: "white"
                    }}
                  />

                  <button
                    type="button"
                    onClick={askDocument}
                    disabled={
                      !documentInfo ||
                      !documentQuestion.trim() ||
                      documentLoading
                    }
                    style={{
                      padding: "10px 20px",
                      background:
                        !documentInfo ||
                        !documentQuestion.trim() ||
                        documentLoading
                          ? "#334155"
                          : "#0d9488",
                      color: "white",
                      border: 0,
                      borderRadius: "8px",
                      cursor:
                        !documentInfo ||
                        !documentQuestion.trim() ||
                        documentLoading
                          ? "not-allowed"
                          : "pointer",
                      fontWeight: 600
                    }}
                  >
                    {documentLoading && documentInfo
                      ? "Thinking..."
                      : "Ask Document"}
                  </button>

                </div>
              </div>

              {documentLoading && (
                <p style={{
                  color: "#93c5fd",
                  fontSize: "13px",
                  marginTop: "14px"
                }}>
                  Please wait... processing your request.
                </p>
              )}

              {/* DOCUMENT ANSWER */}
              {documentAnswer && (
                <div style={{
                  marginTop: "22px",
                  padding: "18px",
                  background: "#07111f",
                  border: "1px solid #263e5b",
                  borderRadius: "10px",
                  whiteSpace: "pre-wrap",
                  lineHeight: "1.7"
                }}>

                  <strong style={{ color: "#93c5fd" }}>
                    AI Answer
                  </strong>

                  <div style={{ marginTop: "10px" }}>
                    {formatMessage(documentAnswer)}
                  </div>

                  {/* DOCUMENT SOURCES */}
                  {documentSources.length > 0 && (
                    <div style={{
                      marginTop: "22px",
                      paddingTop: "16px",
                      borderTop: "1px solid #263e5b"
                    }}>

                      <strong style={{
                        color: "#93c5fd",
                        fontSize: "14px"
                      }}>
                        📚 Sources
                      </strong>

                      <div style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "10px",
                        marginTop: "12px"
                      }}>

                        {documentSources.map((source, index) => (
                          <div
                            key={`${source.filename}-${source.page_number ?? "txt"}-${index}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              padding: "10px 12px",
                              background: "#101b2d",
                              border: "1px solid #294568",
                              borderRadius: "9px"
                            }}
                          >

                            <span style={{ fontSize: "20px" }}>📄</span>

                            <div>

                              <div style={{
                                color: "#e2e8f0",
                                fontSize: "13px",
                                fontWeight: 600
                              }}>
                                {source.filename}
                              </div>

                              <div style={{
                                color: "#94a3b8",
                                fontSize: "12px",
                                marginTop: "3px"
                              }}>
                                {source.page_number != null
                                  ? `Page ${source.page_number}`
                                  : "Text document"}
                              </div>

                            </div>
                          </div>
                        ))}

                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          </section>

        ) : (

          /* ======================================
             NORMAL CHAT PAGE
          ====================================== */
          <section className="content">

            {messages.length === 0 ? (

              <div className="welcome">

                <div className="welcome-badge">
                  ✦ YOUR PERSONAL AI DEVELOPER
                </div>

                <h1>
                  Build something<span> amazing.</span>
                </h1>

                <p className="welcome-description">
                  Your intelligent coding companion.
                  Generate code, understand concepts and debug errors
                  with simple explanations.
                </p>

                <div className="suggestion-heading">
                  ✦ What would you like to do today?
                </div>

                <div className="cards">

                  {suggestions.map((item) => (
                    <button
                      className="feature"
                      key={item.title}
                      onClick={() => sendMessage(item.prompt)}
                      disabled={loading}
                    >

                      <div className="feature-icon">
                        {item.icon}
                      </div>

                      <h3>{item.title}</h3>

                      <p>{item.description}</p>

                      <span className="feature-arrow">↗</span>

                    </button>
                  ))}

                </div>

                <div className="tip">
                  <span>💡</span>

                  <p>
                    Beginner tip: Ask questions in simple English.
                    I'll explain step by step.
                  </p>
                </div>

              </div>

            ) : (

              /* CHAT SCREEN */
              <div className="chat-area">

                <div className="chat-heading">

                  <h2>
                    {history.find(
                      (item) => item.id === activeConversationId
                    )?.title || "Your conversation"}
                  </h2>

                  <span>{messages.length} messages</span>

                </div>

                {messages.map((msg, index) => (

                  <div
                    key={index}
                    className={`message-row ${msg.role}`}
                  >

                    <div className="message-avatar">
                      {msg.role === "user" ? "M" : "⚡"}
                    </div>

                    <div className="message-content">

                      <div className="message-name">
                        {msg.role === "user" ? "You" : "CodeAI"}
                      </div>

                      <div className="message-bubble">
                        {msg.role === "ai" ? (
                          formatMessage(msg.text)
                        ) : (
                          <pre>{msg.text}</pre>
                        )}
                      </div>

                      {msg.role === "ai" && (
                        <div className="ai-action-buttons">

                          <button
                            className="copy-button"
                            onClick={() => copyAnswer(msg.text, index)}
                          >
                            {copiedIndex === index
                              ? "✓ Copied"
                              : "▢ Copy answer"}
                          </button>

                          <button
                            className="hint-button"
                            onClick={askForHint}
                            disabled={loading}
                          >
                            💡 Give Me a Hint
                          </button>

                          <button
                            className="solution-button"
                            onClick={showSolution}
                            disabled={loading}
                          >
                            ✓ Show Solution
                          </button>

                        </div>
                      )}

                    </div>

                  </div>

                ))}

                {/* AI LOADING */}
                {loading && (
                  <div className="message-row ai">

                    <div className="message-avatar">⚡</div>

                    <div className="message-content">

                      <div className="message-name">
                        CodeAI
                      </div>

                      <div className="thinking">
                        <span></span>
                        <span></span>
                        <span></span>
                        Thinking...
                      </div>

                    </div>

                  </div>
                )}

              </div>

            )}

          </section>
        )}

        {/* MESSAGE INPUT - CHAT PAGE ONLY */}
        {activePage === "chat" && (
          <div className="input-wrapper">

            <div className="input-area">

              <textarea
                placeholder="Ask CodeAI anything about programming..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={loading}
                rows={2}
              />

              <button
                className="send-button"
                onClick={() => sendMessage()}
                disabled={loading || !question.trim()}
              >
                {loading ? "..." : "↑"}
              </button>

            </div>

            <p className="input-hint">
              Enter to send · Shift + Enter for a new line
            </p>

          </div>
        )}

        {/* FOOTER */}
        <footer>
          Powered by <strong>FastAPI</strong> ·
          <strong> Ollama</strong> ·
          <strong> PostgreSQL</strong>
        </footer>

      </main>

    </div>
  );
}

export default App;
