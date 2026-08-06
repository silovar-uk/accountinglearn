# Accounting Quest

実践簿記と経営分析を、短い経営ケースで学ぶスマホ優先のWebアプリです。

## 現在の実装

- CASE 1「黒字なのに、口座にお金がない」全8ページ
- CASE 2「倉庫に眠るヒット商品」全8ページ
- CASE 1へ接続する基礎簿記6単元・24問
- 売上と入金、売掛金、前受金、費用と支払い、キャッシュフロー、運転資本
- 在庫、粗利益率、消化率、在庫回転日数、SKU別採算、商品評価損
- JSONからケース・基礎教材・資料・設問を描画
- ケーススキーマv2とv1互換のランタイム正規化
- 共通技能カタログとケース・ページ・設問・基礎単元の技能接続
- 選択問題、複数選択、数値入力、異常値選択、計算、仕訳、提案入力
- 段階ヒント、回答履歴、初回正答率、再挑戦
- スマート再開と条件付きページ解除
- ケースと基礎問題の誤答復習
- 基礎単元の得点・完了・技能習得度
- 数値を資料から選べる計算トレイ
- 連続学習日数と1日の学習目標
- ブラウザ内の進捗保存
- 学習データのJSON書き出し・読込
- PWA、オフライン起動、ホーム画面アイコン
- PC／スマートフォンのPlaywright回帰テスト
- 外部ランタイムライブラリ不要

## 起動

ローカルファイルを直接開くのではなく、HTTPサーバー経由で開きます。

```bash
npm run serve
```

ブラウザで `http://localhost:4173` を開いてください。

## 検証

高速検証:

```bash
npm run check
```

実ブラウザ検証:

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

`npm run check`では、JavaScript構文、公開中の全ケースJSON、基礎教材JSON、財務数値、ケーススキーマv2、技能参照、全ケース横断の設問ID、ページ解除条件、CASE 1リンク、UI資産、計算エンジン、PWA資産を確認します。GitHub Actionsでは高速検証の成功後にPC・スマートフォンのブラウザ回帰を実行します。

## 公開ケース

### CASE 1 黒字なのに、口座にお金がない

イベント制作会社を題材に、利益と現金、売掛金、設備投資、資金繰りを扱います。公開済みソースは保存互換のためschemaVersion 1のまま保持し、実行時にv2へ正規化します。

### CASE 2 倉庫に眠るヒット商品

スポーツアパレル会社を題材に、売上増加と粗利率低下、SKU別採算、値引き、在庫回転、商品評価損を扱います。新規制作の標準形として、最初からschemaVersion 2で記述しています。

主要な分析値:

- 売上高 18,000万円 → 22,500万円
- 粗利益率 40.0％ → 34.0％
- 棚卸資産 2,400万円 → 4,800万円
- 在庫回転日数 約81日 → 約118日
- 記念Tシャツ消化率 60％
- 商品評価損 360万円

## 基礎簿記コース

初期コースは、CASE 1を理解するための6単元です。資格試験の章順ではなく、ケースで必要になる順に構成しています。

1. 売上と入金
2. 売掛金
3. 前受金
4. 費用と支払い
5. キャッシュフロー
6. 運転資本

教材本体は`data/basics/index.json`、採点は`basics-engine.js`、制作・検証方針は`docs/foundations-course.md`にあります。

```bash
npm run validate:basics
```

単元得点が80％以上の場合、対応する技能を習得として記録します。誤答は復習画面へ追加され、正解し直すと候補から外れます。

## ケース追加

新規ケースは`schemaVersion: 2`で作成します。

1. `tests/fixtures/case-v2-minimal.json`を参考にケースJSONを作る
2. 必要な技能を`data/skills/index.json`へ追加する
3. 全ケースで重複しない設問IDを付ける（例：`c003-step-02-01`）
4. `data/cases/index.json`へケース情報とパスを追加する
5. ケース単体を検証する
6. 全体検証とブラウザ回帰を実行する

```bash
npm run validate:case -- data/cases/<file>.json
npm run validate:schema-v2
npm run check
npm run test:e2e
```

公開済みIDは学習記録と結びつくため、case・page・step・option・document・valueの各IDを安易に変更しません。特にstep IDは回答と計算補助の共通キーになるため、ケース番号を接頭辞として付けます。

## v1ケースの移行

公開中のCASE 1は保存互換のため、ソースJSONをv1のまま保持し、読み込み時にv2へ正規化しています。変換結果を確認する場合は、別ファイルへ出力します。

```bash
npm run migrate:case-v2 -- \
  data/cases/case-001-black-profit-no-cash.json \
  --out /tmp/case-001-v2.json
```

ソースを直接置き換える`--write`は、専用ブランチで保存互換とブラウザ回帰を確認する場合に限って使用します。

## 設計資料

- `docs/foundations-course.md`
- `docs/case-002-inventory-margin.md`
- `docs/case-schema-v2.md`
- `docs/case-authoring-checklist.md`
- `docs/browser-regression.md`
- `docs/ui-implementation-plan.md`
- `docs/deep-ux-implementation.md`
- `schemas/case-v2.schema.json`
