import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, addDoc, setDoc, doc, getDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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

// ==========================================
// PWA: REJESTRACJA SERVICE WORKERA I INSTALACJA
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.error("SW fail:", err));
    });
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('installAppBtnWrapper').style.display = 'block';
});

document.getElementById('installAppBtn')?.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            document.getElementById('installAppBtnWrapper').style.display = 'none';
        }
        deferredPrompt = null;
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const authScreen = document.getElementById('auth-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');
    
    // Zakładki
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => {
                b.classList.remove('border-[#0078d4]', 'text-[#0078d4]');
                b.classList.add('border-transparent', 'text-[#605e5c]');
            });
            btn.classList.add('border-[#0078d4]', 'text-[#0078d4]');
            btn.classList.remove('border-transparent', 'text-[#605e5c]');
            tabContents.forEach(c => c.classList.add('hidden'));
            document.getElementById(btn.dataset.target).classList.remove('hidden');
            
            if(btn.dataset.target === 'tab-chat') {
                const chatBox = document.getElementById('chatMessages');
                chatBox.scrollTop = chatBox.scrollHeight;
            }
        });
    });

    let liveListeners = [];

    // Generator unikalnego ID dla użytkownika (aby Admin działał)
    function getUserId() {
        let uid = localStorage.getItem('userId');
        if (!uid) {
            uid = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('userId', uid);
        }
        return uid;
    }

    async function checkLoginStatus() {
        const savedFamilyId = localStorage.getItem('familyId');
        const savedUserName = localStorage.getItem('userName');
        const userId = getUserId();

        if (savedFamilyId && savedUserName) {
            authScreen.classList.add('hidden');
            dashboardScreen.classList.remove('hidden');
            dashboardScreen.classList.add('flex');
            
            document.getElementById('dashboardUserName').innerText = savedUserName;
            document.getElementById('displayFamilyCode').innerText = savedFamilyId;

            try {
                const docSnap = await getDoc(doc(db, "families", savedFamilyId));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    document.getElementById('dashboardFamilyName').innerText = data.name;
                    
                    // Sprawdzanie czy użytkownik jest adminem
                    if (data.adminId === userId) {
                        document.getElementById('adminBadge').classList.remove('hidden');
                        document.getElementById('adminPanel').classList.remove('hidden');
                        document.getElementById('adminRenameInput').value = data.name;
                    } else {
                        document.getElementById('adminBadge').classList.add('hidden');
                        document.getElementById('adminPanel').classList.add('hidden');
                    }
                } else {
                    // Grupa została usunięta lub użytkownik wpisał złe ID
                    logout();
                    return;
                }
            } catch(e) { console.error(e); }

            startRealtimeListeners(savedFamilyId, userId);
        } else {
            authScreen.classList.remove('hidden');
            dashboardScreen.classList.add('hidden');
            dashboardScreen.classList.remove('flex');
        }
    }

    // --- REJESTRACJA / DOŁĄCZANIE ---
    document.getElementById('createFamilyBtn')?.addEventListener('click', async () => {
        const userName = document.getElementById('userNameInput').value.trim();
        const familyName = document.getElementById('familyNameInput').value.trim();
        if (!userName || !familyName) return alert("Podaj imię i nazwę przestrzeni!");

        const userId = getUserId();
        
        // Tworzymy główny dokument rodziny z polem adminId
        const docRef = await addDoc(collection(db, "families"), { 
            name: familyName, 
            adminId: userId,
            createdAt: new Date().toISOString() 
        });

        // Dodajemy twórcę jako pierwszego członka
        await setDoc(doc(db, "families", docRef.id, "members", userId), { name: userName, role: 'admin' });

        localStorage.setItem('familyId', docRef.id);
        localStorage.setItem('userName', userName);
        checkLoginStatus();
    });

    document.getElementById('joinFamilyBtn')?.addEventListener('click', async () => {
        const userName = document.getElementById('userNameInput').value.trim();
        const familyId = document.getElementById('joinFamilyInput').value.trim();
        if (!userName || !familyId) return alert("Podaj imię i kod dostępu!");

        const userId = getUserId();
        const familySnap = await getDoc(doc(db, "families", familyId));
        
        if (familySnap.exists()) {
            // Dodajemy użytkownika do listy członków
            await setDoc(doc(db, "families", familyId, "members", userId), { name: userName, role: 'member' });

            localStorage.setItem('familyId', familyId);
            localStorage.setItem('userName', userName);
            checkLoginStatus();
        } else {
            alert("Nie znaleziono takiej grupy. Sprawdź kod.");
        }
    });

    function logout() {
        liveListeners.forEach(unsub => unsub());
        liveListeners = [];
        localStorage.removeItem('familyId');
        localStorage.removeItem('userName');
        window.location.reload();
    }
    
    document.getElementById('logoutBtn')?.addEventListener('click', logout);

    // ==========================================
    // FUNKCJE CZASU RZECZYWISTEGO (LIVE SYNC)
    // ==========================================
    function startRealtimeListeners(familyId, currentUserId) {
        
        // 1. CZŁONKOWIE (Do ekranu głównego, listy rozwijanej w zadaniach i Panelu Admina)
        const qMembers = collection(db, "families", familyId, "members");
        const unsubMembers = onSnapshot(qMembers, (snapshot) => {
            const homeList = document.getElementById('homeMembersList');
            const adminList = document.getElementById('adminMembersList');
            const choreSelect = document.getElementById('choreAssignee');
            
            homeList.innerHTML = ''; adminList.innerHTML = '';
            
            // Opcja "Wszyscy" zawsze w select
            choreSelect.innerHTML = '<option value="">Przypisz: Wszyscy</option>';

            let imInTheGroup = false;

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                if(docSnap.id === currentUserId) imInTheGroup = true;

                // Do ekranu głównego
                homeList.innerHTML += `<div class="bg-[#f3f2f1] px-3 py-1.5 rounded-full border border-[#edebe9] text-[#323130] font-medium flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full ${data.role === 'admin' ? 'bg-[#0078d4]' : 'bg-[#107c10]'}"></div>
                    ${data.name} ${data.role === 'admin' ? '(Admin)' : ''}
                </div>`;

                // Do Selecta w zadaniach
                choreSelect.innerHTML += `<option value="${data.name}">${data.name}</option>`;

                // Do Panelu Admina
                if(docSnap.id !== currentUserId) { // Admin nie może usunąć sam siebie
                    adminList.innerHTML += `
                        <li class="flex justify-between items-center p-3 bg-white">
                            <span class="font-medium">${data.name}</span>
                            <button onclick="window.kickMember('${docSnap.id}')" class="text-[#d13438] hover:bg-[#fde7e9] px-3 py-1 rounded-sm transition-colors">Usuń</button>
                        </li>`;
                }
            });

            // Jeśli admin kogoś usunął, wyloguj go przymusowo
            if(!imInTheGroup) logout();
        });
        liveListeners.push(unsubMembers);

        // 2. LISTA ZAKUPÓW (Nowość)
        const qShop = query(collection(db, "families", familyId, "shopping"), orderBy("createdAt", "desc"));
        const unsubShop = onSnapshot(qShop, (snapshot) => {
            const list = document.getElementById('shoppingList');
            list.innerHTML = '';
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                list.innerHTML += `
                    <div class="flex items-center justify-between p-3 border-b border-[#edebe9] ${data.completed ? 'bg-[#faf9f8]' : 'bg-white'} transition-colors">
                        <div class="flex items-center gap-3">
                            <input type="checkbox" ${data.completed ? 'checked' : ''} onclick="window.toggleShopItem('${docSnap.id}', ${data.completed})" class="w-5 h-5 accent-[#0078d4] cursor-pointer">
                            <span class="${data.completed ? 'line-through text-[#a19f9d]' : 'text-[#323130] font-medium'}">${data.title}</span>
                        </div>
                        <button onclick="window.deleteShopItem('${docSnap.id}')" class="text-[#a19f9d] hover:text-[#d13438] px-2" title="Usuń z listy">✕</button>
                    </div>`;
            });
        });
        liveListeners.push(unsubShop);

        // 3. OBOWIĄZKI
        const qChores = query(collection(db, "families", familyId, "chores"), orderBy("createdAt", "desc"));
        const unsubChores = onSnapshot(qChores, (snapshot) => {
            const list = document.getElementById('choresList');
            list.innerHTML = '';
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                list.innerHTML += `
                    <div class="flex items-center justify-between p-3 border-b border-[#edebe9] ${data.completed ? 'bg-[#faf9f8]' : 'bg-white'}">
                        <div class="flex items-center gap-3">
                            <input type="checkbox" ${data.completed ? 'checked' : ''} onclick="window.toggleChore('${docSnap.id}', ${data.completed})" class="w-5 h-5 accent-[#0078d4] cursor-pointer">
                            <span class="${data.completed ? 'line-through text-[#a19f9d]' : 'text-[#323130] font-medium'}">${data.title}</span>
                            ${data.assignee ? `<span class="text-xs bg-[#e1dfdd] text-[#323130] px-2 py-0.5 rounded-sm">${data.assignee}</span>` : ''}
                        </div>
                        <button onclick="window.deleteChore('${docSnap.id}')" class="text-[#a19f9d] hover:text-[#d13438] px-2">✕</button>
                    </div>`;
            });
        });
        liveListeners.push(unsubChores);

        // 4. CZAT
        const qChat = query(collection(db, "families", familyId, "messages"), orderBy("createdAt", "asc"));
        const unsubChat = onSnapshot(qChat, (snapshot) => {
            const chatBox = document.getElementById('chatMessages');
            const currentUser = localStorage.getItem('userName');
            const isScrolledToBottom = chatBox.scrollHeight - chatBox.clientHeight <= chatBox.scrollTop + 50;
            
            chatBox.innerHTML = '';
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const isMe = data.author === currentUser;
                
                chatBox.innerHTML += `
                    <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
                        <span class="text-[11px] text-[#605e5c] mb-1">${data.author}</span>
                        <div class="max-w-[85%] px-4 py-2 text-sm rounded-sm ${isMe ? 'bg-[#0078d4] text-white' : 'bg-[#f3f2f1] text-[#323130]'} shadow-sm">
                            ${data.text}
                        </div>
                    </div>`;
            });
            if (isScrolledToBottom) chatBox.scrollTop = chatBox.scrollHeight;
        });
        liveListeners.push(unsubChat);

        // 5. PRZYPOMNIENIA
        const qReminders = query(collection(db, "families", familyId, "reminders"), orderBy("date", "asc"));
        const unsubReminders = onSnapshot(qReminders, (snapshot) => {
            const list = document.getElementById('remindersList');
            const badge = document.getElementById('reminderBadge');
            list.innerHTML = ''; let activeReminders = 0;
            
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const isPast = new Date(data.date) < new Date(new Date().setHours(0,0,0,0));
                if(!data.completed) activeReminders++;

                list.innerHTML += `
                    <div class="flex items-center justify-between p-3 border-l-4 ${data.completed ? 'border-[#a19f9d] bg-[#faf9f8]' : (isPast ? 'border-[#d13438] bg-white' : 'border-[#0078d4] bg-white')} shadow-sm mb-2 rounded-r-sm border-y border-r border-y-[#edebe9] border-r-[#edebe9]">
                        <div>
                            <span class="font-semibold ${data.completed ? 'line-through text-[#a19f9d]' : 'text-[#323130]'}">${data.title}</span>
                            <span class="text-xs ml-3 ${isPast && !data.completed ? 'text-[#d13438] font-bold' : 'text-[#605e5c]'}">Termin: ${data.date}</span>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="window.toggleReminder('${docSnap.id}', ${data.completed})" class="text-xs px-3 py-1 bg-[#f3f2f1] hover:bg-[#edebe9] text-[#323130] font-medium rounded-sm border border-[#edebe9]">
                                ${data.completed ? 'Przywróć' : 'Zrobione'}
                            </button>
                            <button onclick="window.deleteReminder('${docSnap.id}')" class="text-xs px-3 py-1 text-[#d13438] hover:bg-[#fde7e9] rounded-sm">✕</button>
                        </div>
                    </div>`;
            });
            if(activeReminders > 0) { badge.classList.remove('hidden'); badge.innerText = activeReminders; }
            else { badge.classList.add('hidden'); }
        });
        liveListeners.push(unsubReminders);

        // 6. OGŁOSZENIA
        const qAnnouncements = query(collection(db, "families", familyId, "announcements"), orderBy("createdAt", "desc"));
        const unsubAnnouncements = onSnapshot(qAnnouncements, (snapshot) => {
            const list = document.getElementById('announcementsList');
            list.innerHTML = '';
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                list.innerHTML += `
                    <div class="p-4 bg-[#fff4ce] border border-[#fde7e9] text-sm shadow-sm rounded-sm">
                        <p class="text-[#323130] font-medium whitespace-pre-wrap">${data.text}</p>
                        <div class="mt-3 text-xs text-[#605e5c] border-t border-[#edebe9] pt-2">Ogłosił/a: ${data.author}</div>
                    </div>`;
            });
        });
        liveListeners.push(unsubAnnouncements);
    }

    // ==========================================
    // DODAWANIE DO BAZY I FUNKCJE GLOBALNE
    // ==========================================

    // ZAKUPY
    document.getElementById('addShopItemBtn')?.addEventListener('click', async () => {
        const title = document.getElementById('shopItemTitle').value.trim();
        if (!title) return;
        await addDoc(collection(db, "families", localStorage.getItem('familyId'), "shopping"), {
            title, completed: false, createdAt: new Date().toISOString()
        });
        document.getElementById('shopItemTitle').value = '';
    });
    window.toggleShopItem = async (id, current) => { await updateDoc(doc(db, "families", localStorage.getItem('familyId'), "shopping", id), { completed: !current }); };
    window.deleteShopItem = async (id) => { await deleteDoc(doc(db, "families", localStorage.getItem('familyId'), "shopping", id)); };

    // OBOWIĄZKI
    document.getElementById('addChoreBtn')?.addEventListener('click', async () => {
        const title = document.getElementById('choreTitle').value.trim();
        const assignee = document.getElementById('choreAssignee').value;
        if (!title) return;
        await addDoc(collection(db, "families", localStorage.getItem('familyId'), "chores"), {
            title, assignee, completed: false, createdAt: new Date().toISOString()
        });
        document.getElementById('choreTitle').value = '';
    });
    window.toggleChore = async (id, current) => { await updateDoc(doc(db, "families", localStorage.getItem('familyId'), "chores", id), { completed: !current }); };
    window.deleteChore = async (id) => { await deleteDoc(doc(db, "families", localStorage.getItem('familyId'), "chores", id)); };

    // CZAT
    document.getElementById('sendChatBtn')?.addEventListener('click', async () => {
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        if (!text) return;
        await addDoc(collection(db, "families", localStorage.getItem('familyId'), "messages"), {
            text: text, author: localStorage.getItem('userName'), createdAt: new Date().toISOString()
        });
        input.value = '';
    });
    document.getElementById('chatInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('sendChatBtn').click();
    });

    // PRZYPOMNIENIA
    document.getElementById('addReminderBtn')?.addEventListener('click', async () => {
        const title = document.getElementById('reminderTitle').value.trim();
        const date = document.getElementById('reminderDate').value;
        if (!title || !date) return;
        await addDoc(collection(db, "families", localStorage.getItem('familyId'), "reminders"), {
            title, date, completed: false, createdAt: new Date().toISOString()
        });
        document.getElementById('reminderTitle').value = ''; document.getElementById('reminderDate').value = '';
    });
    window.toggleReminder = async (id, current) => { await updateDoc(doc(db, "families", localStorage.getItem('familyId'), "reminders", id), { completed: !current }); };
    window.deleteReminder = async (id) => { await deleteDoc(doc(db, "families", localStorage.getItem('familyId'), "reminders", id)); };

    // OGŁOSZENIA
    document.getElementById('addAnnouncementBtn')?.addEventListener('click', async () => {
        const text = document.getElementById('announcementText').value.trim();
        if (!text) return;
        await addDoc(collection(db, "families", localStorage.getItem('familyId'), "announcements"), {
            text, author: localStorage.getItem('userName'), createdAt: new Date().toISOString()
        });
        document.getElementById('announcementText').value = '';
    });

    // PANEL ADMINA
    document.getElementById('adminRenameBtn')?.addEventListener('click', async () => {
        const newName = document.getElementById('adminRenameInput').value.trim();
        if (!newName) return;
        await updateDoc(doc(db, "families", localStorage.getItem('familyId')), { name: newName });
        document.getElementById('dashboardFamilyName').innerText = newName;
        alert("Zmieniono nazwę przestrzeni roboczej!");
    });
    
    window.kickMember = async (targetUserId) => {
        if(confirm("Na pewno usunąć tego członka grupy? Straci on dostęp do panelu.")) {
            await deleteDoc(doc(db, "families", localStorage.getItem('familyId'), "members", targetUserId));
        }
    };

    checkLoginStatus();
});
