// React types are imported directly from the react package
// No custom module declaration needed

declare module "*.png" {
  const value: number;
  export default value;
}

declare module "*.jpg" {
  const value: number;
  export default value;
}

declare module "*.jpeg" {
  const value: number;
  export default value;
}

declare module "*.svg" {
  const value: number;
  export default value;
}

declare module 'expo-clipboard' {
  export function setStringAsync(text: string): Promise<void>;
  export function getStringAsync(): Promise<string>;
  export function hasStringAsync(): Promise<boolean>;
  export function getString(): string | null;
  export function setString(text: string): void;
  export function addClipboardListener(listener: (event: { content: string }) => void): { remove(): void };
  export function removeClipboardListener(listener: (event: { content: string }) => void): void;
  export function hasString(): boolean;
  export function getInitialString(): string | null;
  export function setInitialString(text: string): void;
  export function clearString(): void;
  export function getClipboardString(): string | null;
  export function setClipboardString(text: string): void;
  
  const Clipboard: any;
  export default Clipboard;
}
