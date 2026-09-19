import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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
    const authScreen = document.getElementById('auth-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');
    
    const userNameInput = document.getElementById('userNameInput');
    const familyNameInput = document.getElementById('familyNameInput');
    const joinFamilyInput = document.getElementById('joinFamilyInput');
    const createFamilyBtn = document.getElementById('createFamilyBtn');
    const joinFamilyBtn = document.getElementById('joinFamilyBtn');
    
    const dashboardFamilyName = document.getElementById('dashboardFamilyName');
    const dashboardUserName = document.getElementById('dashboardUserName');
    const displayFamilyCode = document.getElementById('displayFamilyCode');
    const logoutBtn = document.getElementById('logoutBtn');

    // Obsługa zakładek
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => {
                b.classList.remove('border-indigo-600', 'text-indigo-600');
                b.classList.add('text-slate-500');
            });
            btn.classList.add('border-indigo-600', 'text-indigo-600');
            btn.classList.remove('text-slate-500');

            tabContents.forEach(c => c.classList.add('hidden'));
            document.getElementById(btn.dataset.target).classList.remove('hidden');
        });
    });

    async function checkLoginStatus() {
        const savedFamilyId = localStorage.getItem('familyId');
        const savedUserName = localStorage.getItem('userName');

        if (savedFamilyId && savedUserName) {
            authScreen.classList.add('hidden');
            dashboardScreen.classList.remove('hidden');
            dashboardUserName.innerText = `Witaj, ${savedUserName}!`;
            displayFamilyCode.innerText = savedFamilyId;

            try {
                const docSnap = await getDoc(doc(db, "families", savedFamilyId));
                if (docSnap.exists()) {
                    dashboardFamilyName.innerText = `Rodzina: ${docSnap.data().name}`;
                }
            } catch(e) { console.error(e); }

            loadChores(savedFamilyId);
            loadEvents(savedFamilyId);
            loadAnnouncements(savedFamilyId);
        } else {
            authScreen.classList.remove('hidden');
            dashboardScreen.classList.add('hidden');
        }
    }

    // Tworzenie / Dołączanie
    if (createFamilyBtn) {
        createFamilyBtn.addEventListener('click', async () => {
            const userName = userNameInput.value.trim();
            const familyName = familyNameInput.value.trim();
            if (!userName || !familyName) return alert("Podaj imię i nazwę rodziny!");

            const docRef = await addDoc(collection(db, "families"), { name: familyName, createdAt: new Date().toISOString() });
            localStorage.setItem('familyId', docRef.id);
            localStorage.setItem('userName', userName);
            checkLoginStatus();
        });
    }

    if (joinFamilyBtn) {
        joinFamilyBtn.addEventListener('click', async () => {
            const userName = userNameInput.value.trim();
            const familyId = joinFamilyInput.value.trim();
            if (!userName || !familyId) return alert("Podaj imię i kod!");

            const familySnap = await getDoc(doc(db, "families", familyId));
            if (familySnap.exists()) {
                localStorage.setItem('familyId', familyId);
                localStorage.setItem('userName', userName);
                checkLoginStatus();
            } else {
                alert("Nie znaleziono rodziny o takim kodzie.");
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('familyId');
            localStorage.removeItem('userName');
            checkLoginStatus();
        });
    }

    // --- MODUŁ 1: OBOWIĄZKI ---
    const addChoreBtn = document.getElementById('addChoreBtn');
    if (addChoreBtn) {
        addChoreBtn.addEventListener('click', async () => {
            const title = document.getElementById('choreTitle').value.trim();
            const assignee = document.getElementById('choreAssignee').value.trim();
            const familyId = localStorage.getItem('familyId');
            if (!title) return;

            await addDoc(collection(db, "families", familyId, "chores"), {
                title, assignee: assignee || 'Wszyscy', completed: false, createdAt: new Date().toISOString()
            });
            document.getElementById('choreTitle').value = '';
            document.getElementById('choreAssignee').value = '';
            loadChores(familyId);
        });
    }

    async function loadChores(familyId) {
        const list = document.getElementById('choresList');
        if (!list) return;
        list.innerHTML = 'Ładowanie...';
        const snapshot = await getDocs(collection(db, "families", familyId, "chores"));
        list.innerHTML = '';
        snapshot.forEach(itemDoc => {
            const data = itemDoc.data();
            list.innerHTML += `
                <div class="flex items-center justify-between p-3 bg-slate-50 border rounded">
                    <div>
                        <span class="font-bold ${data.completed ? 'line-through text-slate-400' : ''}">${data.title}</span>
                        <span class="text-xs bg-indigo-100 text-indigo-700 ml-2 px-2 py-0.5 rounded">${data.assignee}</span>
                    </div>
                    <button onclick="window.toggleChore('${itemDoc.id}', ${data.completed})" class="text-xs bg-slate-200 px-3 py-1 rounded hover:bg-slate-300">
                        ${data.completed ? 'Cofnij' : 'Zrobione'}
                    </button>
                </div>`;
        });
    }

    window.toggleChore = async (choreId, currentStatus) => {
        const familyId = localStorage.getItem('familyId');
        await updateDoc(doc(db, "families", familyId, "chores", choreId), { completed: !currentStatus });
        loadChores(familyId);
    };

    // --- MODUŁ 2: KALENDARZ / REZERWACJE ---
    const addEventBtn = document.getElementById('addEventBtn');
    if (addEventBtn) {
        addEventBtn.addEventListener('click', async () => {
            const title = document.getElementById('eventTitle').value.trim();
            const date = document.getElementById('eventDate').value;
            const familyId = localStorage.getItem('familyId');
            if (!title || !date) return alert("Uzupełnij tytuł i datę!");

            await addDoc(collection(db, "families", familyId, "events"), {
                title, date, createdBy: localStorage.getItem('userName'), createdAt: new Date().toISOString()
            });
            document.getElementById('eventTitle').value = '';
            document.getElementById('eventDate').value = '';
            loadEvents(familyId);
        });
    }

    async function loadEvents(familyId) {
        const list = document.getElementById('eventsList');
        if (!list) return;
        const snapshot = await getDocs(collection(db, "families", familyId, "events"));
        list.innerHTML = '';
        snapshot.forEach(itemDoc => {
            const data = itemDoc.data();
            list.innerHTML += `
                <div class="flex items-center justify-between p-3 bg-slate-50 border rounded">
                    <div>
                        <span class="font-bold">${data.title}</span>
                        <span class="text-xs text-slate-500 ml-2">📅 ${data.date.replace('T', ' ')}</span>
                    </div>
                    <span class="text-xs text-slate-400">Przez: ${data.createdBy}</span>
                </div>`;
        });
    }

    // --- MODUŁ 3: OGŁOSZENIA ---
    const addAnnouncementBtn = document.getElementById('addAnnouncementBtn');
    if (addAnnouncementBtn) {
        addAnnouncementBtn.addEventListener('click', async () => {
            const text = document.getElementById('announcementText').value.trim();
            const familyId = localStorage.getItem('familyId');
            if (!text) return;

            await addDoc(collection(db, "families", familyId, "announcements"), {
                text, author: localStorage.getItem('userName'), createdAt: new Date().toISOString()
            });
            document.getElementById('announcementText').value = '';
            loadAnnouncements(familyId);
        });
    }

    async function loadAnnouncements(familyId) {
        const list = document.getElementById('announcementsList');
        if (!list) return;
        const snapshot = await getDocs(collection(db, "families", familyId, "announcements"));
        list.innerHTML = '';
        snapshot.forEach(itemDoc => {
            const data = itemDoc.data();
            list.innerHTML += `
                <div class="p-4 bg-amber-50 border border-amber-200 rounded">
                    <p class="text-slate-800">${data.text}</p>
                    <span class="text-xs text-amber-700 mt-2 block font-bold">Autor: ${data.author}</span>
                </div>`;
        });
    }

    checkLoginStatus();
});
