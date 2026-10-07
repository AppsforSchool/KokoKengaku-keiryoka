// ★ Firebase（モジュラーSDK）の初期化と、各ファイルで使う関数の共通窓口。
//   バージョンを変えるときは、下の FIREBASE_VERSION だけを書き換えればよい。
//   index.html / app.html / talk.html の <head> にあった compat 版の <script> は不要になった。
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getDocFromServer,
  getDocsFromServer,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  getCountFromServer,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  Timestamp,
  documentId
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAqIiNj0N4WruPSOkWbeo5gxzsNyeMkuLo",
  authDomain: "appsforschool-study.firebaseapp.com",
  projectId: "appsforschool-study",
  storageBucket: "appsforschool-study.firebasestorage.app",
  messagingSenderId: "740735293440",
  appId: "1:740735293440:web:982702b6d53aaa18ec60e5"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// ★ Firestoreの通信方式。学校などのネットワークでは、通常の方式（WebChannel）の読み取りだけが
//   数十秒止まることがあったため、既定を「ロングポーリング」にしている。
//   切り替え（A/B比較用）：URLに ?fs=long / ?fs=auto / ?fs=default を付けて開くと、その設定が端末に保存される。
//     long    … 常にロングポーリング（既定）
//     auto    … 通常方式で接続できなければ自動でロングポーリングに切り替える
//     default … SDKの標準（以前と同じ）
function pickTransport() {
  let mode = "long";
  try {
    const fromUrl = new URLSearchParams(location.search).get("fs");
    if (fromUrl === "long" || fromUrl === "auto" || fromUrl === "default") {
      localStorage.setItem("fsTransport", fromUrl);
    }
    const saved = localStorage.getItem("fsTransport");
    if (saved === "long" || saved === "auto" || saved === "default") mode = saved;
  } catch (e) { /* localStorageが使えなければ既定値 */ }
  return mode;
}
export const firestoreTransport = pickTransport();

const firestoreSettings = {};
if (firestoreTransport === "long") firestoreSettings.experimentalForceLongPolling = true;
if (firestoreTransport === "auto") firestoreSettings.experimentalAutoDetectLongPolling = true;

// ★ 永続キャッシュ（IndexedDB）を有効にする。2回目以降は、サーバーを待たずに前回のデータを先に表示できる。
//   使えない環境（プライベートモード等）では、キャッシュなしで続行する。
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    ...firestoreSettings,
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  console.warn("Firestoreの永続キャッシュを有効にできませんでした:", e);
  try {
    firestoreInstance = initializeFirestore(app, firestoreSettings);
  } catch (e2) {
    firestoreInstance = getFirestore(app);
  }
}
export const db = firestoreInstance;

export {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc,
  query, where, orderBy, onSnapshot, writeBatch, getCountFromServer,
  serverTimestamp, arrayUnion, arrayRemove, Timestamp, documentId,
  getDocFromServer, getDocsFromServer
};
