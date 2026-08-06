# Accounting Quest ケーススキーマ v2

## 目的

ケーススキーマv2は、ケースを単なる画面データではなく、次の要素を持つ学習コンテンツとして管理するための契約です。

- 何を学ぶケースか
- どの技能を前提とするか
- どの技能を練習するか
- ページがどの条件で開くか
- ヒントをどの順番で出すか
- 何をどう評価するか
- どの版の教材が公開されているか

画面固有の条件分岐を増やさず、JSONを追加することでケースを増やせる状態を目指します。

## 互換方針

公開中のCASE 1はソースJSONの`schemaVersion: 1`を維持します。ケースID、ページID、設問IDを変えると、ブラウザに保存済みの回答と結びつかなくなるためです。

読み込み時に`normalizeCaseDefinition()`がv1をv2へ変換し、アプリ内部ではすべてv2として扱います。

- v1ソース: 読み込み可能
- v2ソース: そのまま読み込み可能
- アプリ内部: 常にv2
- 新規ケース: v2で作成
- 既存ケース: 移行コマンドで任意の時点にv2化

## ファイル構成

```text
case-schema.js                       ランタイム正規化・契約検証
case-schema-bootstrap.js             ケースと技能カタログの読込
case-schema-state.js                 解除条件と段階ヒントの接続
schemas/case-v2.schema.json          機械可読のJSON Schema
scripts/validate-case-v2.mjs         公開前のv2検証
scripts/migrate-case-v2.mjs          v1からv2への変換
data/skills/index.json               共通技能カタログ
data/cases/index.json                ケースカタログv2
tests/fixtures/case-v2-minimal.json  ネイティブv2の最小例
```

## トップレベル

```json
{
  "schemaVersion": 2,
  "id": "case-002-margin-decline",
  "title": "売上は伸びた。それでも利益率が落ちた",
  "subtitle": "単価・数量・原価・固定費から利益率悪化を分解する",
  "metadata": {},
  "pedagogy": {},
  "documents": [],
  "pages": [],
  "scoring": {}
}
```

`id`は公開後に変更しません。学習記録の永続キーとして扱います。

## metadata

教材の公開・表示・運用に関する情報です。

```json
{
  "contentVersion": "1.0.0",
  "status": "draft",
  "releaseOrder": 2,
  "difficulty": {
    "level": 2,
    "label": "基礎"
  },
  "estimatedMinutes": 35,
  "format": "full-case",
  "industry": "consumer-goods",
  "companyStage": "growth",
  "fictional": true,
  "locale": "ja-JP",
  "publishedAt": null,
  "reviewedAt": null
}
```

### status

```text
draft      執筆中
reviewing  内容レビュー中
tested     数値・操作検証済み
published  アプリで公開
archived   公開終了・記録保持
planned    企画のみ
```

### contentVersion

セマンティックバージョン形式`x.y.z`を使います。

- major: 正答・論点・ケース構造が大きく変わる
- minor: ページ・設問・資料を追加する
- patch: 誤字、説明、ヒントを修正する

## pedagogy

学習設計を画面データから分離します。

```json
{
  "learningObjectives": [
    "粗利率低下の要因を単価・数量・原価に分けて説明できる"
  ],
  "prerequisiteSkillIds": [
    "analysis.variance"
  ],
  "skillIds": [
    "analysis.margin",
    "consulting.hypothesis"
  ],
  "accountingTopics": [
    "売上原価",
    "限界利益"
  ],
  "analysisMethods": [
    "前年差分析",
    "単価数量分解"
  ],
  "recommendedModes": [
    "beginner",
    "standard",
    "practical"
  ],
  "reviewStrategy": {
    "type": "spaced-retrieval",
    "intervalsDays": [1, 3, 7]
  }
}
```

## 技能カタログ

技能IDはケース間で共通です。ケース名やページ名を技能IDへ入れません。

良い例:

```text
accounting.receivables
analysis.cash-forecast
consulting.recommendation
```

避ける例:

```text
case-001-step-04
bright-stage-question
```

技能には前提技能を設定できます。循環参照と存在しない前提技能はCIで拒否します。

## ページ

v2ページは`unlock`、`estimatedMinutes`、`skillIds`を持ちます。

```json
{
  "id": "page-02-hypothesis",
  "order": 2,
  "type": "exercise",
  "title": "最初に何を確認するか",
  "unlock": {
    "type": "page-complete",
    "pageId": "page-01-briefing"
  },
  "estimatedMinutes": 4,
  "skillIds": [
    "consulting.hypothesis"
  ],
  "steps": []
}
```

### unlock.type

```text
always                 常に開ける
page-complete          指定ページ完了後
all-previous-complete  前ページをすべて完了後
skill-mastered         指定技能の習熟後
manual                 ケース固有の条件
```

`page-complete`は自分より前のページだけを参照できます。未来ページや存在しないページへの参照はCIで拒否します。

## 設問

v2設問は`skillIds`、`hints`、`assessment`を持ちます。

```json
{
  "id": "step-02-01",
  "type": "multipleChoice",
  "instruction": "最初に確認する項目を2つ選んでください。",
  "skillIds": [
    "consulting.hypothesis",
    "reasoning.evidence-selection"
  ],
  "hints": [],
  "assessment": {},
  "options": []
}
```

## 段階ヒント

ヒントは弱い支援から強い支援へ並べます。

```json
{
  "hints": [
    {
      "level": 1,
      "label": "着眼点",
      "text": "利益だけでなく、資産項目の前年差を確認します。"
    },
    {
      "level": 2,
      "label": "考え方",
      "text": "現預金がどの資産へ移ったかを追います。"
    },
    {
      "level": 3,
      "label": "式",
      "text": "当期末残高－前期末残高で増減額を求めます。"
    }
  ]
}
```

原則:

1. level 1は答えを明示しない
2. level 2は見る資料や考え方を示す
3. level 3は式・手順を示す
4. 正答そのものは解説へ置く

v1ケースでは、既存の`hint`と`feedback`から段階ヒントを自動補完します。現在のUIは最初の段階を表示し、後続段階を扱えるデータ構造を保持します。

## assessment

採点方法とルーブリックを明示します。

```json
{
  "assessment": {
    "mode": "auto",
    "maxPoints": 10,
    "rubricCriteria": []
  }
}
```

### mode

```text
auto         正答データで自動採点
self-review  チェックリストで自己評価
completion   完了のみ記録
none         評価対象外
```

自由記述では、正解文との文字一致を採点に使いません。評価観点を`rubricCriteria`へ記述します。

## v1正規化

v1から不足項目を次のように補完します。

- `difficulty` → `metadata.difficulty`
- `estimatedMinutes` → `metadata.estimatedMinutes`
- `learningObjectives` → `pedagogy.learningObjectives`
- カタログの`skillIds` → `pedagogy.skillIds`
- 先頭ページ → `unlock.type: always`
- 2ページ目以降 → 直前ページ完了で解除
- 設問形式 → 基本技能IDを推定
- `hint`と`feedback` → 段階ヒント
- `scoring.maxPoints` → `assessment.maxPoints`

正規化は入力オブジェクトを変更しません。

## 移行コマンド

変換結果を別ファイルへ出力:

```bash
node scripts/migrate-case-v2.mjs \
  data/cases/case-001-black-profit-no-cash.json \
  --out /tmp/case-001-v2.json
```

同じファイルを置き換える場合:

```bash
node scripts/migrate-case-v2.mjs \
  data/cases/case-001-black-profit-no-cash.json \
  --write
```

`--write`は専用ブランチで実行し、差分・保存互換・ブラウザ回帰を確認してから統合します。

## 検証

```bash
npm run validate:schema-v2
npm run check
npm run test:e2e
```

CIでは次を確認します。

- 技能IDの重複、未知参照、前提技能の循環
- v1ケースがv2へ正規化できること
- ネイティブv2の必須項目
- ページ解除条件
- 段階ヒントの順序と重複
- 評価方式と配点
- ケースカタログとケース本体の版整合
- 既存の会計数値、採点、PWA、ブラウザ導線

## 公開後に変更しないもの

- case id
- page id
- step id
- option id
- document id
- value id

表示文やヒントは変更できますが、保存済み回答と結びつくIDは安易に変更しません。
