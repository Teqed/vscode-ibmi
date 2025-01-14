import vscode from "vscode";
import { getFilePermission } from "./qsys/QSysFs";
import { instance } from "../instantiate";

export class IFSFS implements vscode.FileSystemProvider {
  private emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this.emitter.event;

  watch(uri: vscode.Uri, options: { readonly recursive: boolean; readonly excludes: readonly string[]; }): vscode.Disposable {
    return { dispose: () => { } };
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const contentApi = instance.getContent();
    if (contentApi) {
      const fileContent = await contentApi.downloadStreamfile(uri.path);
      return new Uint8Array(Buffer.from(fileContent, `utf8`));
    }
    else {
      throw new Error("Not connected to IBM i");
    }
  }

  stat(uri: vscode.Uri): vscode.FileStat {
    return {
      ctime: 0,
      mtime: 0,
      size: 0,
      type: vscode.FileType.File,
      permissions: getFilePermission(uri)
    }
  }

  async writeFile(uri: vscode.Uri, content: Uint8Array, options: { readonly create: boolean; readonly overwrite: boolean; }) {
    const contentApi = instance.getContent();
    if (contentApi) {
      contentApi.writeStreamfile(uri.path, content);
    }
    else {
      throw new Error("Not connected to IBM i");
    }
  }

  rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { readonly overwrite: boolean; }): void | Thenable<void> {
    console.log({ oldUri, newUri, options });
  }

  readDirectory(uri: vscode.Uri): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
    throw new Error(`readDirectory not implemented in IFSFS.`);
  }

  createDirectory(uri: vscode.Uri): void | Thenable<void> {
    throw new Error(`createDirectory not implemented in IFSFS.`);
  }

  delete(uri: vscode.Uri, options: { readonly recursive: boolean; }): void | Thenable<void> {
    throw new Error(`delete not implemented in IFSFS.`);
  }
}