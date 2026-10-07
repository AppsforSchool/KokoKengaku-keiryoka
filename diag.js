// ★ Firestoreの通信診断（管理者の計測パネルの「通信診断を実行」ボタンから呼ばれる）。
//   同じデータを違う読み方で取得して、どれが遅いのかを比べる。すべて「サーバーから」取得する（キャッシュは使わない）。
//   2周して、毎回遅いのか・たまに遅いのかも見えるようにしている。
import {
  db, firestoreTransport, collection, doc, getDocFromServer, getDocsFromServer,
  query, where, documentId, getCountFromServer
} from "./firebase.js";

const fmt = (ms) => (ms >= 1000 ? (ms / 1000).toFixed(2) + " 秒" : Math.round(ms) + " ms");

async function timed(label, fn) {
  const t = performance.now();
  try {
    const detail = await fn();
    return `${label}: ${fmt(performance.now() - t)}${detail ? " （" + detail + "）" : ""}`;
  } catch (e) {
    return `${label}: 失敗 ${fmt(performance.now() - t)} （${e && e.message ? e.message : e}）`;
  }
}

export async function runFirestoreDiagnostics(myUserId) {
  const lines = [`通信方式: ${firestoreTransport}（URLに ?fs=default / ?fs=auto / ?fs=long を付けて開くと切り替え可）`];
  let ids = [];
  for (let round = 1; round <= 2; round++) {
    lines.push(`--- ${round}周目 ---`);
    lines.push(await timed("① 単体 getDoc（自分のユーザー文書）", async () => {
      await getDocFromServer(doc(db, "users_random", myUserId));
    }));
    lines.push(await timed("② コレクション全件 getDocs（users_random）", async () => {
      const snap = await getDocsFromServer(collection(db, "users_random"));
      ids = snap.docs.map((d) => d.id).slice(0, 9);
      return `${snap.size}件`;
    }));
    lines.push(await timed(`③ "in" クエリ（${ids.length}件）`, async () => {
      if (ids.length === 0) return "対象なし";
      await getDocsFromServer(query(collection(db, "users_random"), where(documentId(), "in", ids)));
    }));
    lines.push(await timed(`④ getDoc を並列（${ids.length}件）`, async () => {
      await Promise.all(ids.map((id) => getDocFromServer(doc(db, "users_random", id))));
    }));
    lines.push(await timed("⑤ count集計（REST通信）", async () => {
      const s = await getCountFromServer(collection(db, "users_random"));
      return `${s.data().count}件`;
    }));
  }
  return lines;
}
