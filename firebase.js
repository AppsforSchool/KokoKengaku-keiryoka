// ★ Firebase（モジュラーSDK）の初期化と、各ファイルで使う関数の共通窓口。
//   バージョンを変えるときは、下の FIREBASE_VERSION だけを書き換えればよい。
//   index.html / app.html / talk.html の <head> にあった compat 版の <script> は不要になった。
import { perfSample } from "./perf.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  initializeAuth,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
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
// ★ Auth は getAuth() ではなく initializeAuth() で初期化する。
//   getAuth() は、Googleログインのポップアップ/リダイレクト用に外部のiframe（apis.google.com・firebaseapp.com/__/auth/iframe）を
//   起動時に読み込む。このアプリはID+パスワードのログインしか使わないので不要で、ブラウザの設定や拡張機能で
//   これがブロックされると「ログイン状態の確定」が進まなくなることがあるため、外している。
//
// ★ ログイン情報の保存先は、全ブラウザで localStorage にする。
//   Safari（iPhone/iPad/Mac）では、IndexedDBの最初のアクセスが約10秒止まることがあり（計測：ログイン状態の確定に9.99秒、
//   外部通信が始まる前の約9.4秒が空白）、その間ずっと読み込み画面のままになる。
//   Firebase Authは、保存先の候補にIndexedDBが入っているだけで、既存のログイン情報を探すために必ずそこを読みに行くので、
//   候補からIndexedDBを外し、即座に読める localStorage を使う。
//   localStorageが使えない環境では、sessionStorage（タブを閉じるまで）→ メモリ（ページを閉じるまで）の順に代替する。
//   ※ 以前のIndexedDBに残っているログイン情報は読まないため、切り替え後に1回だけ、ログインし直しが必要。
export const authStorageMode = "local";

export const auth = initializeAuth(app, {
  persistence: [browserLocalPersistence, browserSessionPersistence, inMemoryPersistence]
});

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

// ★ 永続キャッシュ（IndexedDB）は、既定ではオフ。
//   オンにすると、ページ遷移（一覧 → トーク）のたびに「複数タブ間のIndexedDBの引き継ぎ」が入り、
//   スマホ（特にiOS）で読み込みが止まる例があるため。試したいときは URLに ?cache=on（戻すときは ?cache=off）。
function pickCacheMode() {
  let mode = "off";
  try {
    const fromUrl = new URLSearchParams(location.search).get("cache");
    if (fromUrl === "on" || fromUrl === "off") localStorage.setItem("fsCache", fromUrl);
    const saved = localStorage.getItem("fsCache");
    if (saved === "on" || saved === "off") mode = saved;
  } catch (e) { /* 既定値のまま */ }
  return mode;
}
export const firestoreCacheMode = pickCacheMode();

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, firestoreCacheMode === "on"
    ? { ...firestoreSettings, localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }
    : firestoreSettings);
} catch (e) {
  console.warn("Firestoreの初期化設定に失敗しました:", e);
  firestoreInstance = getFirestore(app);
}
export const db = firestoreInstance;

export {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc,
  query, where, orderBy, onSnapshot, writeBatch, getCountFromServer,
  serverTimestamp, arrayUnion, arrayRemove, Timestamp, documentId,
  getDocFromServer, getDocsFromServer
};

// ★ 読み取りが「返ってこない」ときの再送。
//   計測で、読み取りが1本だけ約30秒止まる（同じ時間に出した別の読み取りは0.1秒で返る）ことがあったため、
//   hedgeMs 待っても結果が来なければ、同じ読み取りをもう1本出し直し、先に返ったほうを使う
//   （最初の1本は止めずに残す。最大 maxAttempts 本）。すべて失敗したときだけエラーにする。
//   使い方：  await hedged(() => getDoc(doc(db, "a", "b")))
export function hedged(fn, { hedgeMs = 4000, maxAttempts = 3 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let attempts = 0;
    let failures = 0;
    let timer = null;

    const launch = () => {
      attempts++;
      if (attempts > 1) perfSample("読み取りの再送（待っても返らず出し直した回数）", hedgeMs);
      Promise.resolve().then(fn).then(
        (value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          failures++;
          if (settled) return;
          if (failures >= attempts) { // 動いているものが無くなった
            clearTimeout(timer);
            if (attempts >= maxAttempts) { settled = true; reject(error); }
            else launch();
          }
        }
      );
      if (attempts < maxAttempts) {
        clearTimeout(timer);
        timer = setTimeout(() => { if (!settled) launch(); }, hedgeMs);
      }
    };
    launch();
  });
}
