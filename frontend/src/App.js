import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';
import {
    getDatabase,
    ref,
    set,
    get,
    push,
    onValue
} from 'firebase/database';

// 🔥 FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyC-zAgKY_PZ-5F3Osjhg_Gf-K53Nhxop2Y",
    authDomain: "christmas-qr-hunt.firebaseapp.com",
    databaseURL: "https://christmas-qr-hunt-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "christmas-qr-hunt",
    storageBucket: "christmas-qr-hunt.firebasestorage.app",
    messagingSenderId: "238790514747",
    appId: "1:238790514747:web:544b9afd56b47cb24a641e"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// whitelist – uppercased
const VALID_QR_CODES = [
    'XMAS2025-01', 'XMAS2025-02', 'XMAS2025-03', 'XMAS2025-04',
    'XMAS2025-05', 'XMAS2025-06', 'XMAS2025-07', 'XMAS2025-08',
    'XMAS2025-09', 'XMAS2025-10', 'XMAS2025-11', 'XMAS2025-12',
    'XMAS2025-13', 'XMAS2025-14', 'XMAS2025-15', 'XMAS2025-16',
    'XMAS2025-17', 'XMAS2025-18', 'XMAS2025-19', 'XMAS2025-20',
    'XMAS2025-21', 'XMAS2025-22', 'XMAS2025-23', 'XMAS2025-24'
].map(s => s.toUpperCase());

// gåder
const RHYMES = {
    2: "Stilhed i boksen hvor samtaler bo, bagerst på skal næste ro (2 etage).",
    3: "Grønne blade står og gror – skjules næste spor (2 etage).",
    4: "Der hvor maven får sin lykke – findes spor i køkken (2 etage).",
    5: "Følg rør der løber par om par – finder du næste svar (6C etage).",
    6: "Der hvor bunker bliver til bund – ved papirets plads er næste fund (6C etage).",
    7: "Læn dig blødt og kig en smule – bag sofaens ryg gemmer næste jule (6C etage).",
    8: "Maskinen suser: print på print—i printerrum står næste hint (7C etage).",
    9: "Skuffer gemmer ting i ro – bagerste kommode i skjuler go' (7C etage).",
    10: "Grønt ved gryder, tæt ved mad—ved planten ved køkkenet i (kantine).",
    11: "Udsigt, lys og stille charme—kig i hjørnet under vindueskarmen (kantine).",
    12: "Fodspor, stole, snak i kor—kig diskret under bagerste bord (kantine).",
    13: "Ping og pong – find næste ved bordtennisbordet (kantine).",
    14: "Sortér med stil ved affald—ved stolpens hjørne står næste kald (kantine).",
    15: "Blødt og lyst i —under vindueskarmen kan du se (8B etage).",
    16: "Inde i boksen er der fred—måske ovenpå gemmer det (8B etage).",
    17: "Duften lokker – tjek i skålen eller under bordet i køkkenet (8B etage).",
    18: "Hvor sider vendes, viden glad—i køkkenhjørnet ved bladene (8C etage).",
    19: "Bag en dør hvor lager bor—i depotrummet (8C etage).",
    20: "Sidst i rækken, stille sal—i bagerste mødelokale (8C etage).",
    21: "Op i ni'eren hvor ekko gør—ved forum-røret (9 etage).",
    22: "Se hvad skærmen si'r—på køkken-TV'et (6B etage).",
    23: "Planer ruller fri—ved Mobility-tavlen (6B etage).",
    24: "Glimt og glimmer, lys og sjov—ved diskokuglen (6B etage)."
};

const ADMIN_EMAIL = 'admin@christmas.com';
const ADMIN_PASSWORD = 'ChristmasParty2025';

// afled email ud fra bruger-id
function userIdToEmail(userid) {
    return `${String(userid || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@julefrokost.internal`;
}

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

    // auth observer
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);

                if (currentUser.email === ADMIN_EMAIL) {
                    setIsAdmin(true);
                    setView('admin');
                    loadAllUsers();
                } else {
                    const userRef = ref(database, `users/${currentUser.uid}`);
                    const snap = await get(userRef);
                    if (snap.exists()) {
                        setUserData(snap.val());
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
        return () => unsub();
    }, []);

    // læs egne scans
    const loadMyScans = (uid) => {
        const scansRef = ref(database, `scans/${uid}`);
        onValue(scansRef, (snapshot) => {
            const scansData = snapshot.val();
            setMyScans(
                scansData ? Object.values(scansData).map(s => String(s).trim().toUpperCase()) : []
            );
        });
    };

    // læs alle brugere til admin
    const loadAllUsers = () => {
        const usersRef = ref(database, 'users');
        const scansRef = ref(database, 'scans');

        onValue(usersRef, (usersSnap) => {
            onValue(scansRef, (scansSnap) => {
                const usersData = usersSnap.val() || {};
                const scansData = scansSnap.val() || {};

                const list = Object.entries(usersData).map(([uid, u]) => {
                    const userScans = scansData[uid]
                        ? Object.values(scansData[uid]).map(s => String(s).trim().toUpperCase())
                        : [];
                    return {
                        uid,
                        userId: u.userId,
                        username: u.username,
                        scannedCodes: userScans,
                        completedAt: u.completedAt || null
                    };
                });

                setAllUsers(list);
            });
        });
    };

    // register
    const handleRegister = async (username, userid, password) => {
        const u = String(username || '').trim();
        const id = String(userid || '').trim();
        const pw = String(password || '');

        if (!u || !id || !pw) {
            alert('Udfyld venligst alle felter');
            return;
        }
        if (pw.length < 6) {
            alert('Adgangskode skal være mindst 6 tegn');
            return;
        }

        try {
            const email = userIdToEmail(id);
            const cred = await createUserWithEmailAndPassword(auth, email, pw);
            const uid = cred.user.uid;

            await set(ref(database, `users/${uid}`), {
                username: u,
                userId: id,
                email,
                createdAt: new Date().toISOString()
            });

            alert('Registrering vellykket! Log venligst ind.');
            setView('login');
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/email-already-in-use') {
                alert('Dette Bruger ID er allerede i brug!');
            } else {
                alert('Registrering mislykkedes: ' + error.message);
            }
        }
    };

    // login
    const handleLogin = async (userid, password) => {
        const id = String(userid || '').trim();
        const pw = String(password || '').trim();

        try {
            if (id === 'admin' && pw === ADMIN_PASSWORD) {
                await signInWithEmailAndPassword(auth, ADMIN_EMAIL, pw);
                return;
            }
            const email = userIdToEmail(id);
            await signInWithEmailAndPassword(auth, email, pw);
        } catch (error) {
            console.error(error);
            alert('Ugyldigt Bruger ID eller adgangskode');
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        stopScanning();
    };

    // scanner
    const startScanning = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setScanning(true);
                scanIntervalRef.current = setInterval(scanQRCode, 500);
            }
        } catch (e) {
            alert('Kunne ikke åbne kamera. Tjek HTTPS og tilladelser.');
        }
    };

    const stopScanning = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(t => t.stop());
        }
        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
        setScanning(false);
    };

    // selve scanning-loopet
    const scanQRCode = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // ← den manglede hos dig
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            if (typeof window.jsQR !== 'undefined') {
                const code = window.jsQR(imageData.data, imageData.width, imageData.height);
                if (code) {
                    const raw = String(code.data || '').trim().toUpperCase();
                    if (VALID_QR_CODES.includes(raw)) {
                        handleQRCodeScanned(raw);
                    } else {
                        stopScanning();
                        alert('❌ Denne QR-kode er ikke en del af julejagten!');
                    }
                }
            }
        }
    };

    // når en kode er scannet
    const handleQRCodeScanned = async (qrCodeUpper) => {
        if (myScans.includes(qrCodeUpper)) {
            stopScanning();
            alert('⚠️ Du har allerede scannet denne QR-kode!');
            return;
        }

        try {
            // gem scannet kode
            await push(ref(database, `scans/${user.uid}`), qrCodeUpper);

            // hvis dette var sidste kode (24)
            const newCount = myScans.length + 1;
            if (newCount === 24) {
                // skriv tidspunkt på bruger
                await set(ref(database, `users/${user.uid}/completedAt`), new Date().toISOString());
            }

            stopScanning();

            // find nummer og vis gåde
            const m = qrCodeUpper.match(/(\d{1,2})$/);
            const codeNumber = m ? parseInt(m[1], 10) : null;
            const rhyme = codeNumber ? RHYMES[codeNumber] : null;

            let msg = `🎄 Perfekt! Du fandt kode ${qrCodeUpper}! 🎄\n\n`;
            if (rhyme) {
                if (codeNumber === 24) {
                    msg += `🎅 ${rhyme}`;
                } else {
                    msg += `🔍 Næste hint:\n"${rhyme}"`;
                }
            }
            alert(msg);
        } catch (e) {
            console.error(e);
            alert('Kunne ikke gemme scanning.');
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
        return (
            <LoginRegisterView
                view={view}
                setView={setView}
                handleRegister={handleRegister}
                handleLogin={handleLogin}
            />
        );
    }

    const progress = myScans.length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-600 via-green-700 to-red-800 p-4">
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                    <div className="bg-gradient-to-r from-red-600 to-green-600 p-6 text-white">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-bold">Velkommen, {userData?.username}!</h1>
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
                                <p className="text-sm text-green-800 italic">
                                    "Nede i bunden, oppe i hjørnet, sidder en rød kasse"
                                </p>
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
                                    onClick={stopScanning}
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
                                    const code = `XMAS2025-${codeNum}`.toUpperCase();
                                    const found = myScans.includes(code);
                                    return (
                                        <div
                                            key={i}
                                            className={`aspect-square rounded-lg flex items-center justify-center font-bold transition ${found ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
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

/* ----- LOGIN / REGISTER ----- */
function LoginRegisterView({ view, setView, handleRegister, handleLogin }) {
    const [formData, setFormData] = useState({ username: '', userid: '', password: '' });

    const onSubmit = (e) => {
        e.preventDefault();
        if (view === 'register') {
            handleRegister(formData.username, formData.userid, formData.password);
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
                    <p className="text-gray-600 mt-2">Log ind eller opret bruger</p>
                </div>

                <form className="space-y-4" onSubmit={onSubmit}>
                    {view === 'register' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Brugernavn</label>
                            <input
                                type="text"
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                placeholder="Dit navn"
                                autoComplete="off"
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
                            placeholder="fx medarbejder-id"
                            autoComplete="off"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Adgangskode</label>
                        <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            placeholder={view === 'register' ? 'Vælg adgangskode' : 'Din adgangskode'}
                            autoComplete="off"
                        />
                    </div>

                    <button
                        type="submit"
                        className={`w-full py-3 rounded-lg font-medium text-white transition ${view === 'login' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                            }`}
                    >
                        {view === 'login' ? 'Log ind' : 'Registrer'}
                    </button>
                </form>

                <div className="text-center mt-4">
                    <button
                        onClick={() => setView(view === 'login' ? 'register' : 'login')}
                        className="text-sm text-gray-600 hover:text-gray-800"
                    >
                        {view === 'login'
                            ? 'Har du ikke en bruger? Opret'
                            : 'Har du allerede en bruger? Log ind'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ----- ADMIN VIEW ----- */
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
                                    <h2 className="text-xl font-bold text-gray-800">{user.username}</h2>
                                    <p className="text-gray-600">Bruger ID: {user.userId}</p>
                                    <p className="text-gray-500 text-sm">
                                        {user.completedAt
                                            ? `Færdig: ${new Date(user.completedAt).toLocaleString()}`
                                            : 'Færdig: —'}
                                    </p>
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
                                    const code = `XMAS2025-${codeNum}`.toUpperCase();
                                    const found = user.scannedCodes.includes(code);
                                    return (
                                        <div
                                            key={i}
                                            className={`p-2 rounded text-center font-medium ${found ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
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