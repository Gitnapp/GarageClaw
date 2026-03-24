import type { DetailedHTMLProps, HTMLAttributes } from 'react';

/**
 * Electron API Type Declarations
 * Types for the APIs exposed via contextBridge
 */

export interface IpcRenderer {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  on(channel: string, callback: (...args: unknown[]) => void): (() => void) | void;
  once(channel: string, callback: (...args: unknown[]) => void): void;
  off(channel: string, callback?: (...args: unknown[]) => void): void;
}

export interface ElectronAPI {
  ipcRenderer: IpcRenderer;
  openExternal: (url: string) => Promise<void>;
  platform: NodeJS.Platform;
  isDev: boolean;
}

export interface ElectronWebviewElement extends HTMLElement {
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  goBack: () => void;
  goForward: () => void;
  loadURL: (url: string) => void;
  reload: () => void;
  stop: () => void;
  getURL: () => string;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: DetailedHTMLProps<HTMLAttributes<ElectronWebviewElement>, ElectronWebviewElement> & {
        allowpopups?: string;
        partition?: string;
        src?: string;
        webpreferences?: string;
      };
    }
  }
}

export {};
