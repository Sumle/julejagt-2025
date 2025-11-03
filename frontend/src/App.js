import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getDatabase, ref, set, get, push, onValue, query, orderByChild, equalTo } from 'firebase/database';

// 🔥 FIREBASE CONFIGURATION
// Replace with your Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyC-zAgKY_PZ-5F3Osjhg_Gf-K53Nhxop2Y",
    authDomain: "christmas-qr-hunt.firebaseapp.com",
    databaseURL: "https://christmas-qr-hunt-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "christmas-qr-hunt",
    storageBucket: "christmas-qr-hunt.firebasestorage.app",
    messagingSenderId: "238790514747",
    appId: "1:238790514747:web:544b9afd56b47cb24a641e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

const VALID_QR_CODES = [
    'XMAS2024-01', 'XMAS2024-02', 'XMAS2024-03', 'XMAS2024-04',
    'XMAS2024-05', 'XMAS2024-06', 'XMAS2024-07', 'XMAS2024-08',
    'XMAS2024-09', 'XMAS2024-10', 'XMAS2024-11', 'XMAS2024-12',
    'XMAS2024-13', 'XMAS2024-14', 'XMAS2024-15', 'XMAS2024-16',
    'XMAS2024-17', 'XMAS2024-18', 'XMAS2024-19', 'XMAS2024-20',
    'XMAS2024-21', 'XMAS2024-22', 'XMAS2024-23', 'XMAS2024-24'
];

// Danish rhymes for each QR code
const RHYMES = {
    1: "Stilhed i boksen hvor samtaler bo, bagerst på 2. etage skal næste ro.",
    2: "Grønne blade står og gror – på 2. etage skjules næste spor.",
    3: "Der hvor maven får sin lykke – på 2. etage findes spor i køkken.",
    4: "Følg rør der løber par om par – på 6. etage finder du næste svar.",
    5: "Der hvor bunker bliver til bund – ved papirets plads er næste fund (6. etage).",
    6: "Læn dig blødt og kig en smule – bag sofaens ryg gemmer næste jule (6. etage).",
    7: "Maskinen suser: print på print—i 7. etages printerrum står næste hint.",
    8: "Skuffer gemmer ting i ro – bagerste kommode i 7. (SUF) skjuler go'.",
    9: "Grønt ved gryder, tæt ved mad—ved planten ved køkkenet i 7. etage.",
    10: "Udsigt, lys og stille charme—kig i hjørnet under vindueskarmen (kantine, 7.).",
    11: "Fodspor, stole, snak i kor—kig diskret under bagerste bord (kantine, 7.).",
    12: "Ping og pong – find næste ved bordtennisbordet (kantine, 7.).",
    13: "Sortér med stil ved affald—ved stolpens hjørne står næste kald (7.).",
    14: "Blødt og lyst i 8B—under vindueskarmen kan du se (sofa).",
    15: "Inde i boksen er der fred—måske ovenpå gemmer det (8B).",
    16: "Duften lokker – tjek i skålen eller under bordet i køkkenet (8B).",
    17: "Hvor sider vendes, viden glad—i køkkenhjørnet ved bladene (8C).",
    18: "Bag en dør hvor lager bor—i depotrummet (8C).",
    19: "Sidst i rækken, stille sal—i bagerste mødelokale (8C).",
    20: "Op i ni'eren hvor ekko gør—ved forum-røret (9.).",
    21: "Se hvad skærmen si'r—på køkken-TV'et (6. hos jer).",
    22: "Planer ruller fri—ved Mobility-tavlen (6. hos jer).",
    23: "Glimt og glimmer, lys og sjov—ved diskokuglen (6. hos jer).",
    24: "Tillykke! Du har fundet alle 24 koder! 🎄🎅"
};

const ADMIN_EMAIL = 'admin@christmas.com';
const ADMIN_PASSWORD = 'ChristmasParty2024';

export default function ChristmasQRHunt() {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [view, setView] = useState('login');
    const [scanning, setScanning] = useState(false);
    const [allUsers, setAllUsers] = useState([]);
    const [myScans, setMyScans] = useState([]);
    const [loading, setLoading] = useState(true);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const scanIntervalRef = useRef(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);

                if (currentUser.email === ADMIN_EMAIL) {
                    setIsAdmin(true);
                    setView('admin');
                    loadAllUsers();
                } else {
                    const userRef = ref(database, `users/${currentUser.uid}`);
                    const snapshot = await get(userRef);
                    if (snapshot.exists()) {
                        setUserData(snapshot.val());
                        setView('hunt');
                        loadMyScans(currentUser.uid);
                    }
                }
            } else {
                setUser(null);
                setUserData(null);
                setIsAdmin(false);
                setView('login');
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const loadMyScans = (uid) => {
        const scansRef = ref(database, `scans/${uid}`);
        onValue(scansRef, (snapshot) => {
            const scansData = snapshot.val();
            if (scansData) {
                setMyScans(Object.values(scansData));
            } else {
                setMyScans([]);
            }
        });
    };

    const loadAllUsers = () => {
        const usersRef = ref(database, 'users');
        const scansRef = ref(database, 'scans');

        onValue(usersRef, (usersSnapshot) => {
            onValue(scansRef, (scansSnapshot) => {
                const usersData = usersSnapshot.val() || {};
                const scansData = scansSnapshot.val() || {};

                const usersList = Object.entries(usersData).map(([uid, userData]) => {
                    const userScans = scansData[uid] ? Object.values(scansData[uid]) : [];
                    return {
                        userId: userData.userId,
                        name: userData.name,
                        scannedCodes: userScans
                    };
                });

                setAllUsers(usersList);
            });
        });
    };

    const handleRegister = async (name, userid, password) => {
        if (!name || !userid || !password) {
            alert('Udfyld venligst alle felter');
            return;
        }

        if (password.length < 6) {
            alert('Adgangskode skal være mindst 6 tegn');
            return;
        }

        try {
            // Check if userId already exists
            const usersRef = ref(database, 'users');
            const snapshot = await get(usersRef);
            const existingUsers = snapshot.val() || {};

            const userExists = Object.values(existingUsers).some(u => u.userId === userid);
            if (userExists) {
                alert('Dette Bruger ID er allerede i brug!');
                return;
            }

            const email = `${userid.toLowerCase().replace(/[^a-z0-9]/g, '')}@jule-qr-hunt.dk`;

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;

            await set(ref(database, `users/${uid}`), {
                userId: userid,
                name: name,
                email: email,
                createdAt: new Date().toISOString()
            });

            alert('Registrering vellykket! Log venligst ind.');
            setView('login');
        } catch (error) {
            console.error('Registreringsfejl:', error);
            if (error.code === 'auth/email-already-in-use') {
                alert('Dette Bruger ID er allerede i brug!');
            } else if (error.code === 'auth/weak-password') {
                alert('Adgangskode skal være mindst 6 tegn');
            } else {
                alert('Registrering mislykkedes: ' + error.message);
            }
        }
    };

    const handleLogin = async (userid, password) => {
        try {
            if (userid === 'admin' && password === ADMIN_PASSWORD) {
                await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
                return;
            }

            // Find user by userId
            const usersRef = ref(database, 'users');
            const snapshot = await get(usersRef);
            const usersData = snapshot.val() || {};

            let foundEmail = null;
            for (const [uid, data] of Object.entries(usersData)) {
                if (data.userId === userid) {
                    foundEmail = data.email;
                    break;
                }
            }

            if (!foundEmail) {
                alert('Ugyldigt Bruger ID eller adgangskode');
                return;
            }

            await signInWithEmailAndPassword(auth, foundEmail, password);
        } catch (error) {
            console.error('Login fejl:', error);
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                alert('Ugyldigt Bruger ID eller adgangskode');
            } else {
                alert('Login mislykkedes: ' + error.message);
            }
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        stopScanning();
    };

    const startScanning = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                setScanning(true);
                scanIntervalRef.current = setInterval(scanQRCode, 500);
            }
        } catch (error) {
            alert('Kamera adgang nægtet. Tillad venligst kamera adgang for at scanne QR-koder.');
        }
    };

    const stopScanning = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        }
        if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
        }
        setScanning(false);
    };

    const scanQRCode = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

            if (typeof window.jsQR !== 'undefined') {
                const code = window.jsQR(imageData.data, imageData.width, imageData.height);
                if (code && VALID_QR_CODES.includes(code.data)) {
                    handleQRCodeScanned(code.data);
                } else if (code && !VALID_QR_CODES.includes(code.data)) {
                    stopScanning();
                    alert('❌ Denne QR-kode er ikke en del af julejagtskoden!');
                }
            }
        }
    };

    const handleQRCodeScanned = async (qrCode) => {
        if (myScans.includes(qrCode)) {
            stopScanning();
            alert('⚠️ Du har allerede scannet denne QR-kode!');
            return;
        }

        try {
            const scansRef = ref(database, `scans/${user.uid}`);
            await push(scansRef, qrCode);

            stopScanning();

            const codeNumber = parseInt(qrCode.split('-')[1]);
            const nextRhyme = RHYMES[codeNumber];

            let message = `🎄 Perfekt! Du fandt kode #${codeNumber}! 🎄\n\n`;

            if (codeNumber === 24) {
                message += `🎅 ${nextRhyme}`;
            } else {
                message += `🔍 Næste hint:\n"${nextRhyme}"`;
            }

            alert(message);
        } catch (error) {
            console.error('Fejl ved lagring af scanning:', error);
            alert('Kunne ikke gemme scanning. Prøv venligst igen.');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-600 via-green-700 to-red-800 flex items-center justify-center">
                <div className="text-white text-2xl">Indlæser... 🎄</div>
            </div>
        );
    }

    if (view === 'admin') {
        return <AdminView users={allUsers} handleLogout={handleLogout} />;
    }

    if (view === 'login' || view === 'register') {
        return <LoginRegisterView view={view} setView={setView} handleRegister={handleRegister} handleLogin={handleLogin} />;
    }

    const progress = myScans.length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-600 via-green-700 to-red-800 p-4">
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                    <div className="bg-gradient-to-r from-red-600 to-green-600 p-6 text-white">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-bold">Velkommen, {userData?.name}!</h1>
                                <p className="text-red-100">Julefrokost QR Jagt 2024</p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg transition font-medium"
                            >
                                Log ud
                            </button>
                        </div>
                        <div className="bg-white bg-opacity-20 rounded-lg p-4 mt-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-medium">Fremskridt</span>
                                <span className="text-2xl font-bold">{progress}/24</span>
                            </div>
                            <div className="w-full bg-white bg-opacity-30 rounded-full h-3">
                                <div
                                    className="bg-white h-3 rounded-full transition-all duration-500"
                                    style={{ width: `${(progress / 24) * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                            <h3 className="font-bold text-blue-900 mb-2">🎅 Sådan spiller du:</h3>
                            <ul className="text-sm text-blue-800 space-y-1">
                                <li>• Find alle 24 QR-koder gemt rundt omkring til julefrokosten</li>
                                <li>• Klik på "Scan QR-kode" for at åbne dit kamera</li>
                                <li>• Peg dit kamera mod hver QR-kode for at scanne den</li>
                                <li>• Følg rækkefølgen af hints for at finde næste kode</li>
                                <li>• Den første til at finde alle 24 koder vinder en præmie! 🎁</li>
                            </ul>
                            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                                <p className="font-bold text-green-900 mb-1">🔍 Dit første hint:</p>
                                <p className="text-sm text-green-800 italic">"Nede i bunden, oppe i hjørnet, sidder en rød kasse"</p>
                            </div>
                        </div>

                        {!scanning ? (
                            <button
                                onClick={startScanning}
                                className="w-full bg-gradient-to-r from-red-600 to-green-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 hover:shadow-lg transition mb-6"
                            >
                                📷 Scan QR-kode
                            </button>
                        ) : (
                            <div className="mb-6">
                                <div className="relative bg-black rounded-xl overflow-hidden">
                                    <video ref={videoRef} className="w-full" playsInline />
                                    <canvas ref={canvasRef} className="hidden" />
                                </div>
                                <button
                                    onClick={() => { stopScanning(); }}
                                    className="w-full bg-gray-800 text-white py-3 rounded-lg font-medium mt-2 hover:bg-gray-900 transition"
                                >
                                    Luk kamera
                                </button>
                            </div>
                        )}

                        <div className="bg-gray-50 rounded-xl p-4">
                            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                🎁 Dine scannede koder
                            </h3>
                            <div className="grid grid-cols-6 gap-2">
                                {Array.from({ length: 24 }, (_, i) => {
                                    const codeNum = String(i + 1).padStart(2, '0');
                                    const code = `XMAS2024-${codeNum}`;
                                    const found = myScans.includes(code);
                                    return (
                                        <div
                                            key={i}
                                            className={`aspect-square rounded-lg flex items-center justify-center font-bold transition ${found
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-gray-200 text-gray-400'
                                                }`}
                                        >
                                            {found ? '✓' : (i + 1)}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function LoginRegisterView({ view, setView, handleRegister, handleLogin }) {
    const [formData, setFormData] = useState({ name: '', userid: '', password: '' });

    const onSubmit = (e) => {
        e.preventDefault();
        if (view === 'register') {
            handleRegister(formData.name, formData.userid, formData.password);
        } else {
            handleLogin(formData.userid, formData.password);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-600 via-green-700 to-red-800 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="text-6xl mb-4">🎁</div>
                    <h1 className="text-3xl font-bold text-gray-800">Julefrokost QR Jagt</h1>
                    <p className="text-gray-600 mt-2">Find alle 24 koder!</p>
                </div>

                <div className="space-y-4">
                    {view === 'register' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Dit navn</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                placeholder="Jens Jensen"
                            />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bruger ID</label>
                        <input
                            type="text"
                            value={formData.userid}
                            onChange={(e) => setFormData({ ...formData, userid: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            placeholder="Dit arbejds-bruger ID"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Adgangskode</label>
                        <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            placeholder={view === 'register' ? 'Opret adgangskode (min. 6 tegn)' : 'Din adgangskode'}
                        />
                    </div>
                    <button
                        onClick={onSubmit}
                        className={`w-full py-3 rounded-lg font-medium text-white transition ${view === 'login' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                            }`}
                    >
                        {view === 'login' ? 'Log ind' : 'Registrer'}
                    </button>

                    <div className="text-center mt-4">
                        <button
                            onClick={() => setView(view === 'login' ? 'register' : 'login')}
                            className="text-sm text-gray-600 hover:text-gray-800"
                        >
                            {view === 'login' ? "Har du ikke en konto? Registrer" : 'Har du allerede en konto? Log ind'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AdminView({ users, handleLogout }) {
    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="max-w-6xl mx-auto">
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <span className="text-4xl">👥</span>
                            <h1 className="text-2xl font-bold text-gray-800">Administrator Dashboard</h1>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
                        >
                            Log ud
                        </button>
                    </div>
                </div>

                <div className="grid gap-6">
                    {users.map((user) => (
                        <div key={user.userId} className="bg-white rounded-lg shadow p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">{user.name}</h2>
                                    <p className="text-gray-600">Bruger ID: {user.userId}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-3xl font-bold text-green-600">
                                        {user.scannedCodes.length}/24
                                    </div>
                                    <div className="text-sm text-gray-600">koder fundet</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-6 gap-2">
                                {Array.from({ length: 24 }, (_, i) => {
                                    const codeNum = String(i + 1).padStart(2, '0');
                                    const code = `XMAS2024-${codeNum}`;
                                    const found = user.scannedCodes.includes(code);
                                    return (
                                        <div
                                            key={i}
                                            className={`p-2 rounded text-center font-medium ${found
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-gray-100 text-gray-400'
                                                }`}
                                        >
                                            {i + 1}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    {users.length === 0 && (
                        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
                            Ingen brugere registreret endnu
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}