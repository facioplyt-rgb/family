
// 1. Importowanie Firebase z linków URL (nie z paczek npm, aby działało bez serwera lokalnego!)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// 2. Twoja konfiguracja Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBPU79D1OQtirYkfavhIOYS8zzttxbyrG4",
    authDomain: "family-44583.firebaseapp.com",
    databaseURL: "https://family-44583-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "family-44583",
    storageBucket: "family-44583.firebasestorage.app",
    messagingSenderId: "273043875220",
    appId: "1:273043875220:web:6051fe0ef307ee1c891b81",
    measurementId: "G-B183L9BB48"
};

// 3. Uruchomienie aplikacji, bazy danych i analityki
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// 4. Uruchomienie kodu po pełnym załadowaniu HTML
document.addEventListener('DOMContentLoaded', () => {
    
    // Pobranie elementów z HTML
    const createBtn = document.getElementById('createFamilyBtn');
    const userNameInput = document.getElementById('userNameInput');
    const familyNameInput = document.getElementById('familyNameInput');

    // Obsługa kliknięcia "Stwórz Rodzinę"
    if (createBtn) {
        createBtn.addEventListener('click', async () => {
            const userName = userNameInput ? userNameInput.value.trim() : '';
            const familyName = familyNameInput ? familyNameInput.value.trim() : '';

            if (!userName || !familyName) {
                alert("Proszę wpisać swoje imię i nazwę rodziny!");
                return;
            }

            // Zmiana tekstu na przycisku na czas ładowania
            createBtn.innerText = "Tworzenie...";
            createBtn.disabled = true;

            try {
                // Zapisanie nowej rodziny w Firebase Firestore
                const docRef = await addDoc(collection(db, "families"), {
                    name: familyName,
                    createdBy: userName,
                    createdAt: new Date().toISOString()
                });

                alert(`Sukces! Stworzono rodzinę. Kod dołączenia: ${docRef.id}`);
                
                // Zapisanie danych w przeglądarce, żeby system pamiętał, kim jesteś
                localStorage.setItem('familyId', docRef.id);
                localStorage.setItem('userName', userName);
                localStorage.setItem('role', 'admin');

                // Przywrócenie przycisku
                createBtn.innerText = "Stwórz Rodzinę";
                createBtn.disabled = false;

                console.log("Zalogowano pomyślnie. Kod rodziny:", docRef.id);

            } catch (error) {
                console.error("Błąd podczas tworzenia:", error);
                alert("Wystąpił błąd: " + error.message);
                createBtn.innerText = "Stwórz Rodzinę";
                createBtn.disabled = false;
            }
        });
    }
});
