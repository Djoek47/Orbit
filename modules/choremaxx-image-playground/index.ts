/**
 * Apple Image Playground, as a local Expo module (see ios/ChoremaxxImagePlayground.podspec
 * for why it isn't the npm package). Null when the native side isn't in this build.
 */
import { requireOptionalNativeModule } from 'expo';

export type PlaygroundStyleName = 'animation' | 'illustration' | 'sketch' | 'all';

export type PlaygroundLaunchParams = {
  concepts?: { text?: string[]; title?: string; content?: string };
  /** https URL or an absolute file path / file:// URI. */
  sourceUri?: string;
  allowedStyles?: PlaygroundStyleName[];
  selectedStyle?: PlaygroundStyleName;
  personalizationPolicy?: 'automatic' | 'enabled' | 'disabled';
};

export type PlaygroundNativeStatus = {
  linked: boolean;
  /** iOS 18.2 or later. */
  osSupported: boolean;
  /** Apple Intelligence on, models ready, language and region supported. */
  available: boolean;
};

type NativeModule = {
  isSupported(): boolean;
  status(): PlaygroundNativeStatus;
  /** Local file path of the created image, or null if the person cancelled. */
  launchAsync(params?: PlaygroundLaunchParams): Promise<string | null>;
};

export const ImagePlaygroundNative = requireOptionalNativeModule<NativeModule>('ChoremaxxImagePlayground');
