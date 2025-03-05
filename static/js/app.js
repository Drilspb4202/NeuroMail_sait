let serverHealthCheckInterval;
let currentEmail = null;
let autoRefreshInterval;

// Функции для управления индикатором загрузки
function showLoading() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'flex';
    }
}

function hideLoading() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

function showEmailLoading() {
    const emailLoading = document.getElementById('emailLoading');
    if (emailLoading) {
        emailLoading.style.display = 'flex';
    }
}

function hideEmailLoading() {
    const emailLoading = document.getElementById('emailLoading');
    if (emailLoading) {
        emailLoading.style.display = 'none';
    }
}

// Функции для отображения сообщений об ошибках и успехе
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 5000);
}

// Функции для работы с кешем
function saveEmailToCache(email) {
    try {
        localStorage.setItem('currentEmail', email);
        localStorage.setItem('emailCreatedAt', new Date().toISOString());
    } catch (error) {
        console.warn('Failed to save email to cache:', error);
    }
}

function getEmailFromCache() {
    try {
        return {
            email: localStorage.getItem('currentEmail'),
            createdAt: localStorage.getItem('emailCreatedAt')
        };
    } catch (error) {
        console.warn('Failed to get email from cache:', error);
        return { email: null, createdAt: null };
    }
}

function clearEmailCache() {
    try {
        localStorage.removeItem('currentEmail');
        localStorage.removeItem('emailCreatedAt');
    } catch (error) {
        console.warn('Failed to clear email cache:', error);
    }
}

// Функция для проверки состояния сервера
async function checkServerHealth() {
    try {
        const response = await fetch('/health');
        const data = await response.json();
        
        // Обновляем статус только если элементы существуют
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-text');
        
        if (statusDot && statusText) {
            if (data.status === 'ok') {
                statusDot.className = 'status-dot green';
                statusText.textContent = 'Сервер работает';
            } else {
                statusDot.className = 'status-dot yellow';
                statusText.textContent = 'Проверка сервера...';
            }
        }
        
        return data.status === 'ok';
    } catch (error) {
        console.warn('Health check failed:', error);
        
        // Обновляем статус только если элементы существуют
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-text');
        
        if (statusDot && statusText) {
            statusDot.className = 'status-dot red';
            statusText.textContent = 'Ошибка подключения';
        }
        
        return false;
    }
}

// Функция для получения текста статуса
function getStatusText(data) {
    return 'Сервер работает';
}

// Функция для обновления статуса сервисов
function updateServiceStatus(data) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    
    if (!statusDot || !statusText) return;
    
    // Всегда показываем зеленый статус
    statusDot.className = 'status-dot green';
    statusText.textContent = 'Сервер работает';
}

// Функция для отображения предупреждений
function showWarning(message) {
    const warning = document.createElement('div');
    warning.className = 'warning-message';
    
    // Создаем иконку предупреждения
    const icon = document.createElement('span');
    icon.className = 'warning-icon';
    icon.innerHTML = '⚠️';
    warning.appendChild(icon);
    
    // Добавляем текст
    const text = document.createElement('span');
    text.className = 'warning-text';
    text.textContent = message;
    warning.appendChild(text);
    
    // Добавляем кнопку закрытия
    const closeButton = document.createElement('button');
    closeButton.className = 'warning-close';
    closeButton.innerHTML = '×';
    closeButton.onclick = () => warning.remove();
    warning.appendChild(closeButton);
    
    document.body.appendChild(warning);
    
    // Автоматически удаляем через 10 секунд
    setTimeout(() => {
        if (document.body.contains(warning)) {
            warning.remove();
        }
    }, 10000);
}

// Функция для управления временем жизни email
function startEmailExpiryTimer(creationTime) {
    const expiryDiv = document.getElementById('emailExpiry');
    if (!expiryDiv) return;
    
    const expiryTime = document.querySelector('.expiry-time');
    const validityHours = 10; // Время жизни email в часах
    
    function updateExpiryTime() {
        const now = new Date();
        const created = new Date(creationTime);
        const diff = (created.getTime() + validityHours * 3600000) - now.getTime();
        
        if (diff <= 0) {
            expiryTime.textContent = 'Истек';
            expiryTime.classList.add('warning');
            clearInterval(emailExpiryInterval);
            return;
        }
        
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        
        expiryTime.textContent = `${hours}:${minutes.toString().padStart(2, '0')}`;
        
        if (hours === 0 && minutes < 30) {
            expiryTime.classList.add('warning');
        }
    }
    
    updateExpiryTime();
    emailExpiryInterval = setInterval(updateExpiryTime, 60000); // Обновляем каждую минуту
}

// Функция для добавления подсказок к кнопкам
function addTooltips() {
    // Удаляем все существующие тултипы
    document.querySelectorAll('.tooltip').forEach(el => {
        el.classList.remove('tooltip');
        el.removeAttribute('data-tooltip');
    });
}

// Функция для управления состоянием кнопки во время загрузки
function setButtonLoading(button, isLoading) {
    if (!button) return;
    
    if (isLoading) {
        // Сохраняем оригинальный текст кнопки
        const originalContent = button.innerHTML;
        button.dataset.originalContent = originalContent;
        
        // Добавляем спиннер и меняем текст
        button.innerHTML = `
            <span class="button-spinner"></span>
            <span>Создание почты...</span>
        `;
        button.classList.add('loading');
        button.disabled = true;
    } else {
        // Восстанавливаем оригинальный текст
        if (button.dataset.originalContent) {
            button.innerHTML = button.dataset.originalContent;
            delete button.dataset.originalContent;
        }
        button.classList.remove('loading');
        button.disabled = false;
    }
}

// Модифицируем функцию createEmail
async function createEmail() {
    const newEmailButton = document.querySelector('.button.primary');
    setButtonLoading(newEmailButton, true);
    
    try {
            const response = await fetch('/api/email/create', {
                method: 'POST',
                headers: {
                'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    service: 'temp-mail'
            })
            });
            
            if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Ошибка создания почты');
            }
            
        const data = await response.json();
            currentEmail = data.email;
        
        // Сохраняем email в кеш
        saveEmailToCache(currentEmail);
        
        // Обновляем отображение email
        const emailElement = document.getElementById('currentEmail');
        if (emailElement) {
            emailElement.textContent = currentEmail;
        }
        
        // Запускаем проверку сообщений
        await loadMessages(currentEmail);
            startAutoRefresh();
            
        showSuccess('Почта успешно создана');
        } catch (error) {
        console.error('Error creating email:', error);
        showError(error.message || 'Ошибка при создании почты');
        } finally {
        setButtonLoading(newEmailButton, false);
            hideLoading();
        }
    }
    
// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded');
    
    // Проверяем наличие сохраненной почты в кеше
    const cachedEmail = getEmailFromCache();
    
    if (cachedEmail.email) {
        currentEmail = cachedEmail.email;
        const emailElement = document.getElementById('currentEmail');
        if (emailElement) {
            emailElement.textContent = currentEmail;
        }
        
        // Загружаем сообщения для сохраненной почты
        await loadMessages(currentEmail);
        startAutoRefresh();
    } else {
        // Если почты нет в кеше, создаем новую
        await createEmail();
    }
    
    // Запускаем проверку здоровья сервера
    await checkServerHealth();
    serverHealthCheckInterval = setInterval(checkServerHealth, 30000);
    
    // Добавляем обработчик для кнопки создания новой почты
    const newEmailButton = document.querySelector('.button.primary');
    if (newEmailButton) {
        newEmailButton.onclick = async () => {
            clearEmailCache(); // Очищаем кеш перед созданием новой почты
            await createEmail();
        };
    }
});

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded');
    
    // Add styles for error container and verification code
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

        .verification-code-header {
            margin-top: 8px;
            padding: 8px 12px;
            background: rgba(168, 85, 247, 0.1);
            border-radius: 6px;
            color: var(--primary-color);
            font-weight: 500;
            display: inline-block;
        }
        
        .verification-code-header .code-value {
            font-family: monospace;
            font-weight: 600;
            letter-spacing: 1px;
        }
        
        .message-verification {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
        }
        
        .verification-code-inline {
            font-size: 0.875rem;
            color: var(--primary-color);
            font-weight: 500;
            background: rgba(168, 85, 247, 0.1);
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            display: inline-block;
        }
        
        .subject-text {
            color: var(--text-color);
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
    
    let messages = JSON.parse(localStorage.getItem('messages') || '[]')
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    let autoRefreshInterval = null;
    
    // Auto-refresh functionality
    function startAutoRefresh() {
        console.log('Starting auto-refresh for:', currentEmail);
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
        
        // Initial load in silent mode
        let isRefreshing = false;
        
        async function refresh() {
            if (isRefreshing || !currentEmail || document.visibilityState !== 'visible') {
                return;
            }
            
            try {
                isRefreshing = true;
                await loadMessages(currentEmail, true);
            } catch (error) {
                console.warn('Auto-refresh failed:', error);
            } finally {
                isRefreshing = false;
            }
        }
        
        refresh(); // Initial refresh
        autoRefreshInterval = setInterval(refresh, 5000);
    }
    
    // Load messages with persistence
    async function loadMessages(email, silent = false) {
        const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 30000)
        );
        
        try {
            if (!silent) {
                showEmailLoading();
            }
            
            const messagesContainer = document.querySelector('.messages-container');
            messagesContainer.classList.add('updating');
            
            // Race between the fetch and timeout
            const response = await Promise.race([
                fetch(`/api/email/messages/${email}`),
                timeout
            ]);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const newMessages = await response.json();
            console.log('Received messages:', newMessages);
            
            if (!Array.isArray(newMessages)) {
                throw new Error('Неверный формат данных');
            }
            
            // Создаем карту существующих сообщений для быстрого поиска
            const existingMessages = new Map(messages.map(msg => [msg.message_id, msg]));
            
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
            console.warn('Error loading messages:', error);
            if (!silent) {
            showError(error.message);
            }
            // On error, use cached messages
            messages = JSON.parse(localStorage.getItem('messages') || '[]');
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
            messageList.innerHTML = `
                <div class="community-promo">
                    <div class="promo-content">
                        <div class="promo-text">
                            <h2 class="promo-title">Оля | PROтехничку | Кейсы</h2>
                            <p class="promo-description">Чат-боты, платежи, GetCourse, Tilda — настройка под ключ! 🚀</p>
                        </div>
                        <a href="https://t.me/olyaPROtechnichku" target="_blank" rel="noopener noreferrer" class="telegram-button">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-16.5 7.5a2.25 2.25 0 0 0 .126 4.17l3.9 1.3v3.882a2.25 2.25 0 0 0 3.898 1.549l2.876-2.876 3.837 2.87a2.242 2.242 0 0 0 3.527-1.376l4.5-16.5a2.25 2.25 0 0 0-2.742-2.734z"></path>
                            </svg>
                            Подписаться
                        </a>
                    </div>
                </div>`;
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
                } else if (verificationCode) {
                    subjectContent = `
                        <div class="message-verification">
                            <span class="subject-text">${escapeHtml(message.subject || 'Без темы')}</span>
                            <div class="verification-code-inline">Код: ${verificationCode}</div>
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
            /temporary code[:\s]+([0-9]{4,8})/i,
            /Your verification code is[:\s]+([A-Z0-9]{4,8})/i,
            /code is here![:\s]*([A-Z0-9]{4,8})/i,
            /here!([A-Z0-9]{4,8})/i
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
        
        // Если не нашли по шаблонам, ищем любой код после фразы "code is here"
        const codeAfterPhrase = content.match(/code is here!?\s*([^\s\n]+)/i);
        if (codeAfterPhrase && codeAfterPhrase[1]) {
            return codeAfterPhrase[1];
        }
        
        return null;
    }

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
        } else if (message.subject && message.subject.includes('verification code')) {
            verificationCode = _extract_verification_code(message.subject);
        }

        // Подготавливаем контент
        let messageContent = '';
        let verificationContent = '';

        // Добавляем верификационные данные
        if (verificationLinks.length > 0) {
            verificationContent += `
                <div class="verification-links">
                    ${verificationLinks.map(link => `
                        <a href="${escapeHtml(link)}" 
                           target="_blank" 
                           class="verification-link-button">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                            Подтвердить
                        </a>
                    `).join('')}
                </div>`;
        }

        if (verificationCode) {
            verificationContent += `
                <div class="verification-code-container">
                    <div class="verification-code-header">
                        <span class="code-label">Код подтверждения:</span>
                        <div class="code-value-container">
                            <span class="code-value">${verificationCode}</span>
                            <button class="copy-code-button" onclick="copyToClipboard('${verificationCode}')">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                Копировать
                        </button>
                    </div>
                    </div>
                </div>`;
        }

        // Подготавливаем основной контент
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
            messageContent = message.html_content || message.content.replace(/\n/g, '<br>');
        }

        // Форматируем дату
        const messageDate = new Date(message.date).toLocaleString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Создаем модальное окно
        const modal = document.createElement('div');
        modal.className = 'modal';
            
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="header-info">
                        <h3>${escapeHtml(message.subject || 'Без темы')}</h3>
                            <div class="message-meta">
                            <span class="sender">${escapeHtml(message.sender)}</span>
                            <span class="date">${messageDate}</span>
                            </div>
                        </div>
                    <button type="button" class="close-modal" title="Закрыть">×</button>
                    </div>
                    <div class="modal-body">
                    ${verificationContent}
                        ${messageContent}
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);

        // Добавляем обработчики закрытия
        const closeModal = () => {
            modal.classList.add('closing');
            setTimeout(() => modal.remove(), 300);
        };

            modal.addEventListener('click', (e) => {
                if (e.target === modal || e.target.classList.contains('close-modal')) {
                closeModal();
            }
        });

        // Добавляем обработчик клавиши Escape
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Удаляем обработчик при закрытии
        modal.addEventListener('remove', () => {
            document.removeEventListener('keydown', handleEscape);
        });

        // Анимация появления
        requestAnimationFrame(() => {
            modal.style.opacity = '1';
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
        // Remove any existing password modals and their styles
        document.querySelectorAll('.modal').forEach(modal => {
            if (modal.querySelector('.temp-password-modal')) {
                modal.remove();
            }
        });
        document.querySelectorAll('style').forEach(style => {
            if (style.textContent.includes('.temp-password-modal')) {
                style.remove();
            }
        });

        const length = 12;
        const charset = {
            lowercase: 'abcdefghijklmnopqrstuvwxyz',
            uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            numbers: '0123456789',
            symbols: '!@#$%^&*()_+-=[]{}|;:,.?'
        };
        
        let password = '';
        password += charset.lowercase[Math.floor(Math.random() * charset.lowercase.length)];
        password += charset.uppercase[Math.floor(Math.random() * charset.uppercase.length)];
        password += charset.numbers[Math.floor(Math.random() * charset.numbers.length)];
        password += charset.symbols[Math.floor(Math.random() * charset.symbols.length)];
        
        const allChars = Object.values(charset).join('');
        for (let i = password.length; i < length; i++) {
            password += allChars[Math.floor(Math.random() * allChars.length)];
        }
        
        password = password.split('').sort(() => Math.random() - 0.5).join('');
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content temp-password-modal">
                <div class="temp-password-header">
                    <h3>Надежный пароль</h3>
                    <button type="button" class="close-modal" onclick="closePasswordModal(this)">×</button>
                </div>
                <div class="temp-password-body">
                    <div class="temp-password-container">
                        <div class="lock-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </div>
                        <div class="temp-password-display">
                            ${password}
                        </div>
                        <div class="temp-password-info">
                            <div class="password-strength">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"></path>
                                    <path d="M12 16l4-4"></path>
                                    <path d="M8 12l2 2"></path>
                                    <path d="M12 8v.01"></path>
                                </svg>
                                <span>Содержит буквы, цифры и символы</span>
                            </div>
                            <div class="password-security">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                </svg>
                                <span>Высокая надежность</span>
                            </div>
                        </div>
                        <div class="action-buttons">
                            <button class="copy-password-button" onclick="copyPasswordAndClose('${password}', this)">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                <span>Скопировать пароль</span>
                            </button>
                            <button class="generate-new-password" onclick="generatePassword()">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M23 4v6h-6"></path>
                                    <path d="M1 20v-6h6"></path>
                                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
                                    <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
                                </svg>
                                <span>Сгенерировать новый</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);

        // Add styles for the new design
        const style = document.createElement('style');
        style.textContent = `
            .temp-password-modal {
                max-width: 400px !important;
                background: white !important;
                border-radius: 20px !important;
                overflow: hidden;
            }

            .temp-password-header {
                background: var(--primary-color);
                padding: 1rem 1.5rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .temp-password-header h3 {
                color: white;
                margin: 0;
                font-size: 1.2rem;
                font-weight: 500;
            }

            .temp-password-header .close-modal {
                color: white;
                opacity: 0.8;
                font-size: 1.5rem;
                padding: 0;
                background: none;
                border: none;
                cursor: pointer;
            }

            .temp-password-body {
                padding: 2rem;
            }

            .temp-password-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 1.5rem;
            }

            .lock-icon {
                width: 48px;
                height: 48px;
                background: var(--primary-color);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
            }

            .temp-password-display {
                font-family: 'Courier New', monospace;
                font-size: 1.5rem;
                font-weight: 600;
                color: var(--primary-color);
                background: rgba(168, 85, 247, 0.1);
                padding: 1rem 2rem;
                border-radius: 12px;
                letter-spacing: 0.1em;
                word-break: break-all;
                text-align: center;
                max-width: 100%;
            }

            .temp-password-info {
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
                width: 100%;
            }

            .password-strength,
            .password-security {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                color: var(--text-secondary);
                font-size: 0.9rem;
            }

            .password-strength svg,
            .password-security svg {
                color: var(--primary-color);
                flex-shrink: 0;
            }

            .copy-password-button,
            .generate-new-password {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                padding: 0.75rem;
                border-radius: 8px;
                border: none;
                cursor: pointer;
                font-size: 0.95rem;
                transition: all 0.2s ease;
            }

            .copy-password-button {
                background: var(--primary-color);
                color: white;
            }

            .generate-new-password {
                background: rgba(168, 85, 247, 0.1);
                color: var(--primary-color);
            }

            .copy-password-button:hover {
                background: var(--primary-dark);
            }

            .generate-new-password:hover {
                background: rgba(168, 85, 247, 0.2);
            }

            @media (max-width: 480px) {
                .temp-password-modal {
                    width: 90%;
                    margin: 1rem;
                }

                .temp-password-body {
                    padding: 1.5rem;
                }

                .temp-password-display {
                    font-size: 1.25rem;
                    padding: 0.75rem 1rem;
                }

                .temp-password-info {
                    font-size: 0.85rem;
                }

                .copy-password-button,
                .generate-new-password {
                    padding: 0.75rem;
                    font-size: 0.9rem;
                }
            }
        `;
        document.head.appendChild(style);
        
        // Добавляем обработчик для закрытия
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('close-modal')) {
                modal.remove();
                style.remove();
            }
            });
    };
    
    // Add new function to handle copy and close
    window.copyPasswordAndClose = async (password, button) => {
        try {
            await navigator.clipboard.writeText(password);
            showSuccess('Пароль скопирован в буфер обмена');
            closePasswordModal(button);
        } catch (error) {
            console.error('Failed to copy:', error);
                showError('Не удалось скопировать пароль');
        }
    };

    // Add new function to close password modal
    window.closePasswordModal = (element) => {
        const modal = element.closest('.modal');
        if (modal) {
            modal.remove();
            // Remove associated styles
            document.querySelectorAll('style').forEach(style => {
                if (style.textContent.includes('.temp-password-modal')) {
                    style.remove();
                }
            });
        }
    };
    
    // Create new email account
    window.createNewEmail = async () => {
        try {
            showEmailLoading();
            
            // Удаляем старую почту если она существует
            const oldEmail = currentEmail;
            if (oldEmail) {
                try {
                    const deleteResponse = await fetch(`/api/email/delete/${oldEmail}`, {
                        method: 'DELETE'
                    });
                    
                    if (!deleteResponse.ok) {
                        console.warn('Failed to delete old email:', await deleteResponse.text());
                    }
                } catch (error) {
                    console.error('Error deleting old email:', error);
                }
            }

            // Очищаем все данные
            localStorage.clear();
            currentEmail = null;
            messages = [];
            
            // Останавливаем автообновление
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
            }

            // Очищаем DOM элементы
            messageList.innerHTML = '';
            updateMessageCount(0);
            
            // Удаляем все модальные окна и уведомления
            document.querySelectorAll('.modal, .notification, .error-message, .success-message').forEach(el => el.remove());
            
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
            
            const data = await response.json();
            
            if (!response.ok) {
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
        // Remove any existing name generation modals and their styles
        document.querySelectorAll('.modal').forEach(modal => {
            if (modal.querySelector('.name-generation-modal')) {
                modal.remove();
            }
        });
        document.querySelectorAll('style').forEach(style => {
            if (style.textContent.includes('.name-generation-modal')) {
                style.remove();
            }
        });

        const maleNames = [
            'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 
            'Joseph', 'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew',
            'Anthony', 'Donald', 'Mark', 'Paul', 'Steven', 'Andrew', 'Kenneth'
        ];
        
        const femaleNames = [
            'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan',
            'Jessica', 'Sarah', 'Karen', 'Lisa', 'Nancy', 'Betty', 'Margaret',
            'Sandra', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle'
        ];
        
        const surnames = [
            'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
            'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
            'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'
        ];
        
        // Randomly select gender and name
        const isMale = Math.random() < 0.5;
        const firstName = isMale 
            ? maleNames[Math.floor(Math.random() * maleNames.length)]
            : femaleNames[Math.floor(Math.random() * femaleNames.length)];
        const surname = surnames[Math.floor(Math.random() * surnames.length)];
        
        // Generate login
        const randomNum = Math.floor(Math.random() * 1000);
        const login = `${firstName.toLowerCase()}.${surname.toLowerCase()}${randomNum}`;
        const fullName = `${firstName} ${surname}`;

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content name-generation-modal">
                <div class="modal-header">
                    <span>Генерация данных</span>
                    <button type="button" class="close-modal" onclick="closeNameModal(this)">×</button>
                </div>
                <div class="modal-body">
                    <div class="name-generation-container">
                        <div class="user-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        </div>
                        <div class="generated-fields">
                            <div class="field-container">
                                <div class="field-label">Имя</div>
                                <div class="field" onclick="copyToClipboard('${firstName}')" title="Нажмите, чтобы скопировать">${firstName}</div>
                            </div>
                            <div class="field-container">
                                <div class="field-label">Фамилия</div>
                                <div class="field" onclick="copyToClipboard('${surname}')" title="Нажмите, чтобы скопировать">${surname}</div>
                            </div>
                            <div class="field-container">
                                <div class="field-label">Логин</div>
                                <div class="field" onclick="copyToClipboard('${login}')" title="Нажмите, чтобы скопировать">${login}</div>
                            </div>
                        </div>
                        <div class="validity-info">
                            <div class="timer-info">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                                Действительно: 5:00 минут
                        </div>
                            <div class="usage-info">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="16" x2="12" y2="12"></line>
                                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                </svg>
                                Данные действительны для одной регистрации
                        </div>
                        </div>
                        <div class="action-buttons">
                            <button class="copy-data-button" onclick="copyToClipboard('${fullName}\\n${login}')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                Копировать все данные
                            </button>
                            <button class="generate-new-button" onclick="generateName()">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M23 4v6h-6"></path>
                                    <path d="M1 20v-6h6"></path>
                                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
                                    <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
                                </svg>
                                Сгенерировать новое
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .name-generation-modal {
                max-width: 360px !important;
                background: white !important;
                border-radius: 20px !important;
                overflow: hidden;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
            }

            .name-generation-modal .modal-header {
                background: var(--primary-color);
                padding: 1rem;
                color: white;
                font-size: 1rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .name-generation-modal .close-modal {
                color: white;
                background: none;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                padding: 0;
                line-height: 1;
            }

            .modal-body {
                padding: 1.5rem;
            }

            .name-generation-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 1.25rem;
            }

            .user-icon {
                width: 48px;
                height: 48px;
                background: var(--primary-color);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
            }

            .generated-fields {
                width: 100%;
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }

            .field-container {
                display: flex;
                flex-direction: column;
                gap: 0.25rem;
            }

            .field-label {
                font-size: 0.875rem;
                color: var(--text-secondary);
                margin-left: 0.5rem;
            }

            .field {
                background: rgba(168, 85, 247, 0.1);
                padding: 0.75rem 1rem;
                border-radius: 0.5rem;
                color: var(--primary-color);
                font-weight: 500;
                text-align: center;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .field:hover {
                background: rgba(168, 85, 247, 0.2);
                transform: translateY(-1px);
            }

            .field:active {
                transform: translateY(0);
            }

            .validity-info {
                width: 100%;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            .timer-info,
            .usage-info {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                color: var(--text-secondary);
                font-size: 0.875rem;
            }

            .timer-info svg,
            .usage-info svg {
                color: var(--primary-color);
                flex-shrink: 0;
            }

            .action-buttons {
                width: 100%;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            .copy-data-button,
            .generate-new-button {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                padding: 0.75rem;
                border-radius: 0.5rem;
                border: none;
                cursor: pointer;
                font-size: 0.875rem;
                transition: all 0.2s ease;
            }

            .copy-data-button {
                background: var(--primary-color);
                color: white;
            }

            .generate-new-button {
                background: #f3f4f6;
                color: var(--text-secondary);
            }

            .copy-data-button:hover {
                background: var(--primary-dark);
            }

            .generate-new-button:hover {
                background: #e5e7eb;
            }

            @media (max-width: 480px) {
                .name-generation-modal {
                    width: 90%;
                    margin: 1rem;
                }

                .modal-body {
                    padding: 1rem;
                }

                .field {
                    font-size: 0.9rem;
                }

                .timer-info,
                .usage-info {
                    font-size: 0.8rem;
                }
            }
        `;
        document.head.appendChild(style);

        // Add click handler to close modal
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeNameModal(e.target);
            }
        });
    };
    
    // Add new function to close name modal
    window.closeNameModal = (element) => {
        const modal = element.closest('.modal');
        if (modal) {
                modal.remove();
            // Remove associated styles
            document.querySelectorAll('style').forEach(style => {
                if (style.textContent.includes('.name-generation-modal')) {
                    style.remove();
            }
        });
        }
    };
    
    // Copy text to clipboard
    window.copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            
            // Создаем и показываем красивое уведомление
            const notification = document.createElement('div');
            notification.className = 'notification copy-notification';
            notification.innerHTML = `
                <div class="notification-content">
                    <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                        <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                        <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                    </svg>
                    <span>Код скопирован</span>
                </div>
            `;
            
            document.body.appendChild(notification);
            
            // Удаляем уведомление после анимации
            setTimeout(() => {
                notification.style.animation = 'fadeOut 0.5s ease-out forwards';
                setTimeout(() => notification.remove(), 500);
            }, 2000);
            
        } catch (error) {
            console.error('Failed to copy:', error);
            showError('Не удалось скопировать текст');
        }
    };
    
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

    // Запускаем проверку состояния сервера
    checkServerHealth();
    serverHealthCheckInterval = setInterval(checkServerHealth, 30000); // Каждые 30 секунд
    
    // Добавляем подсказки
    addTooltips();
    
    // Добавляем обработчики для улучшенного UX
    document.querySelectorAll('.button').forEach(button => {
        button.addEventListener('click', () => {
            if (!button.classList.contains('loading')) {
                const ripple = document.createElement('div');
                ripple.className = 'ripple';
                button.appendChild(ripple);
                
                setTimeout(() => {
                    ripple.remove();
                }, 1000);
            }
        });
    });

    // Инициализация
    addTooltips();
});

// Функции для копирования и управления почтой
async function copyEmail() {
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
}

async function refreshMessages() {
    if (currentEmail) {
        await loadMessages(currentEmail);
    }
}

async function deleteEmail() {
    if (currentEmail) {
        if (!confirm('Вы уверены, что хотите удалить этот почтовый ящик?')) {
            return;
        }
        
        try {
            showLoading();
            
            const response = await fetch(`/api/email/delete/${currentEmail}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Не удалось удалить почтовый ящик');
            }
            
            clearEmailCache();
            await createEmail();
            showSuccess('Почтовый ящик успешно удален');
            
        } catch (error) {
            console.error('Error:', error);
            showError(error.message);
        } finally {
            hideLoading();
        }
    }
}

// Добавляем функции в глобальную область видимости
window.copyEmail = copyEmail;
window.refreshMessages = refreshMessages;
window.deleteEmail = deleteEmail; 