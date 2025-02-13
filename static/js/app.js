document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded');
    
    // Add styles for error container
    const style = document.createElement('style');
    style.textContent = `
        .error-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 2rem;
            color: var(--text-color);
        }
        
        .error-container svg {
            color: var(--danger-color);
            margin-bottom: 1rem;
        }
        
        .error-container h4 {
            font-size: 1.25rem;
            margin-bottom: 1rem;
            color: var(--danger-color);
        }
        
        .error-container p {
            margin-bottom: 0.5rem;
        }
        
        .error-container ul {
            list-style: none;
            padding: 0;
            margin-bottom: 1.5rem;
        }
        
        .error-container li {
            margin: 0.5rem 0;
            color: var(--text-secondary);
        }
        
        .error-container .button {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
            background: var(--primary-color);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s;
        }
        
        .error-container .button:hover {
            background: var(--primary-color-dark);
        }
        
        .error-container .button svg {
            color: currentColor;
            margin: 0;
        }
        
        .verification-link-button {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background: var(--primary-color);
            color: white;
            border: none;
            border-radius: 4px;
            text-decoration: none;
            font-size: 0.9rem;
            transition: all 0.2s ease-out;
            position: relative;
            max-width: 100%;
            overflow: hidden;
        }
        
        .verification-link-button:hover {
            background: var(--primary-color-dark);
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .verification-link-button:active {
            transform: translateY(0);
        }
        
        .verification-link-button svg {
            width: 16px;
            height: 16px;
            color: currentColor;
            flex-shrink: 0;
        }
        
        .verification-link-button span {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        /* Tooltip styles */
        .verification-link-button[title]:hover::after {
            content: attr(title);
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            padding: 0.5rem;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            border-radius: 4px;
            font-size: 0.8rem;
            white-space: nowrap;
            z-index: 1000;
            margin-bottom: 0.5rem;
            animation: fadeIn 0.2s ease-out;
        }
        
        .verification-link-button[title]:hover::before {
            content: '';
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            border: 6px solid transparent;
            border-top-color: rgba(0, 0, 0, 0.8);
            margin-bottom: -0.5rem;
            animation: fadeIn 0.2s ease-out;
        }
        
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(5px) translateX(-50%);
            }
            to {
                opacity: 1;
                transform: translateY(0) translateX(-50%);
            }
        }
        
        .verification-links {
            display: flex;
            gap: 0.5rem;
            align-items: center;
            flex-wrap: wrap;
        }
        
        .verification-links-container {
            margin: 1rem 0;
            padding: 1rem;
            background: var(--background-secondary);
            border-radius: 4px;
        }
        
        .verification-links-title {
            margin: 0 0 0.5rem 0;
            font-size: 1rem;
            color: var(--text-color);
        }
        
        .verification-link-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin: 0.25rem 0;
        }
    `;
    document.head.appendChild(style);
    
    // Utility function to escape HTML special characters
    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    const currentEmailElement = document.getElementById('currentEmail');
    const messageList = document.getElementById('messageList');
    const messageCount = document.getElementById('messageCount');
    const loadingIndicator = document.getElementById('loading');
    const emailLoadingIndicator = document.getElementById('emailLoading');
    
    let currentEmail = localStorage.getItem('currentEmail');
    let messages = JSON.parse(localStorage.getItem('messages') || '[]')
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    let autoRefreshInterval = null;
    
    // Initialize from localStorage if exists
    if (currentEmail) {
        currentEmailElement.textContent = currentEmail;
        renderMessages(messages);
        updateMessageCount(messages.length);
        startAutoRefresh();
        // Тихая проверка сообщений без полноэкранной загрузки
        loadMessages(currentEmail, true);
    } else {
    createEmail();
    }
    
    // Create email account
    async function createEmail() {
        try {
            showEmailLoading();
            
            const response = await fetch('/api/email/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    service: 'temp-mail'
                }),
            });
            
            console.log('Response status:', response.status);
            
            const data = await response.json();
            console.log('Response data:', data);
            
            if (!response.ok) {
                currentEmailElement.textContent = 'Сервис временно перегружен, попробуйте через пару минут';
                currentEmailElement.style.color = 'var(--danger-color)';
                throw new Error(data.detail || 'Не удалось создать почтовый ящик');
            }
            
            currentEmail = data.email;
            localStorage.setItem('currentEmail', currentEmail);
            currentEmailElement.textContent = currentEmail;
            currentEmailElement.style.color = ''; // Сбрасываем цвет
            
            // Clear messages for new email
            messages = [];
            localStorage.setItem('messages', JSON.stringify(messages));
            renderMessages(messages);
            updateMessageCount(0);
            
            // Start auto-refresh
            startAutoRefresh();
            
            showSuccess('Создан новый почтовый ящик');
            
        } catch (error) {
            console.error('Error:', error);
            if (!currentEmailElement.textContent.includes('Сервис временно перегружен')) {
                currentEmailElement.textContent = 'Сервис временно перегружен, попробуйте через пару минут';
                currentEmailElement.style.color = 'var(--danger-color)';
            }
            showError(error.message);
        } finally {
            hideEmailLoading();
        }
    }
    
    // Copy email to clipboard
    window.copyEmail = async () => {
        if (currentEmail) {
            try {
                await navigator.clipboard.writeText(currentEmail);
                
                // Create and show beautiful notification
                const notification = document.createElement('div');
                notification.className = 'notification';
                notification.innerHTML = `
                    <div class="notification-content">
                        <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                            <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                            <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                        </svg>
                        <span>Email скопирован в буфер обмена</span>
                    </div>
                `;
                
                document.body.appendChild(notification);
                
                // Remove notification after animation
                setTimeout(() => {
                    notification.style.animation = 'fadeOut 0.5s ease-out forwards';
                    setTimeout(() => notification.remove(), 500);
                }, 3000);
                
            } catch (err) {
                showError('Не удалось скопировать email');
            }
        }
    };
    
    // Refresh messages
    window.refreshMessages = () => {
        if (currentEmail) {
            loadMessages(currentEmail);
        }
    };
    
    // Delete email
    window.deleteEmail = async () => {
        if (currentEmail) {
            if (!confirm('Вы уверены, что хотите удалить этот почтовый ящик?')) {
                return;
            }
            
            try {
                showLoading();
                
                // Сначала попробуем удалить почтовый ящик
                const response = await fetch(`/api/email/delete/${currentEmail}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.detail || 'Не удалось удалить почтовый ящик');
                }
                
                // Создаем новый ящик только если удаление прошло успешно
                await createEmail();
                showSuccess('Почтовый ящик успешно удален');
                
            } catch (error) {
                console.error('Error:', error);
                showError(error.message);
            } finally {
                hideLoading();
            }
        }
    };
    
    // Auto-refresh functionality
    function startAutoRefresh() {
        console.log('Starting auto-refresh for:', currentEmail);
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
        
        // Initial load in silent mode
        loadMessages(currentEmail, true);
        
        // Set fixed 5-second interval
            autoRefreshInterval = setInterval(() => {
            if (document.visibilityState === 'visible' && currentEmail) {
                console.log('Auto-refresh: loading messages');
                loadMessages(currentEmail, true);
            }
        }, 5000); // 5 seconds
    }
    
    // Load messages with persistence
    async function loadMessages(email, silent = false) {
        console.log('Loading messages for:', email);
        
        try {
            if (!silent) {
                showEmailLoading();
            }

            const messagesContainer = document.querySelector('.messages-container');
            messagesContainer.classList.add('updating');

            const cachedMessages = JSON.parse(localStorage.getItem('messages') || '[]');
            
            const response = await fetch(`/api/email/messages/${email}`);
            console.log('Messages response status:', response.status);
            
            if (!response.ok) {
                throw new Error('Не удалось загрузить сообщения');
            }
            
            const newMessages = await response.json();
            console.log('Received messages:', newMessages);
            
            if (!Array.isArray(newMessages)) {
                throw new Error('Неверный формат данных');
            }
            
            // Создаем карту существующих сообщений для быстрого поиска
            const existingMessages = new Map(cachedMessages.map(msg => [msg.message_id, msg]));
            
            // Обновляем только метаданные сообщений, сохраняя контент
            newMessages.forEach(newMsg => {
                const existingMsg = existingMessages.get(newMsg.message_id);
                if (existingMsg) {
                    // Сохраняем существующий контент
                    newMsg.content = existingMsg.content || newMsg.content;
                    newMsg.html_content = existingMsg.html_content || newMsg.html_content;
                }
                existingMessages.set(newMsg.message_id, newMsg);
            });
            
            // Преобразуем Map обратно в массив и сортируем по дате
            messages = Array.from(existingMessages.values())
                .sort((a, b) => new Date(b.date) - new Date(a.date));
            localStorage.setItem('messages', JSON.stringify(messages));
            console.log('Updated messages cache:', messages);

            await renderMessages(messages);
            updateMessageCount(messages.length);
            
            setTimeout(() => {
                messagesContainer.classList.remove('updating');
            }, 300);
            
        } catch (error) {
            console.error('Error loading messages:', error);
            if (!silent) {
            showError(error.message);
            }
            // On error, use cached messages
            messages = cachedMessages;
            await renderMessages(messages);
            updateMessageCount(messages.length);
        } finally {
            if (!silent) {
                hideEmailLoading();
            }
        }
    }
    
    // Update message count
    function updateMessageCount(count) {
        messageCount.textContent = `${count} ${getMessageWord(count)}`;
    }
    
    // Get correct word form for message count
    function getMessageWord(count) {
        if (count === 0) return 'писем';
        if (count === 1) return 'письмо';
        if (count >= 2 && count <= 4) return 'письма';
        return 'писем';
    }
    
    // Render messages with smooth animations
    async function renderMessages(messages) {
        console.log('Rendering messages:', messages);
        
        if (!Array.isArray(messages) || messages.length === 0) {
            messageList.innerHTML = '<div class="no-messages">Нет сообщений</div>';
            return;
        }

        // Sort messages by date in descending order (newest first)
        messages = [...messages].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Получаем текущие сообщения
        const currentMessages = new Set(Array.from(messageList.children).map(el => el.dataset.messageId));
        const newMessages = new Set(messages.map(msg => msg.message_id));
        
        // Удаляем сообщения, которых больше нет
        const removedMessages = Array.from(currentMessages).filter(id => !newMessages.has(id));
        for (const id of removedMessages) {
            const element = messageList.querySelector(`[data-message-id="${id}"]`);
            if (element) {
                element.classList.add('removing');
                await new Promise(resolve => setTimeout(resolve, 300));
                element.remove();
            }
        }
        
        // Добавляем новые сообщения
        for (const message of messages) {
            if (!message) continue;
            
            let messageElement = messageList.querySelector(`[data-message-id="${message.message_id}"]`);
            const isNew = !messageElement;
            
            if (!messageElement) {
                messageElement = document.createElement('div');
                messageElement.className = 'message new-message';
                messageElement.dataset.messageId = message.message_id;
            }
            
            // Process verification links
            const verificationLinks = processMessageLinks(message);
            
            // Extract verification code if needed
            const verificationCode = message.verification_code || 
                                   (message.content && _extract_verification_code(message.content));
            
            // Safe sender extraction
            let senderName = 'Unknown';
            let senderEmail = '';
            
            try {
                if (message.sender) {
                    const matches = message.sender.match(/^([^<]+)?<?([^>]+)?>?$/);
                    if (matches) {
                        senderName = matches[1]?.trim() || matches[2]?.trim() || 'Unknown';
                        senderEmail = matches[2]?.trim() || matches[1]?.trim() || '';
                    } else {
                        senderName = message.sender;
                        senderEmail = message.sender;
                    }
                }
                
                // Create message content
                let subjectContent;
                if (verificationLinks.length > 0) {
                    const link = verificationLinks[0];
                    subjectContent = `
                        <div class="verification-links">
                            <a href="${escapeHtml(link)}" 
                               target="_blank" 
                               class="verification-link-button"
                               title="${escapeHtml(link)}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                                <span>Подтвердить регистрацию</span>
                            </a>
                        </div>`;
                } else {
                    subjectContent = escapeHtml(message.subject || 'Без темы');
                }
                
                messageElement.innerHTML = `
                    <div class="message-sender">
                        <span class="sender-name">${escapeHtml(senderName)}</span>
                        ${senderEmail ? `<span class="sender-email">${escapeHtml(senderEmail)}</span>` : ''}
                    </div>
                    <div class="message-subject">${subjectContent}</div>
                    <button class="view-button" onclick="viewMessage('${message.message_id}')" 
                            title="Просмотреть сообщение">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                `;
                
                if (isNew) {
                messageList.appendChild(messageElement);
                    // Remove the new-message class after animation
                    setTimeout(() => {
                        messageElement.classList.remove('new-message');
                    }, 500);
                }
            } catch (error) {
                console.error('Error rendering message:', error);
            }
        }
    }
    
    // Process all links from a message
    function processMessageLinks(message) {
        let links = new Set();
        
        // Check subject
        if (message.subject) {
            const subjectLinks = extractLinksFromText(message.subject);
            subjectLinks.forEach(link => links.add(link));
        }
        
        // Check HTML content
        if (message.html_content) {
            const htmlLinks = extractLinksFromHtml(message.html_content);
            htmlLinks.forEach(link => links.add(link));
        }
        
        // Check text content
        if (message.content) {
            const textLinks = extractLinksFromText(message.content);
            textLinks.forEach(link => links.add(link));
        }
        
        // Filter and process verification links
        return Array.from(links)
            .filter(isVerificationLink)
            .map(link => {
                try {
                    return new URL(link).href;
                } catch (e) {
                    console.log('Invalid URL:', link);
                    return null;
                }
            })
            .filter(Boolean); // Remove null values
    }

    // Check if a link is a verification link
    function isVerificationLink(url) {
        try {
            const urlObj = new URL(url);
            const urlString = url.toLowerCase();
            
            // Keywords to check in the URL
            const verificationKeywords = [
                'verify', 
                'confirm',
                'activate',
                'validation',
                'auth',
                'signup',
                'sign-up',
                'register',
                'openrouter'
            ];
            
            // Check if any keyword is present in the URL
            return verificationKeywords.some(keyword => 
                urlString.includes(keyword) || 
                urlObj.pathname.includes(keyword) || 
                urlObj.searchParams.toString().includes(keyword)
            );
        } catch (e) {
            console.log('Error checking verification link:', e);
            return false;
        }
    }

    // Update existing extractLinksFromText function
    function extractLinksFromText(text) {
        if (!text) return [];
        
        const urlRegex = /(https?:\/\/[^\s<>"]+)/g;
        const matches = text.match(urlRegex) || [];
        
        return matches.map(url => {
            try {
                return new URL(url).href;
            } catch (e) {
                console.log('Invalid URL in text:', url);
                return null;
            }
        }).filter(Boolean);
    }

    // Update existing extractLinksFromHtml function
    function extractLinksFromHtml(html) {
        if (!html) return [];
        
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Get all links and buttons
            const elements = [
                ...Array.from(doc.getElementsByTagName('a')),
                ...Array.from(doc.getElementsByTagName('button')),
                ...Array.from(doc.querySelectorAll('[role="button"]')),
                ...Array.from(doc.querySelectorAll('[class*="btn"], [class*="button"]'))
            ];
            
            return elements
                .map(el => {
                    const href = el.href || el.getAttribute('href');
                    const onclick = el.getAttribute('onclick');
                    
                    if (href) {
                        try {
                            return new URL(href, window.location.origin).href;
                        } catch (e) {
                            return null;
                        }
                    }
                    
                    if (onclick) {
                        const urlMatch = onclick.match(/['"]([^'"]*)['"]/);
                        if (urlMatch && urlMatch[1]) {
                            try {
                                return new URL(urlMatch[1], window.location.origin).href;
                            } catch (e) {
                                return null;
                            }
                        }
                    }
                    
                    return null;
                })
                .filter(Boolean);
        } catch (error) {
            console.error('Error in extractLinksFromHtml:', error);
            return [];
        }
    }
    
    // View message
    window.viewMessage = async (messageId) => {
        console.group('View Message Debug');
        console.log('Message ID:', messageId);
        
        if (!messageId) {
            console.error('Missing message ID');
            console.groupEnd();
            showError('Не удалось загрузить сообщение: отсутствует идентификатор');
            return;
        }

        try {
            // Проверяем кеш
            const cachedMessages = JSON.parse(localStorage.getItem('messages') || '[]');
            const cachedMessage = cachedMessages.find(msg => msg.message_id === messageId);
            
            // Если есть кешированное сообщение, показываем его сразу
            if (cachedMessage) {
                console.log('Found message in cache:', cachedMessage);
                displayMessage(cachedMessage);
                
                // Пытаемся получить свежую версию с сервера
                try {
                    const response = await fetch(`/api/email/messages/${currentEmail}/${messageId}`);
            console.log('Response status:', response.status);
            
                    if (response.ok) {
                        const message = await response.json();
                        console.log('Message data:', message);
                        
                        if (message && (message.content || message.html_content)) {
                            // Обновляем кеш только если получили новый контент
                            const messageIndex = cachedMessages.findIndex(msg => msg.message_id === messageId);
                            if (messageIndex !== -1) {
                                cachedMessages[messageIndex] = message;
                            } else {
                                cachedMessages.push(message);
                            }
                            localStorage.setItem('messages', JSON.stringify(cachedMessages));
                            
                            // Обновляем отображение только если контент изменился
                            if (message.content !== cachedMessage.content || 
                                message.html_content !== cachedMessage.html_content) {
                                displayMessage(message);
                            }
                        }
                    }
                    // Игнорируем 404 ошибку если есть кешированное сообщение
                } catch (error) {
                    console.error('Error fetching fresh message:', error);
                    // Продолжаем показывать кешированную версию
                }
            } else {
                // Если в кеше нет, пытаемся получить с сервера
                const response = await fetch(`/api/email/messages/${currentEmail}/${messageId}`);
                console.log('Response status:', response.status);
                
                if (response.ok) {
            const message = await response.json();
            console.log('Message data:', message);
            
                    if (message) {
                        // Сохраняем в кеш
                        cachedMessages.push(message);
                        localStorage.setItem('messages', JSON.stringify(cachedMessages));
                        displayMessage(message);
                    }
                } else {
                    throw new Error('Сообщение не найдено или было удалено');
                }
            }
        } catch (error) {
            console.error('Error in viewMessage:', error);
            showError(error.message);
        } finally {
            console.groupEnd();
        }
    };
    
    // Функция для отображения сообщения
    function displayMessage(message) {
        // Извлекаем верификационные данные
        let verificationLinks = [];
        let verificationCode = null;
        
        // Извлекаем ссылки верификации
        verificationLinks = processMessageLinks(message);
        
        // Извлекаем код верификации
        if (message.verification_code) {
            verificationCode = message.verification_code;
        } else if (message.content) {
            verificationCode = _extract_verification_code(message.content);
        }

        console.log('Verification links:', verificationLinks);
        console.log('Verification code:', verificationCode);
            
            // Подготавливаем контент
        let messageContent = '';
        
        if (!message.html_content && !message.content) {
            messageContent = `
                <div class="error-container">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <h4>Сообщение недоступно</h4>
                    <p>Возможные причины:</p>
                    <ul>
                        <li>Сообщение было удалено с сервера</li>
                        <li>Истек срок хранения сообщения</li>
                        <li>Временные проблемы с доступом к серверу</li>
                    </ul>
                    <button class="button primary" onclick="refreshMessages()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M23 4v6h-6"></path>
                            <path d="M1 20v-6h6"></path>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
                            <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
                        </svg>
                        Обновить список сообщений
                    </button>
                </div>`;
        } else {
            messageContent = message.html_content || message.content;
        }
            
            // Создаем модальное окно
            const modal = document.createElement('div');
            modal.className = 'modal';
            
        // Добавляем верификационные данные в начало контента
        let verificationContent = '';
        
        if (verificationCode) {
            verificationContent += `
                <div class="verification-code" onclick="copyToClipboard('${verificationCode}')">
                    <div class="code-label">Код подтверждения:</div>
                    <div class="code-value">${verificationCode}</div>
                    <div class="code-copy">Нажмите, чтобы скопировать</div>
                </div>`;
        }
        
        if (verificationLinks.length > 0) {
            verificationContent += `
                <div class="verification-links-container">
                    <h4 class="verification-links-title">Ссылки из письма:</h4>
                    ${verificationLinks.map(link => `
                        <div class="verification-link-item">
                            <a href="${escapeHtml(link)}" 
                               target="_blank" 
                               class="verification-link-button"
                               rel="noopener noreferrer">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                                <span>${link.includes('click here') ? 'Нажмите здесь' : 'Перейти по ссылке'}</span>
                            </a>
                            <button class="copy-button" onclick="copyToClipboard('${escapeHtml(link)}')" title="Копировать ссылку">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                        </button>
                    </div>
                    `).join('')}
                </div>`;
            }
        
        messageContent = verificationContent + messageContent;
            
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="header-info">
                        <h3>${escapeHtml(message.subject || 'Без темы')}</h3>
                            <div class="message-meta">
                            <span class="sender">${escapeHtml(message.sender)}</span>
                                <span class="date">${new Date(message.date).toLocaleString()}</span>
                            </div>
                        </div>
                        <button type="button" class="close-modal">×</button>
                    </div>
                    <div class="modal-body">
                        ${messageContent}
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            console.log('Modal created and added to DOM');
            
            // Add click handler to close modal
            modal.addEventListener('click', (e) => {
                if (e.target === modal || e.target.classList.contains('close-modal')) {
                modal.classList.add('closing');
                setTimeout(() => {
                    modal.remove();
                }, 300); // Wait for animation to complete
            }
        });
    }
    
    // Delete message
    window.deleteMessage = async (messageId) => {
        if (!confirm('Вы уверены, что хотите удалить это сообщение?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/email/messages/${currentEmail}/${messageId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Не удалось удалить сообщение');
            }
            
            // Refresh messages
            loadMessages(currentEmail);
            showSuccess('Сообщение удалено');
            
        } catch (error) {
            console.error('Error:', error);
            showError(error.message);
        }
    };
    
    // View message source
    window.viewSource = async (messageId) => {
        try {
            const response = await fetch(`/api/email/messages/${currentEmail}/${messageId}/source`);
            
            if (!response.ok) {
                throw new Error('Не удалось получить исходный код сообщения');
            }
            
            const source = await response.text();
            
            // Create modal with source code
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Исходный код сообщения</h3>
                        <button onclick="this.closest('.modal').remove()">×</button>
                    </div>
                    <pre class="source-code">${source}</pre>
                </div>
            `;
            
            document.body.appendChild(modal);
            
        } catch (error) {
            console.error('Error:', error);
            showError(error.message);
        }
    };
    
    // Generate and copy password
    window.generatePassword = async () => {
        const length = 16; // Длина пароля
        const charset = {
            lowercase: 'abcdefghijklmnopqrstuvwxyz',
            uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            numbers: '0123456789',
            symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
        };
        
        // Убедимся, что в пароле будет хотя бы по одному символу каждого типа
        let password = '';
        password += charset.lowercase[Math.floor(Math.random() * charset.lowercase.length)];
        password += charset.uppercase[Math.floor(Math.random() * charset.uppercase.length)];
        password += charset.numbers[Math.floor(Math.random() * charset.numbers.length)];
        password += charset.symbols[Math.floor(Math.random() * charset.symbols.length)];
        
        // Добавляем остальные случайные символы
        const allChars = Object.values(charset).join('');
        for (let i = password.length; i < length; i++) {
            password += allChars[Math.floor(Math.random() * allChars.length)];
        }
        
        // Перемешиваем пароль
        password = password.split('').sort(() => Math.random() - 0.5).join('');
        
        // Создаем модальное окно с паролем
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content password-modal">
                <div class="modal-header">
                    <h3>Сгенерированный пароль</h3>
                    <button type="button" class="close-modal">×</button>
                </div>
                <div class="modal-body">
                    <div class="password-container">
                        <div class="password-display" style="cursor: pointer;" title="Нажмите, чтобы скопировать">
                            ${password}
                        </div>
                        <div class="password-status">
                            <svg class="checkmark-small" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                                <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                                <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                            </svg>
                            <span>Нажмите на пароль, чтобы скопировать</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Добавляем обработчик для закрытия
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('close-modal')) {
                modal.remove();
            }
        });

        // Добавляем обработчик клика на пароль
        const passwordDisplay = modal.querySelector('.password-display');
        const statusText = modal.querySelector('.password-status span');
        
        passwordDisplay.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(password);
                modal.remove(); // Сразу закрываем окно после копирования
            } catch (error) {
                console.error('Failed to copy password:', error);
                statusText.textContent = 'Не удалось скопировать пароль';
            }
            });
    };
    
    // Create new email account
    window.createNewEmail = async () => {
        try {
            // Очищаем все данные из localStorage перед созданием новой почты
            localStorage.clear();
            
            // Очищаем все переменные
            currentEmail = null;
            messages = [];
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
            }

            // Очищаем интерфейс и показываем загрузку
            currentEmailElement.textContent = 'Создание новой почты...';
            currentEmailElement.style.color = 'var(--text-secondary)';
            renderMessages(messages);
            updateMessageCount(0);
            showEmailLoading();
            
            // Удаляем старую почту если она существует
            const oldEmail = localStorage.getItem('currentEmail');
            if (oldEmail) {
                try {
                    await fetch(`/api/email/delete/${oldEmail}`, {
                        method: 'DELETE'
                    });
                } catch (error) {
                    console.error('Error deleting old email:', error);
                }
            }
            
            // Пытаемся создать новую почту
            const response = await fetch('/api/email/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    service: 'temp-mail'
                }),
            });
            
            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Response data:', data);
            
            if (!response.ok) {
                // Создаем модальное окно с сообщением об ошибке
                const modal = document.createElement('div');
                modal.className = 'modal';
                modal.innerHTML = `
                    <div class="modal-content" style="max-width: 400px;">
                        <div class="modal-header">
                            <h3>Сервис временно недоступен</h3>
                            <button type="button" class="close-modal">×</button>
                        </div>
                        <div class="modal-body">
                            <p>Сервис временно перегружен. Пожалуйста, подождите несколько минут и попробуйте снова.</p>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
                
                // Добавляем обработчик для закрытия
                modal.addEventListener('click', (e) => {
                    if (e.target === modal || e.target.classList.contains('close-modal')) {
                        modal.remove();
                    }
                });
                
                currentEmailElement.textContent = 'Сервис временно перегружен';
                currentEmailElement.style.color = 'var(--danger-color)';
                throw new Error(data.detail || 'Не удалось создать почтовый ящик');
            }
            
            // Устанавливаем новый email
            currentEmail = data.email;
            localStorage.setItem('currentEmail', currentEmail);
            currentEmailElement.textContent = currentEmail;
            currentEmailElement.style.color = ''; // Возвращаем обычный цвет
            
            // Инициализируем новый массив сообщений
            messages = [];
            localStorage.setItem('messages', JSON.stringify(messages));
            
            // Запускаем автообновление
            startAutoRefresh();
            
            showSuccess('Создан новый почтовый ящик');
            
        } catch (error) {
            console.error('Error:', error);
            showError(error.message);
        } finally {
            hideEmailLoading();
        }
    };
    
    // Generate and copy name with modal
    window.generateName = () => {
        const maleNames = [
            'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph',
            'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Donald',
            'Mark', 'Paul', 'Steven', 'Andrew', 'Kenneth', 'Joshua', 'Kevin', 'Brian', 'George'
        ];
        
        const femaleNames = [
            'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica',
            'Sarah', 'Karen', 'Lisa', 'Nancy', 'Betty', 'Margaret',
            'Kimberly', 'Emily', 'Donna', 'Michelle', 'Carol', 'Amanda', 'Dorothy', 'Melissa'
        ];
        
        const surnames = [
            'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
            'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
            'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White',
            'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Hall', 'Young', 'King'
        ];
        
        // Randomly select gender
        const isMale = Math.random() < 0.5;
        
        // Select random name based on gender
        const firstName = isMale 
            ? maleNames[Math.floor(Math.random() * maleNames.length)]
            : femaleNames[Math.floor(Math.random() * femaleNames.length)];
        
        // Select random surname
        const surname = surnames[Math.floor(Math.random() * surnames.length)];
        
        // Generate login (firstname_surname in lowercase)
        const login = `${firstName.toLowerCase()}_${surname.toLowerCase()}`;
        
        // Create modal with generated name
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>Сгенерированное имя</h3>
                    <button type="button" class="close-modal">×</button>
                </div>
                <div class="modal-body">
                    <div class="generated-info">
                        <div class="info-row">
                            <span class="info-label">Имя:</span>
                            <span class="info-value">${firstName}</span>
                            <button class="copy-button" onclick="copyToClipboard('${firstName}')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </button>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Фамилия:</span>
                            <span class="info-value">${surname}</span>
                            <button class="copy-button" onclick="copyToClipboard('${surname}')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </button>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Логин:</span>
                            <span class="info-value">${login}</span>
                            <button class="copy-button" onclick="copyToClipboard('${login}')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add click handler to close modal when clicking outside or on close button
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('close-modal')) {
                modal.remove();
            }
        });
    };
    
    // Copy text to clipboard
    window.copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            showSuccess('Скопировано в буфер обмена');
        } catch (error) {
            console.error('Failed to copy:', error);
            showError('Не удалось скопировать текст');
        }
    };
    
    // Show/hide loading indicators
    function showLoading() {
        loadingIndicator.classList.add('active');
    }
    
    function hideLoading() {
        loadingIndicator.classList.remove('active');
    }
    
    function showEmailLoading() {
        emailLoadingIndicator.style.display = 'inline-flex';
    }

    function hideEmailLoading() {
        emailLoadingIndicator.style.display = 'none';
    }
    
    // Utility functions
    function showError(message) {
        console.error('Error message:', message);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        // Удаляем предыдущие сообщения об ошибках
        const existingErrors = document.querySelectorAll('.error-message');
        existingErrors.forEach(error => error.remove());
        
        // Добавляем новое сообщение об ошибке
        const container = document.querySelector('.messages-container');
        container.insertAdjacentElement('beforebegin', errorDiv);
        
        // Автоматически удаляем сообщение через 5 секунд
        setTimeout(() => errorDiv.remove(), 5000);
    }
    
    function showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.style.whiteSpace = 'pre-line'; // Поддержка переносов строк
        successDiv.textContent = message;
        
        // Удаляем предыдущие сообщения об успехе
        const existingSuccess = document.querySelectorAll('.success-message');
        existingSuccess.forEach(success => success.remove());
        
        // Добавляем новое сообщение об успехе
        const container = document.querySelector('.messages-container');
        container.insertAdjacentElement('beforebegin', successDiv);
        
        // Автоматически удаляем сообщение через 5 секунд
        setTimeout(() => successDiv.remove(), 5000);
    }
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
    });
    
    // Add visibility change handler
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && currentEmail) {
            console.log('Tab became visible, refreshing messages');
            loadMessages(currentEmail, true);
        }
    });

    // Extract verification code from content
    function _extract_verification_code(content) {
        if (!content) return null;
        
        // Игнорируем даты и годы
        const datePatterns = [
            /\d{2}\.\d{2}\.\d{4}/,  // DD.MM.YYYY
            /\d{4}-\d{2}-\d{2}/,    // YYYY-MM-DD
            /\d{2}\/\d{2}\/\d{4}/,  // DD/MM/YYYY
            /20\d{2}/               // Year 20XX
        ];
        
        // Проверяем, не является ли текст датой
        function isDate(text) {
            return datePatterns.some(pattern => pattern.test(text));
        }
        
        const patterns = [
            /verification code[:\s]+([A-Z0-9]{4,8})/i,
            /confirmation code[:\s]+([A-Z0-9]{4,8})/i,
            /security code[:\s]+([A-Z0-9]{4,8})/i,
            /one-time code[:\s]+([A-Z0-9]{4,8})/i,
            /код подтверждения[:\s]+([A-Z0-9]{4,8})/i,
            /код[:\s]+([A-Z0-9]{4,8})/i,
            /pin[:\s]+([0-9]{4,8})/i,
            /одноразовый код[:\s]+([0-9]{4,8})/i,
            /temporary code[:\s]+([0-9]{4,8})/i
        ];
        
        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
                const code = match[1];
                // Проверяем что это не дата и не год
                if (!isDate(code)) {
                    return code;
                }
            }
        }
        
        return null;
    }
}); 