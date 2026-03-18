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
