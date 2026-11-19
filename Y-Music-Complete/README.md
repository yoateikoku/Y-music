# Y-Music v3.0 Complete Edition

純粋な HTML / CSS / Vanilla JavaScript で構成された、DJ風フラッグシップ音楽再生プレイヤー＆オーディオスタジオです。

## ファイル構成
```text
Y-Music/
├── index.html          # メインUI
├── settings.json       # アイコン・Hi-Fiプリセット・お知らせ・セキュリティ設定
├── css/
│   └── style.css       # PC横長3カラム / スマホ最適化スタイル
└── js/
    ├── security.js     # レート制限・XSSサニタイズ・改ざん抑止
    ├── url-parser.js   # YouTube / Spotify / Apple Music / SoundCloud / ニコニコ / 直リンク抽出
    ├── audio-engine.js # Web Audio API Hi-Fi DSP・EQ・サンプラーFX・WAV書き出し・LIVE録音
    ├── visualizer.js   # 音声連動 虹色スペクトラム背景グラフ
    └── app.js          # メインコントローラー・NON-STOP再生・プレイリスト・検索
```

## GitHub Pages で起動する手順
1. GitHub で新しいリポジトリを作成し、このフォルダ内のファイルをそのままアップロードします。
2. リポジトリの **Settings** → **Pages** を開きます。
3. **Source** を `Deploy from a branch`、**Branch** を `main`（`/ (root)`）にして **Save** をクリックします。
4. 数十秒後に発行される `https://<ユーザー名>.github.io/<リポジトリ名>/` にアクセスすると起動します。

## Cloudflare Pages で起動する手順
1. Cloudflare ダッシュボード → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** を選択します。
2. GitHub リポジトリを選び、ビルドコマンドは空欄のまま **Save and Deploy** をクリックします。
