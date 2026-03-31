import { NativeModules, Platform } from 'react-native';

export type VPNStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface BlockedEntry {
  domain: string;
  timestamp: number;
}

interface VPNManagerNative {
  startVPN(): Promise<boolean>;
  stopVPN(): Promise<void>;
  getVPNStatus(): Promise<VPNStatus>;
  getBlockedCount(): Promise<number>;
  getRecentBlocked(): Promise<BlockedEntry[]>;
}

/**
 * VPNManager - React Native interface to the iOS VPN DNS filter.
 *
 * On iOS, this bridges to the native VPNManagerModule which controls
 * the NEPacketTunnelProvider-based DNS filter.
 *
 * On Android, these methods are no-ops since Android uses a different
 * approach (screen capture + accessibility).
 */
class VPNManager {
  private native: VPNManagerNative | null;

  constructor() {
    if (Platform.OS === 'ios' && NativeModules.VPNManagerModule) {
      this.native = NativeModules.VPNManagerModule as VPNManagerNative;
    } else {
      this.native = null;
    }
  }

  /** Returns true if VPN-based DNS filtering is available on this platform. */
  get isAvailable(): boolean {
    return this.native !== null;
  }

  /** Start the VPN DNS filter. Returns true on success. */
  async startVPN(): Promise<boolean> {
    if (!this.native) return false;
    try {
      return await this.native.startVPN();
    } catch (error) {
      console.error('[VPNManager] Failed to start VPN:', error);
      return false;
    }
  }

  /** Stop the VPN DNS filter. */
  async stopVPN(): Promise<void> {
    if (!this.native) return;
    try {
      await this.native.stopVPN();
    } catch (error) {
      console.error('[VPNManager] Failed to stop VPN:', error);
    }
  }

  /** Get the current VPN connection status. */
  async getVPNStatus(): Promise<VPNStatus> {
    if (!this.native) return 'disconnected';
    try {
      return await this.native.getVPNStatus();
    } catch {
      return 'error';
    }
  }

  /** Get the total number of blocked domain attempts. */
  async getBlockedCount(): Promise<number> {
    if (!this.native) return 0;
    try {
      return await this.native.getBlockedCount();
    } catch {
      return 0;
    }
  }

  /** Get recent blocked attempts (last 100), newest last. */
  async getRecentBlocked(): Promise<BlockedEntry[]> {
    if (!this.native) return [];
    try {
      return await this.native.getRecentBlocked();
    } catch {
      return [];
    }
  }
}

/** Singleton instance for app-wide use. */
export const vpnManager = new VPNManager();
