# Project-AirVia 実装計画書

## 1. 概要
Windowsの標準機能（PowerShell / WinRT テザリングAPIおよびnetsh）を活用し、インターネット回線不要でローカルWi-Fiネットワークを立ち上げ、参加者の端末（スマートフォン・PC）からアクセスできるWebポータルおよび各種Webアプリケーション（写真共有、ビンゴ等）をホストするプラットフォーム「Project-AirVia」を新規作成する。

## 2. システム構成
- **ランタイム**: Node.js
- **主要ライブラリ**:
  - `express`: Webサーバー・ルーティング
  - `multer`: 写真共有用の画像アップロード
  - `qrcode`: Wi-Fi接続用およびポータルアクセス用QRコードの生成
- **モジュール構成**:
  - `src/core/hotspot.js`: ホットスポットの起動・停止・Wi-Fiプロファイル管理
  - `src/core/network.js`: ホットスポットIPの自動検出、接続用QRコード生成
  - `src/server.js`: メインExpressサーバー、ポータル・管理API・アプリルーティング
  - `public/admin/`: 親機PC用ダッシュボード（Wi-Fi状態、QRコード、接続数、アプリ管理）
  - `public/portal/`: 参加者端末用ポータル画面（各アプリへのランチャー）
  - `apps/photos/`: 写真共有アプリ（アップロード、一覧表示、ダウンロード）
  - `apps/bingo/`: 既存BINGOアプリの取り込み

## 3. 実装手順
1. **初期セットアップ**:
   - `package.json` の作成と必要なnpmパッケージのインストール
2. **コア機能の実装**:
   - `hotspot.js`: BINGOから抽出したWinRT PowerShell呼び出しをモジュール化。SSIDやパスワードを動的に設定可能にする。
   - `network.js`: ホットスポットIP (`192.168.137.1` 等) の検出と、Wi-Fi接続用QR (`WIFI:S:SSID;T:WPA;P:password;;`) およびURL用QRコードの画像生成。
3. **サーバーとポータル機能の実装**:
   - Expressサーバーを起動し、親機向け管理画面 (`/admin`) と参加者向けポータル (`/`) を配信。
4. **お役立ちアプリの実装**:
   - 写真共有機能 (`/apps/photos`): 画像アップロード（`multer`）、サムネイル・写真一覧API、ZIPダウンロード機能。
   - BINGOアプリの移植 (`/apps/bingo`): 従来のビンゴ機能をAirViaのアプリとしてマウント。
5. **起動環境の整備**:
   - Windows用起動バッチ `start.bat` （文字化け防止のため英語で記述）。
6. **検証・ドキュメント作成**:
   - サーバー起動、ホットスポット制御、QRコード生成、写真共有、ビンゴの動作確認を行い、`walkthrough.md` を作成する。

