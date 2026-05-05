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
  storeCredentials(userId: string, supabaseUrl: string, userAccessToken: string, supabaseAnonKey: string): Promise<boolean>;
}

interface AndroidVpnNative {
  startVPNWithDomains(domains: string[]): Promise<boolean>;
  stopVPN(): Promise<void>;
  updateBlocklist(domains: string[]): Promise<void>;
  getVPNStatus(): Promise<VPNStatus>;
  getBlockedCount(): Promise<number>;
  getRecentBlocked(): Promise<BlockedEntry[]>;
}

/**
 * Domain blocklist shared by both iOS and Android VPN modules.
 * Matches the set in iOS BlocklistManager.swift.
 */
export const DEFAULT_BLOCKLIST: readonly string[] = [
  '3movs.com', '4chan.org', '4tube.com', '8kun.top', 'admireme.vip',
  'adultfriendfinder.com', 'adulttime.com', 'alohatube.com', 'alt.com',
  'anyporn.com', 'ashemaletube.com', 'ashleymadison.com', 'babes.com',
  'bangbros.com', 'bangbus.com', 'beeg.com', 'bellesa.co', 'blacked.com',
  'bongacams.com', 'boyfriendtv.com', 'brazzers.com', 'cam4.com',
  'camonster.com', 'camsoda.com', 'camster.com', 'camversity.com',
  'chaturbate.com', 'cliphunter.com', 'clips4sale.com', 'coomer.su',
  'daftsex.com', 'danbooru.donmai.us', 'deeper.com', 'digitalplayground.com',
  'drtuber.com', 'e-hentai.org', 'empflix.com', 'eporner.com', 'erome.com',
  'eros.com', 'eroshare.com', 'fakehub.com', 'fakku.net', 'fancentro.com',
  'fansly.com', 'fapster.xxx', 'fetlife.com', 'findtubes.com',
  'flirt4free.com', 'freeones.com', 'fuq.com', 'gelbooru.com', 'gotporn.com',
  'hanime.tv', 'hclips.com', 'hdporn.net', 'hentaihaven.xxx', 'hitomi.la',
  'hqporner.com', 'hustler.com', 'iafd.com', 'imagefap.com', 'imlive.com',
  'indexxx.com', 'iwantclips.com', 'jerkmate.com', 'justfor.fans',
  'kemono.su', 'kink.com', 'listcrawler.com', 'literotica.com',
  'livejasmin.com', 'loyalfans.com', 'manyvids.com', 'metart.com',
  'mofos.com', 'motherless.com', 'myfreecams.com', 'naughtyamerica.com',
  'nhentai.net', 'nudevista.com', 'nuvid.com', 'onlyfans.com',
  'passion-hd.com', 'penthouse.com', 'perfectgirls.net', 'playvids.com',
  'porn.com', 'porn300.com', 'porndig.com', 'porndish.com', 'porndude.com',
  'porngo.com', 'pornhd.com', 'pornhub.com', 'pornmd.com', 'pornone.com',
  'pornpics.com', 'pornpros.com', 'porntrex.com', 'porntube.com',
  'pornzog.com', 'puremature.com', 'rabbits.cam', 'realitykings.com',
  'redtube.com', 'rule34.paheal.net', 'rule34.xxx', 'sankakucomplex.com',
  'scrolller.com', 'seeking.com', 'sex.com', 'sexart.com',
  'silverdaddies.com', 'skipthegames.com', 'slutload.com', 'spankbang.com',
  'streamate.com', 'stripchat.com', 'sunporno.com', 'sxyprn.com',
  'teamskeet.com', 'thumbzilla.com', 'tnaflix.com', 'trannytube.tv',
  'tryst.link', 'tsumino.com', 'tube8.com', 'tubegalore.com', 'tushy.com',
  'twistys.com', 'txxx.com', 'vixen.com', 'vjav.com', 'voyeurhit.com',
  'wicked.com', 'xcams.com', 'xgroovy.com', 'xhamster.com',
  'xmoviesforyou.com', 'xnxx.com', 'xtube.com', 'xvideos.com',
  'xxxbunker.com', 'youjizz.com', 'youporn.com', 'zbporn.com',
];

/**
 * VPNManager — unified React Native interface to the native VPN DNS filter.
 *
 * iOS:  bridges to VPNManagerModule (NEPacketTunnelProvider).
 * Android: bridges to AndroidVpnModule (VpnService local DNS filter).
 *
 * Both platforms intercept DNS at the OS level, so the filter works in
 * incognito tabs, private browsers, and any other app on the device.
 */
class VPNManager {
  private ios: VPNManagerNative | null;
  private android: AndroidVpnNative | null;

  constructor() {
    if (Platform.OS === 'ios' && NativeModules.VPNManagerModule) {
      this.ios = NativeModules.VPNManagerModule as VPNManagerNative;
      this.android = null;
    } else if (Platform.OS === 'android' && NativeModules.AndroidVpnModule) {
      this.android = NativeModules.AndroidVpnModule as AndroidVpnNative;
      this.ios = null;
    } else {
      this.ios = null;
      this.android = null;
    }
  }

  /** True if VPN-based DNS filtering is available on this platform. */
  get isAvailable(): boolean {
    return this.ios !== null || this.android !== null;
  }

  /**
   * Start the VPN DNS filter.
   * On Android, automatically applies DEFAULT_BLOCKLIST.
   * Returns true on success.
   */
  async startVPN(blocklist: string[] = [...DEFAULT_BLOCKLIST]): Promise<boolean> {
    try {
      if (this.ios) {
        return await this.ios.startVPN();
      }
      if (this.android) {
        return await this.android.startVPNWithDomains(blocklist);
      }
    } catch (error) {
      console.error('[VPNManager] Failed to start VPN:', error);
    }
    return false;
  }

  /** Stop the VPN DNS filter. */
  async stopVPN(): Promise<void> {
    try {
      if (this.ios) await this.ios.stopVPN();
      if (this.android) await this.android.stopVPN();
    } catch (error) {
      console.error('[VPNManager] Failed to stop VPN:', error);
    }
  }

  /**
   * Replace the active blocklist without restarting the VPN tunnel.
   * Android only — iOS blocklist is baked into the network extension bundle.
   */
  async updateBlocklist(domains: string[]): Promise<void> {
    try {
      if (this.android) await this.android.updateBlocklist(domains);
    } catch (error) {
      console.error('[VPNManager] Failed to update blocklist:', error);
    }
  }

  /** Current VPN connection status. */
  async getVPNStatus(): Promise<VPNStatus> {
    try {
      if (this.ios) return await this.ios.getVPNStatus();
      if (this.android) return await this.android.getVPNStatus();
    } catch {
      return 'error';
    }
    return 'disconnected';
  }

  /** Total number of blocked domain attempts. */
  async getBlockedCount(): Promise<number> {
    try {
      if (this.ios) return await this.ios.getBlockedCount();
      if (this.android) return await this.android.getBlockedCount();
    } catch {
      return 0;
    }
    return 0;
  }

  /** Recent blocked attempts (last 100), newest last. */
  async getRecentBlocked(): Promise<BlockedEntry[]> {
    try {
      if (this.ios) return await this.ios.getRecentBlocked();
      if (this.android) return await this.android.getRecentBlocked();
    } catch {
      return [];
    }
    return [];
  }

  /**
   * Persist auth credentials in the shared App Group so the iOS VPN extension
   * can call Supabase directly to fire partner alerts when the app is closed.
   * No-op on Android.
   */
  async storeCredentials(
    userId: string,
    supabaseUrl: string,
    userAccessToken: string,
    supabaseAnonKey: string,
  ): Promise<void> {
    try {
      if (this.ios) {
        await this.ios.storeCredentials(userId, supabaseUrl, userAccessToken, supabaseAnonKey);
      }
    } catch (error) {
      console.error('[VPNManager] Failed to store credentials:', error);
    }
  }
}

/** Singleton instance for app-wide use. */
export const vpnManager = new VPNManager();
