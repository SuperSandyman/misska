# misska

CLI client for Misskey.

## Install

```bash
npx misska
```

## Usage

```bash
misska login https://misskey.io
misska accounts
misska use @alice@misskey.io
misska
```

`misska login` はアカウントを追加保存し、最後にログインしたアカウントをアクティブにします。保存済みアカウントは `misska accounts` で確認でき、起動前は `misska use <account>`、起動後は `/accounts` と `/use <account>` で切り替えできます。

初回実装の範囲は「複数保持 + 明示切替」です。複数インスタンスのタイムライン同時表示や削除コマンドは未対応です。
