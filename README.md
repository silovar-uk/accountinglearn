# Accounting Quest

実践簿記と経営分析を、短い経営ケースで学ぶスマホ優先のWebアプリです。

## 現在の実装

- CASE 1「黒字なのに、口座にお金がない」全8ページ
- JSONからケース・資料・設問を描画
- 選択問題、異常値選択、計算、仕訳、提案入力
- 回答直後のフィードバックと自動採点
- ページ単位の完了判定
- 全必須項目を確認した場合のみケース完了
- スマホ用の財務諸表カード表示
- 誤答の復習リスト
- ブラウザ内の進捗保存
- 学習データのJSON書き出し
- 独自favicon、Web App Manifest、ホーム画面用アイコン
- PC／スマートフォン対応
- 外部ライブラリ不要

## UI/UX方針

- 1ページにつき、主な学習目的は1つ
- ホームでは「次に何をするか」を最優先
- ケース中はメインナビを隠し、ページ移動へ集中
- 正誤は色だけでなく、アイコン・見出し・枠で表現
- スマホでは横長の財務表をカード表示へ切り替え
- Duolingoの配色やキャラクターを模倣せず、短い学習・明確な次行動・即時フィードバックという原則だけを参考にする

詳細は [`docs/ui-implementation-plan.md`](docs/ui-implementation-plan.md) を参照してください。

## 起動

ローカルファイルを直接開くのではなく、HTTPサーバー経由で開きます。

```bash
npm run serve
```

ブラウザで `http://localhost:4173` を開いてください。

## 検証

```bash
npm run check
```

個別に実行する場合：

```bash
npm run check:js
npm run validate
npm test
```

## ケース追加

1. `data/cases/` にケースJSONを追加
2. `data/cases/index.json` にパスを追加
3. `npm run validate -- data/cases/<file>.json` で検証

Reactなどのフレームワークへ移行する場合も、`data/cases/` の教材JSONはそのまま利用する想定です。
