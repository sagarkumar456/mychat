// app.js - Client-side JavaScript

document.addEventListener('DOMContentLoaded', () => {
    const loginScreen = document.getElementById('loginScreen');
    const usernameInput = document.getElementById('usernameInput');
    const passwordInput = document.getElementById('passwordInput');
    const loginBtn = document.getElementById('loginBtn');
    const loginMessage = document.getElementById('loginMessage');
    
    const chatApp = document.getElementById('chatApp');
    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const imageInput = document.getElementById('imageInput');
    const imageUploadBtn = document.getElementById('imageUploadBtn');
    const loggedInUserSpan = document.getElementById('loggedInUser');

    let username = '';
    let socket; // This will hold our WebSocket connection

    // --- Login Logic ---
    async function handleLogin() {
        username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            loginMessage.textContent = 'Please enter username and password.';
            return;
        }

        try {
            // Send login credentials to Flask backend
            const response = await fetch('http://localhost:5000/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                loginMessage.textContent = ''; // Clear any previous error
                loginScreen.style.display = 'none';
                chatApp.style.display = 'flex';
                loggedInUserSpan.textContent = `Logged in as: ${username}`;
                connectToServer(username); // Connect to the Socket.IO server
            } else {
                loginMessage.textContent = data.message;
            }
        } catch (error) {
            console.error('Login error:', error);
            loginMessage.textContent = 'Network error or server unreachable.';
        }
    }

    loginBtn.addEventListener('click', handleLogin);
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            passwordInput.focus(); // Move to password input
        }
    });
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });

    // --- WebSocket Connection ---
    function connectToServer(user) {
        // Connect to the Socket.IO server
        socket = io('http://localhost:5000', { // Ensure port matches Flask server
            auth: { username: user }, // Send username on connection
            transports: ['websocket', 'polling'] // Prioritize websockets
        });

        // --- Socket.IO Event Listeners ---
        socket.on('connect', () => {
            console.log('Connected to server with ID:', socket.id);
            // Tell the server this socket belongs to this username
            socket.emit('register_user', { username: user });
            addSystemMessage(`You joined the chat as ${user}.`);
        });

        socket.on('disconnect', () => {
            addSystemMessage('You have been disconnected.');
            console.log('Disconnected from server.');
        });

        socket.on('connect_error', (err) => {
            console.error('Connection Error:', err.message);
            addSystemMessage('Could not connect to chat server. Please check server.');
        });

        // Handle incoming messages (text or image)
        socket.on('new_message', (data) => {
            addMessage(data.username, data.message, data.type === 'image', data.timestamp, data.username === username);
        });

        // Handle initial load of old messages
        socket.on('load_messages', (msgs) => {
            msgs.forEach(msg => {
                addMessage(msg.username, msg.message, msg.type === 'image', msg.timestamp, msg.username === username);
            });
        });

        // Handle system messages (user joined/left)
        socket.on('system_message', (msg) => {
            addSystemMessage(msg);
        });

        // --- WebRTC Signaling (Conceptual - requires more setup) ---
        // socket.on('webrtc_offer', (data) => { /* Handle incoming offer */ });
        // socket.on('webrtc_answer', (data) => { /* Handle incoming answer */ });
        // socket.on('webrtc_ice_candidate', (data) => { /* Handle incoming ICE candidate */ });
    }

    // --- Chat Message Display Logic ---
    function addMessage(senderUsername, messageContent, isImage = false, timestamp = new Date().toISOString(), isSelf = false) {
        const messageContainer = document.createElement('div');
        messageContainer.classList.add('message-container');
        if (isSelf) {
            messageContainer.classList.add('self');
        }

        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message-bubble');

        if (isImage) {
            const img = document.createElement('img');
            img.src = messageContent; // messageContent is the base64 Data URL
            img.alt = 'Uploaded Image';
            img.onload = () => chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll after image loads
            img.addEventListener('click', () => {
                window.open(img.src, '_blank'); // Open image in new tab
            });
            messageBubble.appendChild(img);
        } else {
            const textNode = document.createTextNode(messageContent);
            messageBubble.appendChild(textNode);
        }

        const usernameSpan = document.createElement('div');
        usernameSpan.classList.add('message-username');
        usernameSpan.textContent = isSelf ? 'You' : senderUsername; // Show "You" for self messages

        const timestampSpan = document.createElement('div');
        timestampSpan.classList.add('message-timestamp');
        const date = new Date(timestamp);
        timestampSpan.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // e.g., "10:30 AM"

        messageContainer.appendChild(messageBubble);
        // Append username and timestamp depending on self/other for WhatsApp style
        if (isSelf) {
             messageBubble.prepend(usernameSpan); // For "You" on self messages
             messageContainer.appendChild(timestampSpan);
        } else {
            messageBubble.prepend(usernameSpan);
            messageContainer.appendChild(timestampSpan);
        }
        
        chatMessages.appendChild(messageContainer);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll to bottom
    }

    function addSystemMessage(message) {
        const systemMessageDiv = document.createElement('div');
        systemMessageDiv.classList.add('message-container'); // Reusing container for centering
        systemMessageDiv.style.justifyContent = 'center'; // Center system messages
        systemMessageDiv.innerHTML = `<span style="font-size:0.8em; color: #bbb; text-align:center; padding: 5px 10px; background: rgba(0,0,0,0.1); border-radius: 5px; margin-top: 5px;">${message}</span>`;
        chatMessages.appendChild(systemMessageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // --- Sending Messages ---
    sendMessageBtn.addEventListener('click', () => {
        const message = messageInput.value.trim();
        if (message && socket) {
            socket.emit('message', { username: username, message: message, type: 'text' });
            messageInput.value = ''; // Clear input
        }
    });

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessageBtn.click();
        }
    });

    // --- Image Upload Logic ---
    imageUploadBtn.addEventListener('click', () => {
        imageInput.click(); // Trigger file input click
    });

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && socket) {
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file.');
                return;
            }
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                alert('Image size exceeds 5MB limit.');
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const imageDataUrl = event.target.result; // Base64 Data URL
                socket.emit('message', { username: username, message: imageDataUrl, type: 'image' });
                imageInput.value = ''; // Clear file input
            };
            reader.readAsDataURL(file);
        }
    });

    // --- Audio/Video Call (Highly Conceptual) ---
    // Requires WebRTC implementation.
    // This involves:
    // 1. Getting user media (microphone, camera).
    // 2. Creating RTCPeerConnection.
    // 3. Exchanging SDP offers/answers via Socket.IO.
    // 4. Exchanging ICE candidates via Socket.IO.
    // 5. Adding remote streams to video/audio elements.
    // Example (very basic placeholder):
    // const audioCallBtn = document.getElementById('audioCallBtn');
    // if (audioCallBtn) {
    //     audioCallBtn.addEventListener('click', async () => {
    //         alert('Audio call feature is complex and not fully implemented here.');
    //         // Implement WebRTC signaling to connect users
    //         // let localStream;
    //         // try {
    //         //     localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    //         //     // Setup peer connection, add tracks, exchange SDP/ICE via socket.emit
    //         // } catch (error) {
    //         //     console.error("Error accessing media devices.", error);
    //         // }
    //     });
    // }
});