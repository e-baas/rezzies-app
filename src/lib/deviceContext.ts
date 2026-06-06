import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';

export interface DeviceContext {
  device_model: string | null;
  os_platform: string;
  os_version: string;
  app_version: string | null;
  app_build: string | null;
}

/**
 * Snapshot the running device + app version. All fields are best-effort —
 * `expo-device` returns null on web and on some simulators.
 */
export function getDeviceContext(): DeviceContext {
  return {
    device_model: Device.modelName ?? Device.deviceName ?? null,
    os_platform: Platform.OS,
    os_version: String(Platform.Version ?? Device.osVersion ?? ''),
    app_version: Application.nativeApplicationVersion ?? null,
    app_build: Application.nativeBuildVersion ?? null,
  };
}
