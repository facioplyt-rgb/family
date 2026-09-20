import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, addDoc, doc, getDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBPU79D1OQtirYkfavhIOYS8zzttxbyrG4",
    authDomain: "family-44583.firebaseapp.com",
    projectId: "family-44583",
    storageBucket: "family-44583.firebasestorage.app",
    messagingSenderId: "273043875220",
    appId: "1:273043875220:web:6051fe0ef307ee1c891b81"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    
    // Nawigacja i uwierzytelnianie
    const authScreen = document.getElementById('auth-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');
    const userNameInput = document.getElementById('userNameInput');
    
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Obsługa wyglądu zakładek
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => {
                b.classList.remove('border-[#0078d4]', 'text-[#0078d4]');
                b.classList.add('border-transparent', 'text-gray-600');
            });
            btn.classList.add('border-[#0078d4]', 'text-[#0078d4]');
            btn.classList.remove('border-transparent', 'text-gray-600');

            tabContents.forEach(c => c.classList.add('hidden'));
            document.getElementById(btn.dataset.target).classList.remove('hidden');
            
            // Auto-scroll czatu po otwarciu zakładki
            if(btn.dataset.target === 'tab-chat') {
                const chatBox = document.getElementById('chatMessages');
                chatBox.scrollTop = chatBox.scrollHeight;
            }
        });
    });

    // Zmienne do przechowywania nasłuchiwaczy (żeby móc je odpiąć przy wylogowaniu)
    let unsubscribeChores, unsubscribeChat, unsubscribeReminders, unsubscribeAnnouncements;

    async function checkLoginStatus() {
        const savedFamilyId = localStorage.getItem('familyId');
        const savedUserName = localStorage.getItem('userName');

        if (savedFamilyId && savedUserName) {
            authScreen.classList.add('hidden');
            dashboardScreen.classList.remove('hidden');
            dashboardScreen.classList.add('flex');
            
            document.getElementById('dashboardUserName').innerText = `Witaj, ${savedUserName}`;
            document.getElementById('displayFamilyCode').innerText = savedFamilyId;

            try {
                const docSnap = await getDoc(doc(db, "families", savedFamilyId));
                if (docSnap.exists()) {
                    document.getElementById('dashboardFamilyName').innerText = docSnap.data().name;
                }
            } catch(e) { console.error(e); }

            // Uruchomienie nasłuchu danych w czasie rzeczywistym
            startRealtimeListeners(savedFamilyId);
        } else {
            authScreen.classList.remove('hidden');
            dashboardScreen.classList.add('hidden');
            dashboardScreen.classList.remove('flex');
        }
    }

    // --- REJESTRACJA / LOGOWANIE ---
    document.getElementById('createFamilyBtn')?.addEventListener('click', async () => {
        const userName = userNameInput.value.trim();
        const familyName = document.getElementById('familyNameInput').value.trim();
        if (!userName || !familyName) return alert("Podaj imię i nazwę!");

        const docRef = await addDoc(collection(db, "families"), { name: familyName, createdAt: new Date().toISOString() });
        localStorage.setItem('familyId', docRef.id);
        localStorage.setItem('userName', userName);
        checkLoginStatus();
    });

    document.getElementById('joinFamilyBtn')?.addEventListener('click', async () => {
        const userName = userNameInput.value.trim();
        const familyId = document.getElementById('joinFamilyInput').value.trim();
        if (!userName || !familyId) return alert("Podaj imię i kod!");

        const familySnap = await getDoc(doc(db, "families", familyId));
        if (familySnap.exists()) {
            localStorage.setItem('familyId', familyId);
            localStorage.setItem('userName', userName);
            checkLoginStatus();
        } else {
            alert("Nieprawidłowy kod.");
        }
    });

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        // Zatrzymanie pobierania danych
        if(unsubscribeChores) unsubscribeChores();
        if(unsubscribeChat) unsubscribeChat();
        if(unsubscribeReminders) unsubscribeReminders();
        if(unsubscribeAnnouncements) unsubscribeAnnouncements();
        
        localStorage.clear();
        window.location.reload();
    });

    // ==========================================
    // FUNKCJE CZASU RZECZYWISTEGO (LIVE SYNC)
    // ==========================================
    function startRealtimeListeners(familyId) {
        
        // 1. OBOWIĄZKI
        const qChores = query(collection(db, "families", familyId, "chores"), orderBy("createdAt", "desc"));
        unsubscribeChores = onSnapshot(qChores, (snapshot) => {
            const list = document.getElementById('choresList');
            list.innerHTML = '';
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                list.innerHTML += `
                    <div class="flex items-center justify-between p-3 border ${data.completed ? 'bg-gray-100 border-gray-200' : 'bg-white border-gray-300'} rounded-sm">
                        <div class="flex items-center gap-3">
                            <input type="checkbox" ${data.completed ? 'checked' : ''} onclick="window.toggleChore('${docSnap.id}', ${data.completed})" class="w-4 h-4 text-blue-600 rounded-sm focus:ring-blue-500 cursor-pointer">
                            <span class="${data.completed ? 'line-through text-gray-400' : 'text-gray-800'}">${data.title}</span>
                            ${data.assignee ? `<span class="text-xs border border-gray-200 bg-gray-50 text-gray-500 px-2 py-0.5 rounded-sm">${data.assignee}</span>` : ''}
                        </div>
                        <button onclick="window.deleteChore('${docSnap.id}')" class="text-gray-400 hover:text-red-600" title="Usuń">✕</button>
                    </div>`;
            });
        });

        // 2. CZAT (Nowość)
        const qChat = query(collection(db, "families", familyId, "messages"), orderBy("createdAt", "asc"));
        unsubscribeChat = onSnapshot(qChat, (snapshot) => {
            const chatBox = document.getElementById('chatMessages');
            const currentUser = localStorage.getItem('userName');
            const isScrolledToBottom = chatBox.scrollHeight - chatBox.clientHeight <= chatBox.scrollTop + 50;
            
            chatBox.innerHTML = '';
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const isMe = data.author === currentUser;
                
                chatBox.innerHTML += `
                    <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
                        <span class="text-[10px] text-gray-400 mb-1 px-1">${data.author}</span>
                        <div class="max-w-[75%] p-3 text-sm rounded-sm ${isMe ? 'bg-[#0078d4] text-white' : 'bg-gray-100 border border-gray-200 text-gray-800'}">
                            ${data.text}
                        </div>
                    </div>`;
            });
            
            // Automatyczne przewijanie w dół, jeśli użytkownik nie czyta historii wyżej
            if (isScrolledToBottom) {
                chatBox.scrollTop = chatBox.scrollHeight;
            }
        });

        // 3. PRZYPOMNIENIA (Nowość)
        const qReminders = query(collection(db, "families", familyId, "reminders"), orderBy("date", "asc"));
        unsubscribeReminders = onSnapshot(qReminders, (snapshot) => {
            const list = document.getElementById('remindersList');
            const badge = document.getElementById('reminderBadge');
            list.innerHTML = '';
            let activeReminders = 0;
            
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const isPast = new Date(data.date) < new Date(new Date().setHours(0,0,0,0));
                
                if(!data.completed) activeReminders++;

                list.innerHTML += `
                    <div class="flex items-center justify-between p-3 border ${data.completed ? 'bg-gray-50 border-gray-200 opacity-60' : (isPast ? 'bg-red-50 border-red-200' : 'bg-white border-gray-300')} rounded-sm">
                        <div>
                            <span class="font-semibold ${data.completed ? 'line-through text-gray-400' : 'text-gray-800'}">${data.title}</span>
                            <span class="text-xs ml-2 ${isPast && !data.completed ? 'text-red-600 font-bold' : 'text-gray-500'}">Termin: ${data.date}</span>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="window.toggleReminder('${docSnap.id}', ${data.completed})" class="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-sm">
                                ${data.completed ? 'Przywróć' : 'Zrobione'}
                            </button>
                            <button onclick="window.deleteReminder('${docSnap.id}')" class="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded-sm">✕</button>
                        </div>
                    </div>`;
            });
            
            // Aktualizacja powiadomienia (czerwonej kropki) na zakładce
            if(activeReminders > 0) {
                badge.classList.remove('hidden');
                badge.innerText = activeReminders;
            } else {
                badge.classList.add('hidden');
            }
        });

        // 4. OGŁOSZENIA
        const qAnnouncements = query(collection(db, "families", familyId, "announcements"), orderBy("createdAt", "desc"));
        unsubscribeAnnouncements = onSnapshot(qAnnouncements, (snapshot) => {
            const list = document.getElementById('announcementsList');
            list.innerHTML = '';
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                list.innerHTML += `
                    <div class="p-4 bg-[#f3f2f1] border-l-4 border-[#0078d4] text-sm">
                        <p class="text-gray-800 whitespace-pre-wrap">${data.text}</p>
                        <div class="mt-2 text-xs text-gray-500">Dodał/a: ${data.author}</div>
                    </div>`;
            });
        });
    }

    // ==========================================
    // DODAWANIE DO BAZY
    // ==========================================

    // Obowiązki
    document.getElementById('addChoreBtn')?.addEventListener('click', async () => {
        const title = document.getElementById('choreTitle').value.trim();
        const assignee = document.getElementById('choreAssignee').value.trim();
        if (!title) return;
        await addDoc(collection(db, "families", localStorage.getItem('familyId'), "chores"), {
            title, assignee, completed: false, createdAt: new Date().toISOString()
        });
        document.getElementById('choreTitle').value = '';
        document.getElementById('choreAssignee').value = '';
    });

    // Czat
    document.getElementById('sendChatBtn')?.addEventListener('click', async () => {
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        if (!text) return;
        
        await addDoc(collection(db, "families", localStorage.getItem('familyId'), "messages"), {
            text: text,
            author: localStorage.getItem('userName'),
            createdAt: new Date().toISOString()
        });
        input.value = '';
    });
    
    // Wysyłanie wiadomości po wciśnięciu Enter
    document.getElementById('chatInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('sendChatBtn').click();
    });

    // Przypomnienia
    document.getElementById('addReminderBtn')?.addEventListener('click', async () => {
        const title = document.getElementById('reminderTitle').value.trim();
        const date = document.getElementById('reminderDate').value;
        if (!title || !date) return alert("Uzupełnij nazwę i datę!");

        await addDoc(collection(db, "families", localStorage.getItem('familyId'), "reminders"), {
            title, date, completed: false, createdAt: new Date().toISOString()
        });
        document.getElementById('reminderTitle').value = '';
        document.getElementById('reminderDate').value = '';
    });

    // Ogłoszenia
    document.getElementById('addAnnouncementBtn')?.addEventListener('click', async () => {
        const text = document.getElementById('announcementText').value.trim();
        if (!text) return;
        await addDoc(collection(db, "families", localStorage.getItem('familyId'), "announcements"), {
            text, author: localStorage.getItem('userName'), createdAt: new Date().toISOString()
        });
        document.getElementById('announcementText').value = '';
    });


    // ==========================================
    // FUNKCJE GLOBALNE DLA PRZYCISKÓW W LISTACH
    // ==========================================
    window.toggleChore = async (id, current) => {
        await updateDoc(doc(db, "families", localStorage.getItem('familyId'), "chores", id), { completed: !current });
    };
    window.deleteChore = async (id) => {
        await deleteDoc(doc(db, "families", localStorage.getItem('familyId'), "chores", id));
    };
    window.toggleReminder = async (id, current) => {
        await updateDoc(doc(db, "families", localStorage.getItem('familyId'), "reminders", id), { completed: !current });
    };
    window.deleteReminder = async (id) => {
        await deleteDoc(doc(db, "families", localStorage.getItem('familyId'), "reminders", id));
    };

    // Inicjalizacja Start
    checkLoginStatus();
});
