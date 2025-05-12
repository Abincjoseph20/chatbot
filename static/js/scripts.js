// Helper function to get CSRF token
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// DOM elements
const chatContainer = document.getElementById('chat-container');
const chatForm = document.getElementById('chat-form');
const questionInput = document.getElementById('question');
const fileInput = document.getElementById('file-input');
const fileUploadBtn = document.getElementById('file-upload-btn');
const filePreviewContainer = document.getElementById('file-preview-container');
const errorContainer = document.getElementById('error-container');
const submitBtn = document.getElementById('submit-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const sidebar = document.getElementById('sidebar');
const historyContainer = document.getElementById('history-container');
const activeSessionIdInput = document.getElementById('active-session-id');
const voiceInputBtn = document.getElementById('voice-input-btn');
const speakerBtn = document.getElementById('speaker-btn');
const openSidebarBtn = document.getElementById('open-sidebar');
const closeSidebarBtn = document.getElementById('close-sidebar');
const userProfile = document.querySelector('.user-profile');

// Speech recognition and synthesis
let recognition;
let isRecording = false;
let speechSynthesis = window.speechSynthesis || null;

// Check if browser supports Web Speech API
const isSpeechSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
const isSynthesisSupported = 'speechSynthesis' in window;

// SVG templates
const userAvatarSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
</svg>`;

const botAvatarSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 2a10 10 0 0 0-7.743 16.33"></path>
    <path d="M12 2a10 10 0 0 1 7.743 16.33"></path>
    <path d="M8 16l-2-2 2-2"></path>
    <path d="M16 16l2-2-2-2"></path>
</svg>`;

const speakerSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
</svg>`;

// State management
let activeSessionId = activeSessionIdInput.value || null;

// Initialize chat and speech recognition
document.addEventListener('DOMContentLoaded', async () => {
    await loadSessions();
    if (activeSessionId) {
        await loadSessionMessages(activeSessionId);
    }

    if (isSpeechSupported) {
        initializeSpeechRecognition();
    } else {
        voiceInputBtn.style.display = 'none';
    }

    if (!isSynthesisSupported) {
        speakerBtn.style.display = 'none';
    }
});

// Initialize speech recognition
function initializeSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        questionInput.value = transcript;
        submitBtn.classList.add('active');
        questionInput.placeholder = 'Message Thara Chat...';
    };

    recognition.onerror = function(event) {
        console.error('Speech recognition error', event.error);
        showError('Speech recognition error: ' + event.error);
        voiceInputBtn.classList.remove('recording');
        isRecording = false;
        questionInput.placeholder = 'Message Thara Chat...';
    };

    recognition.onend = function() {
        if (isRecording) {
            recognition.start();
        } else {
            voiceInputBtn.classList.remove('recording');
            questionInput.placeholder = 'Message Thara Chat...';
        }
    };
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

// Load all sessions
async function loadSessions() {
    try {
        const response = await fetch('/get-sessions/');
        const data = await response.json();
        
        historyContainer.innerHTML = '';
        data.sessions.forEach(session => {
            const sessionItem = document.createElement('div');
            sessionItem.className = `history-item ${session.id === activeSessionId ? 'active' : ''}`;
            sessionItem.dataset.sessionId = session.id;
            sessionItem.textContent = session.title;
            sessionItem.addEventListener('click', handleSessionClick);
            historyContainer.appendChild(sessionItem);
        });
    } catch (error) {
        showError('Failed to load chat history');
    }
}

// Handle session click
async function handleSessionClick() {
    const sessionId = this.dataset.sessionId;
    activeSessionId = sessionId;
    activeSessionIdInput.value = sessionId;
    
    await loadSessionMessages(sessionId);
    document.querySelectorAll('.history-item').forEach(item => {
        item.classList.remove('active');
    });
    this.classList.add('active');
}

// Load messages for a session
async function loadSessionMessages(sessionId) {
    try {
        const response = await fetch(`/get-messages/${sessionId}/`);
        const data = await response.json();
        
        chatContainer.innerHTML = '';
        data.messages.forEach(msg => {
            addMessageToChat(msg.user_query, 'user');
            addMessageToChat(msg.bot_response, 'bot');
        });
        chatContainer.scrollTop = chatContainer.scrollHeight;
    } catch (error) {
        showError('Failed to load messages');
    }
}

// Add message to chat UI
function addMessageToChat(content, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.innerHTML = `
        <div class="message-avatar ${sender}-avatar">
            ${sender === 'user' ? userAvatarSVG : botAvatarSVG}
        </div>
        <div class="message-content">
            <p>${content}</p>
            ${sender === 'bot' ? `
                <button class="message-speaker" data-message="${content}">
                    ${speakerSVG}
                </button>
            ` : ''}
        </div>
    `;
    chatContainer.appendChild(messageDiv);
}

// Create typing indicator element
function createTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'message';
    div.innerHTML = `
        <div class="message-avatar bot-avatar">
            ${botAvatarSVG}
        </div>
        <div class="message-content">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    return div;
}

// Handle form submission
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData();
    const question = questionInput.value.trim();
    const file = fileInput.files[0];

    if (!question && !file) {
        showError('Please enter a question or upload a file');
        return;
    }

    // Add loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<div class="spinner"></div>`;

    // Add user message to UI immediately
    if (question) addMessageToChat(question, 'user');
    if (file) addMessageToChat(`Uploaded file: ${file.name}`, 'user');

    // Add typing indicator
    const typingIndicator = createTypingIndicator();
    chatContainer.appendChild(typingIndicator);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Prepare form data
    formData.append('session_id', activeSessionId);
    if (question) formData.append('question', question);
    if (file) formData.append('document', file);

    try {
        const response = await fetch('/chat/', {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
            }
        });

        if (!response.ok) throw new Error('Request failed');
        
        const data = await response.json();
        typingIndicator.remove();

        // Update session title if changed
        if (data.session_title) {
            const activeSessionItem = document.querySelector(`.history-item[data-session-id="${activeSessionId}"]`);
            if (activeSessionItem) {
                activeSessionItem.textContent = data.session_title;
            }
        }

        // Add bot response
        addMessageToChat(data.response, 'bot');
        chatContainer.scrollTop = chatContainer.scrollHeight;

    } catch (error) {
        showError(error.message);
        typingIndicator.remove();
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `Send`;
        questionInput.value = '';
        fileInput.value = '';
        filePreviewContainer.innerHTML = '';
    }
});

// Handle new chat creation
newChatBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/new-session/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        const data = await response.json();
        if (data.session_id) {
            activeSessionId = data.session_id;
            activeSessionIdInput.value = data.session_id;
            chatContainer.innerHTML = '';
            await loadSessions();
        }
    } catch (error) {
        showError('Failed to create new session');
    }
});

// Handle file upload button click
fileUploadBtn.addEventListener('click', function() {
    fileInput.click();
});

// Handle file selection
fileInput.addEventListener('change', function() {
    filePreviewContainer.innerHTML = '';
    errorContainer.style.display = 'none';
    
    if (this.files.length > 0) {
        const file = this.files[0];
        
        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            showError('File size too large (max 10MB)');
            this.value = '';
            return;
        }
        
        const filePreview = document.createElement('div');
        filePreview.className = 'file-preview';
        
        // Get appropriate icon based on file type
        let fileIcon;
        if (file.type.startsWith('image/')) {
            fileIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
            </svg>`;
        } else if (file.type.includes('pdf')) {
            fileIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <path d="M10 15v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1z"></path>
            </svg>`;
        } else if (file.type.includes('word') || file.type.includes('document')) {
            fileIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <path d="M16 13H8"></path>
                <path d="M16 17H8"></path>
                <path d="M10 9H8"></path>
            </svg>`;
        } else {
            fileIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
            </svg>`;
        }
        
        filePreview.innerHTML = `
            ${fileIcon}
            <span>${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)</span>
            <button class="remove-file-btn" type="button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
        
        // Add remove file functionality
        const removeBtn = filePreview.querySelector('.remove-file-btn');
        removeBtn.addEventListener('click', function() {
            fileInput.value = '';
            filePreviewContainer.innerHTML = '';
            if (!questionInput.value.trim()) {
                submitBtn.classList.remove('active');
            }
        });
        
        filePreviewContainer.appendChild(filePreview);
        submitBtn.classList.add('active');
    }
});

// Handle voice input
voiceInputBtn.addEventListener('click', function() {
    if (!isSpeechSupported) {
        showError('Speech recognition not supported in your browser');
        return;
    }
    
    if (isRecording) {
        recognition.stop();
        isRecording = false;
        this.classList.remove('recording');
    } else {
        try {
            recognition.start();
            isRecording = true;
            this.classList.add('recording');
            questionInput.placeholder = 'Listening...';
            
            // Set timeout to stop listening after 10 seconds
            setTimeout(() => {
                if (isRecording) {
                    recognition.stop();
                    isRecording = false;
                    this.classList.remove('recording');
                    questionInput.placeholder = 'Message Thara Chat...';
                }
            }, 10000);
        } catch (error) {
            console.error('Speech recognition error:', error);
            showError('Error starting speech recognition');
            this.classList.remove('recording');
            isRecording = false;
            questionInput.placeholder = 'Message Thara Chat...';
        }
    }
});

// Handle speaker buttons
speakerBtn.addEventListener('click', function() {
    if (!isSynthesisSupported) {
        showError('Text-to-speech not supported in your browser');
        return;
    }
    
    const messages = document.querySelectorAll('.message-content p');
    if (messages.length === 0) return;
    
    const lastBotMessage = Array.from(messages).reverse().find(p => 
        p.closest('.message').querySelector('.bot-avatar')
    );
    
    if (lastBotMessage) {
        speakMessage(lastBotMessage.textContent);
    }
});

// Speaker functionality for individual messages
document.addEventListener('click', (e) => {
    if (e.target.closest('.message-speaker')) {
        const message = e.target.closest('.message-speaker').dataset.message;
        speakMessage(message);
    }
});

// Text-to-speech
function speakMessage(message) {
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    speechSynthesis.speak(utterance);
}

// Sidebar toggle functionality
openSidebarBtn.addEventListener('click', function() {
    sidebar.classList.add('visible');
});

closeSidebarBtn.addEventListener('click', function() {
    sidebar.classList.remove('visible');
});

// Handle window resize for mobile sidebar
window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
        sidebar.classList.remove('visible');
    }
});

// Toggle submit button active state based on input
questionInput.addEventListener('input', function() {
    if (this.value.trim() || fileInput.files.length > 0) {
        submitBtn.classList.add('active');
    } else {
        submitBtn.classList.remove('active');
    }
});

// Handle profile click
if (userProfile) {
    userProfile.addEventListener('click', function(e) {
        // Prevent triggering if clicking on login/logout link
        if (e.target.tagName === 'A') return;
        
        // You can expand this to show a dropdown with more options
        console.log('Profile clicked');
    });
}