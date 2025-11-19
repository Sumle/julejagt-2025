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
import jsQR from 'jsqr';

// 🔥 Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyC-zAgKY_PZ-5F3Osjhg_Gf-K53Nhxop2Y",
    authDomain: "christmas-qr-hunt.firebaseapp.com",
    databaseURL: "https://christmas-qr-hunt-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "christmas-qr-hunt",
    storageBucket: "christmas-qr-hunt.firebasestorage.app",
    messagingSenderId: "238790514747",
    appId: "1:238790514747:web:544b9afd56b47cb24a641e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// ✅ dine 24 koder
const VALID_QR_CODES = [
    'XMAS2025-01', 'XMAS2025-02', 'XMAS2025-03', 'XMAS2025-04',
    'XMAS2025-05', 'XMAS2025-06', 'XMAS2025-07', 'XMAS2025-08',
    'XMAS2025-09', 'XMAS2025-10', 'XMAS2025-11', 'XMAS2025-12',
    'XMAS2025-13', 'XMAS2025-14', 'XMAS2025-15', 'XMAS2025-16',
    'XMAS2025-17', 'XMAS2025-18', 'XMAS2025-19', 'XMAS2025-20',
    'XMAS2025-21', 'XMAS2025-22', 'XMAS2025-23', 'XMAS2025-24',
].map(s => s.toUpperCase());

// gåder
const RHYMES = {
    1: "Stilhed i boksen hvor samtaler bo — bagerst på to'eren skal næste ha' ro (2 etage).",
    2: "Grønne blade står og gror — skjules næste spor (2 etage).",
    3: "Over hvor maven får sin lykke — findes spor i køkkenskabet (2 etage).",
    4: "Følg rør der løber par om par — finder du næste svar (6C etage).",
    5: "Der hvor bunker bliver til bund — ved papirets plads er næste fund (6C etage).",
    6: "Læn dig blødt og kig en smule — bag sofaens ryg gemmer næste jule (6C etage).",
    7: "Maskinen suser: print på print — i printerrum står næste hint (7C etage).",
    8: "Skuffer gemmer ting i ro — bagerste kommode i skjuler go' (7C etage).",
    9: "Grønt ved gryder, tæt ved mad — ved planten gemt i køkkenet (7C etage).",
    10: "Udsigt, lys og stille charme — kig i hjørnet under vindueskarme (kantine).",
    11: "Fodspor, stole, snak i kor — kig diskret under bagerste bord (kantine).",
    12: "Ping og pong — find ved sports bordet (kantine).",
    13: "Sortér med stil ved affald — ved stolpens hjørne står næste kald (kantine).",
    14: "Blødt at sidde og lyst at se — første sofaer kan du tjek (8B etage).",
    15: "Inde i boksen er der fred — måske siddende kan du se (8B etage).",
    16: "Kaffe og mad lokker — tjek under bordet måske (8B etage).",
    17: "Hvor sider vendes, viden glad — i køkkenhjørnet ved bladene (8C etage).",
    18: "Der hvor papir bor og planer printes — hænger nissen ved IT (8C etage).",
    19: "Hængende på bagerste lokales dør — shh nissen skal ikke larme (8C etage).",
    20: "Op i ni'eren hvor ekko gør — ved forum-røret (9 etage).",
    21: "Se hvad skærmen si'r — i rummet med kaffe og mad (6B etage).",
    22: "Her kan man tegne på tavle — mobility har kreative løsninger (6B etage).",
    23: "Glimt og glimmer, lys og sjov — rejsende diskokugle skal findes (6B etage).",
    24: "Du fandt dem alle, hurra for dig — nu venter julefest og leg!"
};

const ADMIN_EMAIL = 'admin@christmas.com';
const ADMIN_PASSWORD = 'ChristmasParty2025';

function userIdToEmail(userid) {
    return `${String(userid || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@julefrokost.internal`;
}

export default function App() {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [view, setView] = useState('login');
    const [allUsers, setAllUsers] = useState([]);
    const [myScans, setMyScans] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showScanner, setShowScanner] = useState(false);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const scanIntervalRef = useRef(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                if (currentUser.email === ADMIN_EMAIL) {
                    setUser(currentUser);
                    setIsAdmin(true);
                    setView('admin');
                    loadAllUsers();
                } else {
                    setUser(currentUser);
                    setIsAdmin(false);
                    const userRef = ref(database, `users/${currentUser.uid}`);
                    const snap = await get(userRef);
                    if (snap.exists()) setUserData(snap.val());
                    setView('hunt');
                    loadMyScans(currentUser.uid);
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

    const loadMyScans = (uid) => {
        const scansRef = ref(database, `scans/${uid}`);
        onValue(scansRef, (snapshot) => {
            const scansData = snapshot.val();
            const list = scansData
                ? Object.values(scansData).map(s => String(s).trim().toUpperCase())
                : [];
            setMyScans(list);
        });
    };

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

    const handleRegister = async (username, userid, password) => {
        const u = String(username || '').trim();
        const id = String(userid || '').trim();
        const pw = String(password || '').trim();

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
                alert('Dette Kaldenavn er allerede i brug!');
            } else {
                alert('Registrering mislykkedes: ' + error.message);
            }
        }
    };

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
            alert('Ugyldigt Kaldenavn eller adgangskode');
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        closeScanner();
    };

    const showHintForCode = (code) => {
        const match = code.match(/(\d{1,2})$/);
        const num = match ? parseInt(match[1], 10) : null;
        const rhyme = num ? RHYMES[num] : null;

        if (!num) {
            alert("Ingen hint til den kode.");
            return;
        }

        let msg = `🎄 Hint til kode #${num + 1}\n`;
        if (rhyme) {
            msg += `\n${rhyme}`;
        } else {
            msg += "\n(der er ikke skrevet et hint til denne endnu)";
        }
        alert(msg);
    };

    const openScanner = async () => {
        setShowScanner(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                // start interval når kamera kører
                scanIntervalRef.current = setInterval(scanFrame, 700);
            }
        } catch (err) {
            console.error(err);
            alert("Kunne ikke åbne kamera. Tjek HTTPS og tilladelser.");
            closeScanner();
        }
    };

    const closeScanner = () => {
        setShowScanner(false);
        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(t => t.stop());
        }
    };

    const scanFrame = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!video.videoWidth || !video.videoHeight) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // 👇 nu bruger vi den importerede jsQR
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
            const raw = String(code.data || '').trim().toUpperCase();
            console.log("📦 QR læst:", raw);
            if (VALID_QR_CODES.includes(raw)) {
                handleQRCodeScanned(raw);
            } else {
                closeScanner();
                alert("❌ Der blev scannet en QR-kode, men den er ikke en af julejagtens koder.\n\nFandt: " + raw);
            }
        }
    };

    const handleQRCodeScanned = async (qrCodeUpper) => {
        closeScanner();

        if (!user) {
            alert("Du er ikke logget ind.");
            return;
        }

        if (myScans.includes(qrCodeUpper)) {
            alert("⚠️ Du har allerede scannet " + qrCodeUpper);
            return;
        }

        try {
            await push(ref(database, `scans/${user.uid}`), qrCodeUpper);

            const newCount = myScans.length + 1;
            if (newCount === 24) {
                await set(ref(database, `users/${user.uid}/completedAt`), new Date().toISOString());
            }

            const m = qrCodeUpper.match(/(\d{1,2})$/);
            const codeNumber = m ? parseInt(m[1], 10) : null;
            const rhyme = codeNumber ? RHYMES[codeNumber] : null;

            let msg = `🎄 Perfekt! Du fandt ${qrCodeUpper}!`;
            if (rhyme) {
                if (codeNumber === 24) {
                    msg += `\n\n🎅 ${rhyme}`;
                } else {
                    msg += `\n\n🔍 Næste hint:\n"${rhyme}"`;
                }
            }
            alert(msg);
        } catch (e) {
            console.error(e);
            alert("Kunne ikke gemme scanning.");
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
                                <p className="text-red-100">Julefrokost QR Jagt 2025</p>
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
                                <li>• Find alle 24 QR-koder gemt rundt omkring</li>
                                <li>• Tryk på “Scan QR-kode” til at scanne QR-koder</li>
                                <li>• Peg kameraet på en QR-kode</li>
                                <li>• Følg rækkefølgen 1-24, for at få hints til at finde næste kode</li>
                                <li>• Hvis du glemmer et hint, så klik på det tal for at læse hintet igen</li>
                                <li>• Der bliver taget lodtrækning, mellem dem der har deltaget. Vinderen får en præmie! 🎁</li>
                            </ul>
                            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                                <p className="text-sm text-green-900 font-semibold mb-1">🔍 Første hint:</p>
                                <p className="text-sm text-green-800 italic">
                                    “Nede i bunden, oppe i hjørnet, sidder en rød kasse”
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={openScanner}
                            className="w-full bg-gradient-to-r from-red-600 to-green-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 hover:shadow-lg transition mb-6"
                        >
                            📷 Scan QR-kode
                        </button>

                        {showScanner && (
                            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                                <div className="bg-white rounded-xl overflow-hidden w-full max-w-md">
                                    <div className="flex items-center justify-between p-4 border-b">
                                        <h2 className="font-bold text-gray-800">Scan QR-kode</h2>
                                        <button
                                            onClick={closeScanner}
                                            className="text-red-500 font-bold text-lg"
                                        >
                                            ×
                                        </button>
                                    </div>
                                    <div className="relative bg-black">
                                        <video ref={videoRef} className="w-full" playsInline />
                                        <canvas ref={canvasRef} className="hidden" />
                                    </div>
                                    <div className="p-3 text-center text-sm text-gray-500">
                                        Peg kameraet mod din nisse-kode 🎄
                                    </div>
                                </div>
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
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => {
                                                if (found) {
                                                    showHintForCode(code);
                                                } else {
                                                    alert("Du har ikke scannet den her endnu 🎄");
                                                }
                                            }}
                                            className={`aspect-square rounded-lg flex items-center justify-center font-bold transition
          ${found ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
        `}
                                        >
                                            {found ? '✓' : (i + 1)}
                                        </button>
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">Dit navn</label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">Kaldenavn</label>
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
                        <div key={user.uid} className="bg-white rounded-lg shadow p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">{user.username}</h2>
                                    <p className="text-gray-600">Kaldenavn: {user.userId}</p>
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
