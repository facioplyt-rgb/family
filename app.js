import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, addDoc, setDoc, doc, getDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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

let currentUserRole = 'child'; // Domyślna bezpieczna rola
let locationWatchId = null;
let leafletMap = null;
let mapMarkers = {};

// SYSTEM POWIADOMIEŃ (TOAST)
window.showToast = (message, isAlert = false) => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast-enter p-4 rounded-sm shadow-md text-white font-semibold text-sm pointer-events-auto ${isAlert ? 'bg-[#d13438]' : 'bg-[#0078d4]'}`;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 5000);
};

document.addEventListener('DOMContentLoaded', () => {
    const authScreen = document.getElementById('auth-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');
    let liveListeners = [];

    // ZAKŁADKI
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => {
                b.classList.remove('border-[#0078d4]', 'text-[#0078d4]');
                b.classList.add('border-transparent', 'text-[#605e5c]');
            });
            btn.classList.add('border-[#0078d4]', 'text-[#0078d4]');
            
            tabContents.forEach(c => c.classList.add('hidden'));
            document.getElementById(btn.dataset.target).classList.remove('hidden');
            
            // Inicjalizacja mapy Leaflet po pokazaniu taba
            if (btn.dataset.target === 'tab-location' && !leafletMap) {
                initMap();
            } else if (leafletMap) {
                setTimeout(() => leafletMap.invalidateSize(), 100);
            }
        });
    });

    function getUserId() {
        let uid = localStorage.getItem('userId');
        if (!uid) { uid = 'user_' + Math.random().toString(36).substr(2, 9); localStorage.setItem('userId', uid); }
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
                    document.getElementById('dashboardFamilyName').innerText = docSnap.data().name;
                } else {
                    logout(); return;
                }
            } catch(e) {}

            startRealtimeListeners(savedFamilyId, userId);
        } else {
            authScreen.classList.remove('hidden');
            dashboardScreen.classList.add('hidden');
            dashboardScreen.classList.remove('flex');
        }
    }

    // MAPA
    function initMap() {
        leafletMap = L.map('map').setView([52.0692, 19.4803], 6); // Centrum Polski domyślnie
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(leafletMap);
    }

    document.getElementById('toggleLocationBtn')?.addEventListener('click', () => {
        const btn = document.getElementById('toggleLocationBtn');
        if (locationWatchId) {
            navigator.geolocation.clearWatch(locationWatchId);
            locationWatchId = null;
            btn.innerText = "Udostępniaj moją lokalizację";
            btn.classList.replace('bg-[#d13438]', 'bg-[#0078d4]');
            // Kasowanie lokalizacji w bazie
            updateDoc(doc(db, "families", localStorage.getItem('familyId'), "members", getUserId()), { lat: null, lng: null });
        } else {
            if (navigator.geolocation) {
                locationWatchId = navigator.geolocation.watchPosition(
                    (position) => {
                        updateDoc(doc(db, "families", localStorage.getItem('familyId'), "members", getUserId()), {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                            locTime: new Date().toLocaleTimeString()
                        });
                    },
                    (error) => alert("Błąd lokalizacji: " + error.message),
                    { enableHighAccuracy: true }
                );
                btn.innerText = "Zatrzymaj udostępnianie";
                btn.classList.replace('bg-[#0078d4]', 'bg-[#d13438]');
            } else { alert("Twoja przeglądarka nie wspiera lokalizacji."); }
        }
    });


    // DOŁĄCZ / UTWÓRZ
    document.getElementById('createFamilyBtn')?.addEventListener('click', async () => {
        const userName = document.getElementById('userNameInput').value.trim();
        const familyName = document.getElementById('familyNameInput').value.trim();
        if (!userName || !familyName) return;
        const userId = getUserId();
        
        const docRef = await addDoc(collection(db, "families"), { name: familyName });
        await setDoc(doc(db, "families", docRef.id, "members", userId), { name: userName, role: 'admin', status: 'Dostępny' });

        localStorage.setItem('familyId', docRef.id); localStorage.setItem('userName', userName);
        checkLoginStatus();
    });

    document.getElementById('joinFamilyBtn')?.addEventListener('click', async () => {
        const userName = document.getElementById('userNameInput').value.trim();
        const familyId = document.getElementById('joinFamilyInput').value.trim();
        if (!userName || !familyId) return;
        const userId = getUserId();
        
        const familySnap = await getDoc(doc(db, "families", familyId));
        if (familySnap.exists()) {
            await setDoc(doc(db, "families", familyId, "members", userId), { name: userName, role: 'child', status: 'Dołączył/a' });
            localStorage.setItem('familyId', familyId); localStorage.setItem('userName', userName);
            checkLoginStatus();
        }
    });

    function logout() {
        if(locationWatchId) navigator.geolocation.clearWatch(locationWatchId);
        liveListeners.forEach(unsub => unsub());
        localStorage.removeItem('familyId'); localStorage.removeItem('userName');
        window.location.reload();
    }
    document.getElementById('logoutBtn')?.addEventListener('click', logout);


    // ==========================================
    // LOGIKA RÓL I NASŁUCHIWANIE BAZY
    // ==========================================
    function startRealtimeListeners(familyId, currentUserId) {
        
        // 1. CZŁONKOWIE, LOKALIZACJA, ROLE
        const qMembers = collection(db, "families", familyId, "members");
        liveListeners.push(onSnapshot(qMembers, (snapshot) => {
            const homeList = document.getElementById('homeMembersList');
            const adminList = document.getElementById('adminMembersList');
            const choreSelect = document.getElementById('choreAssignee');
            
            homeList.innerHTML = ''; adminList.innerHTML = '';
            choreSelect.innerHTML = '<option value="">Przypisz: Wszyscy</option>';

            let imInGroup = false;

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                
                // Aktualizacja ról bieżącego usera
                if (docSnap.id === currentUserId) {
                    imInGroup = true;
                    currentUserRole = data.role || 'child';
                    const badge = document.getElementById('roleBadge');
                    badge.innerText = currentUserRole === 'admin' ? 'ADMIN' : (currentUserRole === 'parent' ? 'RODZIC' : 'DZIECKO');
                    badge.classList.remove('hidden');
                    
                    // Admin/Rodzic widzi panel
                    if (currentUserRole === 'admin' || currentUserRole === 'parent') {
                        document.getElementById('adminPanel').classList.remove('hidden');
                    } else {
                        document.getElementById('adminPanel').classList.add('hidden');
                    }
                }

                // Render Startu (Pingowanie)
                const roleColors = { admin: 'bg-[#d13438]', parent: 'bg-[#0078d4]', child: 'bg-[#107c10]' };
                const rolePl = { admin: 'Admin', parent: 'Rodzic', child: 'Dziecko' };
                
                homeList.innerHTML += `
                    <div class="flex items-center justify-between bg-[#f3f2f1] px-4 py-3 rounded-sm border border-[#edebe9]">
                        <div class="flex items-center gap-3">
                            <div class="w-3 h-3 rounded-full ${roleColors[data.role]}"></div>
                            <div>
                                <p class="font-semibold text-[#323130]">${data.name} <span class="text-xs text-[#605e5c] font-normal">(${rolePl[data.role]})</span></p>
                                <p class="text-xs text-[#605e5c] italic">${data.status || 'Brak statusu'}</p>
                            </div>
                        </div>
                        ${docSnap.id !== currentUserId ? `<button onclick="window.pingUser('${docSnap.id}')" class="text-xs bg-white border border-[#0078d4] text-[#0078d4] font-semibold px-3 py-1 rounded-sm hover:bg-[#0078d4] hover:text-white transition-colors">👉 Zaczep</button>` : ''}
                    </div>`;

                choreSelect.innerHTML += `<option value="${data.name}">${data.name}</option>`;

                // Mapa Leaflet
                if (data.lat && data.lng && leafletMap) {
                    if (mapMarkers[docSnap.id]) {
                        mapMarkers[docSnap.id].setLatLng([data.lat, data.lng]);
                        mapMarkers[docSnap.id].bindPopup(`<b>${data.name}</b><br/>Aktualizacja: ${data.locTime}`);
                    } else {
                        mapMarkers[docSnap.id] = L.marker([data.lat, data.lng]).addTo(leafletMap)
                            .bindPopup(`<b>${data.name}</b><br/>Aktualizacja: ${data.locTime}`);
                    }
                } else if (!data.lat && mapMarkers[docSnap.id]) {
                    leafletMap.removeLayer(mapMarkers[docSnap.id]);
                    delete mapMarkers[docSnap.id];
                }

                // Panel Zarządzania
                if (currentUserRole === 'admin' || currentUserRole === 'parent') {
                    const disabledForParent = (currentUserRole === 'parent' && data.role === 'admin') ? 'disabled' : '';
                    adminList.innerHTML += `
                        <li class="flex justify-between items-center p-3 bg-white">
                            <span class="font-medium">${data.name} <span class="text-xs text-[#605e5c]">(${rolePl[data.role]})</span></span>
                            <div class="flex gap-2">
                                ${currentUserRole === 'admin' ? `
                                <select onchange="window.changeRole('${docSnap.id}', this.value)" class="text-xs border rounded-sm p-1">
                                    <option value="child" ${data.role === 'child'?'selected':''}>Dziecko</option>
                                    <option value="parent" ${data.role === 'parent'?'selected':''}>Rodzic</option>
                                    <option value="admin" ${data.role === 'admin'?'selected':''}>Admin</option>
                                </select>` : ''}
                                ${docSnap.id !== currentUserId && !disabledForParent ? `<button onclick="window.kickMember('${docSnap.id}')" class="text-[#d13438] hover:bg-[#fde7e9] px-2 py-1 rounded-sm text-xs">Usuń z grupy</button>` : ''}
                            </div>
                        </li>`;
                }
            });
            if(!imInGroup) logout();
        }));

        // 2. PINGI (Nasłuch na zaczepki kierowane do mnie)
        const qPings = query(collection(db, "families", familyId, "pings"), where("to", "==", currentUserId));
        liveListeners.push(onSnapshot(qPings, (snapshot) => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    showToast(`🔔 ${data.from} Cię zaczepia!`, true);
                    // Od razu usuwamy ping z bazy, by nie wyświetlał się ponownie
                    deleteDoc(change.doc.ref).catch(()=>{});
                }
            });
        }));

        // ZAKUPY I OBOWIĄZKI (Zabezpieczone wizualnie)
        const canDelete = () => currentUserRole === 'admin' || currentUserRole === 'parent';

        liveListeners.push(onSnapshot(query(collection(db, "families", familyId, "shopping"), orderBy("createdAt", "desc")), (snapshot) => {
            const list = document.getElementById('shoppingList'); list.innerHTML = '';
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                list.innerHTML += `
                    <div class="flex items-center justify-between p-3 border-b border-[#edebe9] ${data.completed ? 'bg-[#faf9f8]' : 'bg-white'}">
                        <div class="flex items-center gap-3">
                            <input type="checkbox" ${data.completed ? 'checked' : ''} onclick="window.toggleDoc('shopping', '${docSnap.id}', ${data.completed})" class="w-5 h-5 accent-[#0078d4]">
                            <span class="${data.completed ? 'line-through text-[#a19f9d]' : 'text-[#323130]'}">${data.title}</span>
                        </div>
                        ${canDelete() ? `<button onclick="window.deleteDocItem('shopping', '${docSnap.id}')" class="text-[#a19f9d] hover:text-[#d13438]">✕</button>` : ''}
                    </div>`;
            });
        }));

        liveListeners.push(onSnapshot(query(collection(db, "families", familyId, "chores"), orderBy("createdAt", "desc")), (snapshot) => {
            const list = document.getElementById('choresList'); list.innerHTML = '';
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                list.innerHTML += `
                    <div class="flex items-center justify-between p-3 border-b border-[#edebe9] ${data.completed ? 'bg-[#faf9f8]' : 'bg-white'}">
                        <div class="flex items-center gap-3">
                            <input type="checkbox" ${data.completed ? 'checked' : ''} onclick="window.toggleDoc('chores', '${docSnap.id}', ${data.completed})" class="w-5 h-5 accent-[#0078d4]">
                            <span class="${data.completed ? 'line-through text-[#a19f9d]' : 'text-[#323130]'}">${data.title} <span class="text-xs text-[#0078d4] ml-2">${data.assignee||''}</span></span>
                        </div>
                        ${canDelete() ? `<button onclick="window.deleteDocItem('chores', '${docSnap.id}')" class="text-[#a19f9d] hover:text-[#d13438]">✕</button>` : ''}
                    </div>`;
            });
        }));

        // PRZYPOMNIENIA Z GODZINĄ
        liveListeners.push(onSnapshot(query(collection(db, "families", familyId, "reminders"), orderBy("date", "asc")), (snapshot) => {
            const list = document.getElementById('remindersList'); const badge = document.getElementById('reminderBadge');
            list.innerHTML = ''; let activeCount = 0;
            
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                // data.date to teraz format "YYYY-MM-DDTHH:MM" (z datetime-local)
                const isPast = new Date(data.date) < new Date();
                const displayDate = new Date(data.date).toLocaleString('pl-PL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
                
                if(!data.completed) activeCount++;
                list.innerHTML += `
                    <div class="flex items-center justify-between p-3 border-l-4 ${data.completed ? 'border-[#a19f9d] bg-[#faf9f8]' : (isPast ? 'border-[#d13438]' : 'border-[#0078d4]')} shadow-sm mb-2 bg-white rounded-r-sm">
                        <div>
                            <span class="font-semibold ${data.completed ? 'line-through text-[#a19f9d]' : ''}">${data.title}</span>
                            <span class="text-xs ml-3 ${isPast && !data.completed ? 'text-[#d13438] font-bold' : 'text-[#605e5c]'}">${displayDate}</span>
                        </div>
                        <div class="flex gap-2">
                            <input type="checkbox" ${data.completed ? 'checked' : ''} onclick="window.toggleDoc('reminders', '${docSnap.id}', ${data.completed})" class="w-5 h-5 accent-[#0078d4]">
                            ${canDelete() ? `<button onclick="window.deleteDocItem('reminders', '${docSnap.id}')" class="text-[#d13438] text-xs">Usuń</button>` : ''}
                        </div>
                    </div>`;
            });
            activeCount > 0 ? (badge.classList.remove('hidden'), badge.innerText = activeCount) : badge.classList.add('hidden');
        }));

        // CZAT
        liveListeners.push(onSnapshot(query(collection(db, "families", familyId, "messages"), orderBy("createdAt", "asc")), (snapshot) => {
            const chatBox = document.getElementById('chatMessages');
            const currentUser = localStorage.getItem('userName');
            const isScrolled = chatBox.scrollHeight - chatBox.clientHeight <= chatBox.scrollTop + 50;
            
            chatBox.innerHTML = '';
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const isMe = data.author === currentUser;
                chatBox.innerHTML += `
                    <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
                        <span class="text-[11px] text-[#605e5c] mb-1">${data.author}</span>
                        <div class="max-w-[85%] px-4 py-2 text-sm rounded-sm ${isMe ? 'bg-[#0078d4] text-white' : 'bg-[#f3f2f1]'}">${data.text}</div>
                    </div>`;
            });
            if (isScrolled) chatBox.scrollTop = chatBox.scrollHeight;
        }));
    }

    // ==========================================
    // FUNKCJE AKCJI GLOBALNYCH
    // ==========================================
    
    // Status
    document.getElementById('saveStatusBtn')?.addEventListener('click', async () => {
        const status = document.getElementById('userStatusInput').value;
        await updateDoc(doc(db, "families", localStorage.getItem('familyId'), "members", getUserId()), { status });
        showToast("Zaktualizowano status.");
    });

    // Zaczepki (Ping)
    window.pingUser = async (targetUserId) => {
        await addDoc(collection(db, "families", localStorage.getItem('familyId'), "pings"), {
            to: targetUserId, from: localStorage.getItem('userName'), timestamp: Date.now()
        });
        showToast("Wysłano zaczepkę!");
    };

    // Role (Tylko Admin)
    window.changeRole = async (targetUserId, newRole) => {
        await updateDoc(doc(db, "families", localStorage.getItem('familyId'), "members", targetUserId), { role: newRole });
        showToast("Zmieniono uprawnienia.");
    };

    window.kickMember = async (targetUserId) => {
        if(confirm("Usunąć członka?")) await deleteDoc(doc(db, "families", localStorage.getItem('familyId'), "members", targetUserId));
    };

    // Dodawanie do baz
    const addFn = async (colName, inputId, extra = {}) => {
        const input = document.getElementById(inputId); const val = input.value.trim();
        if(!val) return;
        await addDoc(collection(db, "families", localStorage.getItem('familyId'), colName), { title: val, completed: false, createdAt: new Date().toISOString(), ...extra });
        input.value = '';
    };

    document.getElementById('addShopItemBtn')?.addEventListener('click', () => addFn('shopping', 'shopItemTitle'));
    document.getElementById('addChoreBtn')?.addEventListener('click', () => addFn('chores', 'choreTitle', { assignee: document.getElementById('choreAssignee').value }));
    
    // Przypomnienia (Z Godziną)
    document.getElementById('addReminderBtn')?.addEventListener('click', async () => {
        const title = document.getElementById('reminderTitle').value.trim();
        const date = document.getElementById('reminderDate').value; // format 2026-09-20T14:30
        if(!title || !date) return alert("Podaj treść i datę/godzinę!");
        await addDoc(collection(db, "families", localStorage.getItem('familyId'), "reminders"), { title, date, completed: false, createdAt: new Date().toISOString() });
        document.getElementById('reminderTitle').value = ''; document.getElementById('reminderDate').value = '';
    });

    // Czat
    document.getElementById('sendChatBtn')?.addEventListener('click', async () => {
        const i = document.getElementById('chatInput'); if(!i.value.trim()) return;
        await addDoc(collection(db, "families", localStorage.getItem('familyId'), "messages"), { text: i.value.trim(), author: localStorage.getItem('userName'), createdAt: new Date().toISOString() });
        i.value = '';
    });

    // Uniwersalne akcje (Usuwanie/Przełączanie)
    window.toggleDoc = async (col, id, current) => await updateDoc(doc(db, "families", localStorage.getItem('familyId'), col, id), { completed: !current });
    window.deleteDocItem = async (col, id) => {
        if (currentUserRole !== 'child') await deleteDoc(doc(db, "families", localStorage.getItem('familyId'), col, id));
        else alert("Brak uprawnień do usuwania.");
    };

    checkLoginStatus();
});
