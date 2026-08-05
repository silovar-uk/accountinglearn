# Accounting Quest

実践簿記と経営分析を、短い経営ケースで学ぶスマホ優先のWebアプリです。

## 現在の実装

- CASE 1「黒字なのに、口座にお金がない」全8ページ
- JSONからケース・資料・設問を描画
- 選択問題、異常値選択、計算、仕訳、提案入力
- 回答直後のフィードバックと自動採点
- 回答履歴、初回正答率、再挑戦、ヒント
- スマート再開とページ単位の完了判定
- 誤答の復習リスト
- 数値を資料から選べる計算トレイ
- 連続学習日数と1日の学習目標
- ブラウザ内の進捗保存
- 学習データのJSON書き出し・読込
- PWA、オフライン起動、ホーム画面アイコン
- PC／スマートフォン対応
- 外部ランタイムライブラリ不要

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

このコマンドで、JavaScript構文、ケースJSON、財務数値、UI資産、計算エンジン、PWA資産を確認します。GitHub Actionsでも同じ検証を実行します。

## ケース追加

1. `data/cases/` にケースJSONを追加
2. `data/cases/index.json` にパスを追加
3. `npm run validate -- data/cases/<file>.json` で検証

教材JSONと表示ロジックを分離しているため、新しいケースは可能な限りデータ追加だけで公開できる設計です。

## 設計資料

- `docs/ui-implementation-plan.md`
- `docs/deep-ux-implementation.md`
