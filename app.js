// 1. Bezpośrednie importy z serwerów Google (naprawia błąd "Failed to resolve module specifier")
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, addDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// 2. Twoja dokładna konfiguracja bazy danych Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBPU79D1OQtirYkfavhIOYS8zzttxbyrG4",
    authDomain: "family-44583.firebaseapp.com",
    projectId: "family-44583",
    storageBucket: "family-44583.firebasestorage.app",
    messagingSenderId: "273043875220",
    appId: "1:273043875220:web:6051fe0ef307ee1c891b81"
};

// 3. Inicjalizacja Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Pobranie elementów HTML (Ekrany) ---
    const authScreen = document.getElementById('auth-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');
    
    // --- Pobranie elementów HTML (Logowanie/Rejestracja) ---
    const userNameInput = document.getElementById('userNameInput');
    const familyNameInput = document.getElementById('familyNameInput');
    const joinFamilyInput = document.getElementById('joinFamilyInput');
    const createFamilyBtn = document.getElementById('createFamilyBtn');
    const joinFamilyBtn = document.getElementById('joinFamilyBtn');
    
    // --- Pobranie elementów HTML (Panel główny) ---
    const dashboardFamilyName = document.getElementById('dashboardFamilyName');
    const dashboardUserName = document.getElementById('dashboardUserName');
    const displayFamilyCode = document.getElementById('displayFamilyCode');
    const logoutBtn = document.getElementById('logoutBtn');

    // ==========================================
    // FUNKCJA SPRAWDZAJĄCA CZY JESTEŚMY ZALOGOWANI
    // ==========================================
    async function checkLoginStatus() {
        const savedFamilyId = localStorage.getItem('familyId');
        const savedUserName = localStorage.getItem('userName');

        if (savedFamilyId && savedUserName) {
            // Użytkownik jest zalogowany - ukryj logowanie, pokaż panel
            authScreen.classList.add('hidden');
            dashboardScreen.classList.remove('hidden');
            
            // Wypełnij dane w panelu
            dashboardUserName.innerText = `Witaj, ${savedUserName}!`;
            displayFamilyCode.innerText = savedFamilyId;

            // Pobierz nazwę rodziny z Firebase, żeby ładnie wyświetlić u góry
            try {
                const docSnap = await getDoc(doc(db, "families", savedFamilyId));
                if (docSnap.exists()) {
                    dashboardFamilyName.innerText = `Rodzina: ${docSnap.data().name}`;
                } else {
                    dashboardFamilyName.innerText = "Nieznana rodzina";
                }
            } catch(e) {
                console.error("Błąd pobierania danych rodziny:", e);
            }
        } else {
            // Użytkownik niezalogowany - pokaż ekran logowania
            authScreen.classList.remove('hidden');
            dashboardScreen.classList.add('hidden');
            dashboardScreen.classList.remove('flex'); // Zabezpieczenie stylów Tailwind
        }
    }

    // ==========================================
    // AKCJA 1: TWORZENIE NOWEJ RODZINY
    // ==========================================
    if (createFamilyBtn) {
        createFamilyBtn.addEventListener('click', async () => {
            const userName = userNameInput.value.trim();
            const familyName = familyNameInput.value.trim();

            if (!userName || !familyName) {
                return alert("Musisz podać swoje imię oraz nazwę nowej rodziny!");
            }

            createFamilyBtn.innerText = "Tworzenie...";
            createFamilyBtn.disabled = true;

            try {
                // Zapisz do bazy
                const docRef = await addDoc(collection(db, "families"), {
                    name: familyName,
                    createdBy: userName,
                    createdAt: new Date().toISOString()
                });

                // Zapisz w pamięci przeglądarki
                localStorage.setItem('familyId', docRef.id);
                localStorage.setItem('userName', userName);
                
                // Przeładuj widok na panel
                checkLoginStatus();
            } catch (error) {
                alert("Wystąpił błąd podczas tworzenia bazy: " + error.message);
            } finally {
                createFamilyBtn.innerText = "Stwórz";
                createFamilyBtn.disabled = false;
            }
        });
    }

    // ==========================================
    // AKCJA 2: DOŁĄCZANIE DO ISTNIEJĄCEJ RODZINY
    // ==========================================
    if (joinFamilyBtn) {
        joinFamilyBtn.addEventListener('click', async () => {
            const userName = userNameInput.value.trim();
            const familyId = joinFamilyInput.value.trim();

            if (!userName || !familyId) {
                return alert("Wpisz swoje imię oraz wklej kod rodziny!");
            }

            joinFamilyBtn.innerText = "Łączenie...";
            joinFamilyBtn.disabled = true;

            try {
                // Sprawdź czy rodzina o takim ID istnieje w bazie
                const familyRef = doc(db, "families", familyId);
                const familySnap = await getDoc(familyRef);

                if (familySnap.exists()) {
                    // Udało się znaleźć rodzinę, zapisz logowanie w przeglądarce
                    localStorage.setItem('familyId', familyId);
                    localStorage.setItem('userName', userName);
                    
                    // Przeładuj widok na panel
                    checkLoginStatus();
                } else {
                    alert("Nie znaleziono rodziny o podanym kodzie. Sprawdź, czy nie ma w nim spacji lub błędów.");
                }
            } catch (error) {
                alert("Wystąpił błąd: " + error.message);
            } finally {
                joinFamilyBtn.innerText = "Dołącz";
                joinFamilyBtn.disabled = false;
            }
        });
    }

    // ==========================================
    // AKCJA 3: WYLOGOWANIE
    // ==========================================
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('familyId');
            localStorage.removeItem('userName');
            userNameInput.value = '';
            familyNameInput.value = '';
            joinFamilyInput.value = '';
            checkLoginStatus(); // Wraca do ekranu logowania
        });
    }

    // Uruchom sprawdzanie na samym starcie po załadowaniu strony
    checkLoginStatus();
});
