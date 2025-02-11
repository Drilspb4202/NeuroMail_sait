document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded');
    
    const currentEmailElement = document.getElementById('currentEmail');
    const messageList = document.getElementById('messageList');
    const messageCount = document.getElementById('messageCount');
    const loadingIndicator = document.getElementById('loading');
    const autoRefreshToggle = document.getElementById('autoRefreshToggle');
    const refreshIntervalSelect = document.getElementById('refreshInterval');
    
    let currentEmail = null;
    let autoRefreshInterval = null;
    
    // Create initial email
    createEmail();
    
    // Create email account
    async function createEmail() {
        try {
            showLoading();
            
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
            currentEmailElement.textContent = currentEmail;
            currentEmailElement.style.color = ''; // Сбрасываем цвет
            
            // Start auto-refresh
            startAutoRefresh();
            
        } catch (error) {
            console.error('Error:', error);
            if (!currentEmailElement.textContent.includes('Сервис временно перегружен')) {
                currentEmailElement.textContent = 'Сервис временно перегружен, попробуйте через пару минут';
                currentEmailElement.style.color = 'var(--danger-color)';
            }
            showError(error.message);
        } finally {
            hideLoading();
        }
    }
    
    // Copy email to clipboard
    window.copyEmail = async () => {
        if (currentEmail) {
            try {
                await navigator.clipboard.writeText(currentEmail);
                showSuccess('Email скопирован в буфер обмена');
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
        
        loadMessages(currentEmail); // Initial load
        
        if (autoRefreshToggle.checked) {
            const interval = parseInt(refreshIntervalSelect.value);
            autoRefreshInterval = setInterval(() => {
                console.log('Auto-refresh: loading messages');
                if (currentEmail) {
                    loadMessages(currentEmail);
                }
            }, interval);
        }
    }
    
    // Handle auto-refresh toggle
    autoRefreshToggle.addEventListener('change', () => {
        if (autoRefreshToggle.checked) {
            startAutoRefresh();
        } else {
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
            }
        }
    });
    
    // Handle refresh interval change
    refreshIntervalSelect.addEventListener('change', () => {
        if (autoRefreshToggle.checked) {
            startAutoRefresh();
        }
    });
    
    // Load messages
    async function loadMessages(email) {
        console.log('Loading messages for:', email);
        try {
            const response = await fetch(`/api/email/messages/${email}`);
            console.log('Messages response status:', response.status);
            
            if (!response.ok) {
                throw new Error('Не удалось загрузить сообщения');
            }
            
            const messages = await response.json();
            console.log('Received messages:', messages);
            
            if (!Array.isArray(messages)) {
                if (messages.detail) {
                    throw new Error(messages.detail);
                }
                throw new Error('Неверный формат данных');
            }
            
            renderMessages(messages);
            updateMessageCount(messages.length);
            
        } catch (error) {
            console.error('Error loading messages:', error);
            showError(error.message);
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
    
    // Render messages
    function renderMessages(messages) {
        console.log('Rendering messages:', messages);
        
        if (!Array.isArray(messages) || messages.length === 0) {
            messageList.innerHTML = '<div class="no-messages">Нет сообщений</div>';
            return;
        }
        
        messageList.innerHTML = '';
        
        messages.forEach(message => {
            if (!message) return;
            
            console.log('Processing message:', message);
            const messageElement = document.createElement('div');
            messageElement.className = 'message';
            
            // Безопасное извлечение имени отправителя и email
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
                
                // Безопасное получение ID сообщения
                const messageId = message.message_id;
                console.log('Message ID:', messageId);

                // Проверяем наличие ссылки в сообщении
                let verificationLink = null;
                
                // Проверяем разные источники ссылки
                if (message.verification_link) {
                    verificationLink = message.verification_link;
                    console.log('Found verification_link:', verificationLink);
                }
                
                // Проверяем содержимое на наличие ссылок
                if (!verificationLink && message.content) {
                    const contentLinks = extractLinksFromText(message.content);
                    if (contentLinks.length > 0) {
                        verificationLink = contentLinks[0];
                        console.log('Found link in content:', verificationLink);
                    }
                }
                
                // Проверяем HTML содержимое
                if (!verificationLink && message.html_content) {
                    const htmlLinks = extractLinksFromHtml(message.html_content);
                    if (htmlLinks.length > 0) {
                        verificationLink = htmlLinks[0];
                        console.log('Found link in html_content:', verificationLink);
                    }
                }
                
                // Создаем содержимое для поля subject
                let subjectContent;
                if (message.verification_code) {
                    subjectContent = `
                        <div class="verification-code">
                            <span class="code-label">Код подтверждения:</span>
                            <span class="code-value">${message.verification_code}</span>
                            <button class="copy-button" onclick="copyToClipboard('${message.verification_code}')" title="Копировать код">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </button>
                        </div>`;
                } else if (verificationLink || message.subject.toLowerCase().includes('sign up link')) {
                    subjectContent = `
                        <button class="verification-link-button" onclick="window.open('${verificationLink || '#'}', '_blank')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                            <span>Перейти по ссылке</span>
                        </button>`;
                } else {
                    subjectContent = message.subject || 'Без темы';
                }
                
                messageElement.innerHTML = `
                    <div class="message-sender">
                        <span class="sender-name">${senderName}</span>
                        ${senderEmail ? `<span class="sender-email">${senderEmail}</span>` : ''}
                    </div>
                    <div class="message-subject">${subjectContent}</div>
                    <button class="view-button" onclick="viewMessage('${messageId}')" 
                            title="Просмотреть сообщение">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                `;
                
                messageList.appendChild(messageElement);
            } catch (error) {
                console.error('Error rendering message:', error);
            }
        });
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
            showLoading();
            const url = `/api/email/messages/${currentEmail}/${messageId}`;
            console.log('Fetching from URL:', url);
            
            const response = await fetch(url);
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                console.error('Response not OK:', response.status);
                if (response.status === 404) {
                    throw new Error('Сообщение не найдено');
                }
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Не удалось загрузить сообщение');
            }
            
            const message = await response.json();
            console.log('Message data:', message);
            
            if (!message) {
                console.error('Empty message data');
                throw new Error('Пустой ответ от сервера');
            }

            // Извлекаем ссылку из сообщения
            let verificationLink = null;
            
            // Проверяем разные источники ссылки
            if (message.verification_link) {
                verificationLink = message.verification_link;
                console.log('Found verification_link:', verificationLink);
            }
            
            // Проверяем содержимое на наличие ссылок
            if (!verificationLink && message.content) {
                const contentLinks = extractLinksFromText(message.content);
                console.log('Content links found:', contentLinks);
                if (contentLinks.length > 0) {
                    verificationLink = contentLinks[0];
                    console.log('Using link from content:', verificationLink);
                }
            }
            
            // Проверяем HTML содержимое
            if (!verificationLink && message.html_content) {
                const htmlLinks = extractLinksFromHtml(message.html_content);
                console.log('HTML links found:', htmlLinks);
                if (htmlLinks.length > 0) {
                    verificationLink = htmlLinks[0];
                    console.log('Using link from HTML:', verificationLink);
                }
            }

            console.log('Final verification link:', verificationLink);
            
            // Подготавливаем контент
            let messageContent = message.html_content || message.content || 'Содержимое недоступно';
            console.log('Message content type:', message.html_content ? 'HTML' : 'Text');
            
            // Создаем модальное окно
            const modal = document.createElement('div');
            modal.className = 'modal';
            
            // Если есть ссылка, добавляем кнопку
            if (verificationLink) {
                messageContent = `
                    <div style="margin-bottom: 1.5rem;">
                        <button class="verification-link-button" onclick="window.open('${verificationLink}', '_blank')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                            <span>Перейти по ссылке</span>
                        </button>
                    </div>
                    ${messageContent}`;
            }
            
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="header-info">
                            <h3>${message.subject || 'Без темы'}</h3>
                            <div class="message-meta">
                                <span class="sender">${message.sender}</span>
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
                    modal.remove();
                    console.log('Modal closed');
                }
            });
            
        } catch (error) {
            console.error('Error in viewMessage:', error);
            showError(error.message);
        } finally {
            hideLoading();
            console.groupEnd();
        }
    };
    
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
    window.generatePassword = () => {
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
        
        // Копируем пароль в буфер обмена
        navigator.clipboard.writeText(password)
            .then(() => {
                showSuccess(`Сгенерирован пароль: ${password}\nСкопирован в буфер обмена`);
            })
            .catch(() => {
                showError('Не удалось скопировать пароль');
            });
    };
    
    // Create new email account
    window.createNewEmail = async () => {
        try {
            showLoading();
            
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
                throw new Error(data.detail || 'Не удалось создать почтовый ящик');
            }
            
            currentEmail = data.email;
            currentEmailElement.textContent = currentEmail;
            
            // Start auto-refresh
            startAutoRefresh();
            
            showSuccess('Создан новый почтовый ящик');
            
        } catch (error) {
            console.error('Error:', error);
            showError(error.message);
        } finally {
            hideLoading();
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
            'Sarah', 'Karen', 'Lisa', 'Nancy', 'Betty', 'Margaret', 'Sandra', 'Ashley',
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
    
    // Utility functions
    function showLoading() {
        loadingIndicator.classList.add('active');
    }
    
    function hideLoading() {
        loadingIndicator.classList.remove('active');
    }
    
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
    
    // Улучшенная функция извлечения ссылок из текста
    function extractLinksFromText(text) {
        if (!text) {
            console.log('extractLinksFromText: empty text');
            return [];
        }
        const urlRegex = /(https?:\/\/[^\s<>"]+)/g;
        const matches = text.match(urlRegex) || [];
        console.log('extractLinksFromText found links:', matches);
        return matches;
    }
    
    // Улучшенная функция извлечения ссылок из HTML
    function extractLinksFromHtml(html) {
        if (!html) {
            console.log('extractLinksFromHtml: empty HTML');
            return [];
        }
        try {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            const links = Array.from(tempDiv.getElementsByTagName('a'))
                .map(a => a.href)
                .filter(href => href && href.startsWith('http'));
            console.log('extractLinksFromHtml found links:', links);
            return links;
        } catch (error) {
            console.error('Error in extractLinksFromHtml:', error);
            return [];
        }
    }
}); 