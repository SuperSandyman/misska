# misska

CLI client for Misskey.

## Install

```bash
npx misska
```

## Usage

```bash
misska login https://misskey.io
misska account
misska use 2
misska
```

`misska login` はアカウントを追加保存し、最後にログインしたアカウントをアクティブにします。保存済みアカウントは `misska account` で確認でき、起動前は `misska use <number|account>`、起動後は `/account` で一覧を開いて `j/k` と Enter で切り替えできます。`/accounts` と `misska accounts` は互換エイリアスとして残しています。

初回実装の範囲は「複数保持 + 明示切替」です。複数インスタンスのタイムライン同時表示や削除コマンドは未対応です。

## Release automation

- Pull request では GitHub Actions で `lint` / `build` / `test` を自動実行します。
- `v1.2.3` のようなバージョンタグを push すると、GitHub Release を自動作成します。
- 同じタグ push で npm publish も自動実行します。

npm publish には GitHub Actions の secret として `NPM_TOKEN` の設定が必要です。タグ名のバージョンと `package.json` の `version` が一致しない場合は release を失敗させます。
