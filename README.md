# Accounting Quest

実践簿記と経営分析を、短い経営ケースで学ぶスマホ優先のWebアプリです。

## 現在の実装

- CASE 1「黒字なのに、口座にお金がない」全8ページ
- JSONからケース・資料・設問を描画
- 選択問題、異常値選択、計算、仕訳、提案入力
- 回答直後のフィードバックと自動採点
- 誤答の復習リスト
- ブラウザ内の進捗保存
- 学習データのJSON書き出し
- PC／スマートフォン対応
- 外部ライブラリ不要

## 起動

ローカルファイルを直接開くのではなく、HTTPサーバー経由で開きます。

```bash
npm run serve
```

ブラウザで `http://localhost:4173` を開いてください。

## 検証

```bash
npm run validate
npm test
```

## ケース追加

1. `data/cases/` にケースJSONを追加
2. `data/cases/index.json` にパスを追加
3. `npm run validate -- data/cases/<file>.json` で検証

Reactなどのフレームワークへ移行する場合も、`data/cases/` の教材JSONはそのまま利用する想定です。
