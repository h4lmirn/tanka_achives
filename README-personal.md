# 目黒なずな 短歌アーカイブ

目黒なずな（[@Ulll10ri](https://x.com/Ulll10ri) → はるさんのXに変えてください）の短歌アーカイブです。

🔗 **https://h4lmirn.github.io/tanka_achives/**

---

## 構成

```
tanka_achives/
├── index.html          … 公開サイト
├── tanka.json          … 短歌データ
├── keywords.json       … タグ用キーワード辞書
├── ogp.png             … OGP画像
├── LICENSE             … ライセンス
├── .gitignore
├── notes/              … Obsidian用 mdファイル（自動生成）
├── themes/             … テーマHTMLファイル
└── .github/workflows/  … GitHub Actions
    ├── add-tanka.yml
    ├── edit-tanka.yml
    ├── delete-tanka.yml
    ├── generate-notes.yml
    ├── deploy.yml
    └── create-templates.yml
```

## 短歌の追加・編集・削除

GitHubの [Actions](../../actions) タブから操作します。コードの編集は不要です。

| ワークフロー | 操作 |
|---|---|
| 短歌を追加する | 新しい短歌を追加 |
| 短歌を編集する | 本文・日付・連作名を変更 |
| 短歌を削除する | 1首を削除（誤操作防止あり） |
| 初回セットアップ | notes/ を一括再生成 |

## タグキーワードの編集

`keywords.json` を直接編集してください。編集後は「初回セットアップ」を再実行すると全首のタグが更新されます。

## ライセンス

短歌（tanka.json）は © 目黒なずな All rights reserved。出典明記のうえ引用可。

サイトコード（index.html）は MIT License。
