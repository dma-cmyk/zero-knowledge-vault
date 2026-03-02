<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ゼロ知識Vault 🔐
> アキネイター風AI質問で解読する、次世代の記憶ベース・パスワードマネージャー

## 🌟 プロジェクト概要

「ゼロ知識Vault」は、Google Gemini AIを活用したユニークなパスワード管理ツールです。パスワードを直接保存するのではなく、あなたの「記憶」とAIとの対話を通じて、必要な時だけ鍵を導出します。

特定の対象（初恋の人の名前、思い出の場所など）を思い浮かべ、AI（ランプのお姉さん）が出題する20の質問に答えることで、暗号化されたパスワードを解読します。対象の名前自体はデータベースに保存されないため、究極のプライバシーを実現します。

## ✨ 主な機能

- 🧠 **記憶ベースの鍵導出**: 特定の単語を保存せず、回答のパターンと特定の名前から動的に鍵を生成。
- 🤖 **Gemini AI による質問生成**: テーマに沿ったミステリアスな質問をAIがリアルタイムに作成。
- 🎨 **モダンなネオブリーズムUI**: ビビッドなカラーとダークモードに対応した、直感的でプレミアムなデザイン。
- 🛡️ **セキュアな設計**: AES-GCMによる暗号化、メモリサニタイズ、オートロック機能を搭載。
- 📦 **ポータビリティ**: データのバックアップと復元（JSON形式）に完全対応。

## 🛠 技術スタック

- **Frontend**: React 19, Vite, Tailwind CSS, Framer Motion, Lucide React
- **Backend**: Express, Node.js (tsx)
- **Database**: SQLite (better-sqlite3)
- **AI**: Google Gemini API (`gemini-2.0-flash-exp` 推奨)
- **Language**: TypeScript

## 🚀 セットアップ

### 前提条件
- Node.js (v18以上推奨)
- Google Gemini APIキー

### インストール

1. リポジトリをクローン:
   ```bash
   git clone https://github.com/your-username/zero-knowledge-vault.git
   cd zero-knowledge-vault
   ```

2. 依存関係のインストール:
   ```bash
   npm install
   ```

3. 環境変数の設定:
   `.env.example` を `.env` にコピーし、あなたのGemini APIキーを設定してください。
   ```bash
   GEMINI_API_KEY=your_api_key_here
   ```

4. アプリケーションの起動:
   ```bash
   npm run dev
   ```
   ブラウザで `http://localhost:3000` を開きます。

## 📝 使い方

1. **新規作成**: タイトルと隠したいパスワードを入力し、何か「対象（テーマ）」を1つ強く思い浮かべます。
2. **封印**: ランプのお姉さんが出す20の質問に答えます。
3. **解読**: 再び同じ対象を思い浮かべ、同じように質問に答えることでパスワードが姿を現します。

## 📄 ライセンス

このプロジェクトは MITライセンス の下で公開されています。

