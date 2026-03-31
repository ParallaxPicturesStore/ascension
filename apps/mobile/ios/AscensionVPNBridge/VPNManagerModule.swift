import Foundation
import NetworkExtension

/// React Native native module that manages the VPN tunnel lifecycle
/// and reads blocked-attempt logs from the shared App Group container.
@objc(VPNManagerModule)
class VPNManagerModule: NSObject {

    private var tunnelManager: NETunnelProviderManager?

    // MARK: - Module Setup

    @objc static func requiresMainQueueSetup() -> Bool {
        return false
    }

    // MARK: - VPN Control

    /// Load or create the tunnel provider manager configuration.
    private func loadManager(completion: @escaping (NETunnelProviderManager?, Error?) -> Void) {
        NETunnelProviderManager.loadAllFromPreferences { [weak self] managers, error in
            if let error = error {
                completion(nil, error)
                return
            }

            if let existing = managers?.first {
                self?.tunnelManager = existing
                completion(existing, nil)
            } else {
                let manager = NETunnelProviderManager()
                let proto = NETunnelProviderProtocol()
                proto.providerBundleIdentifier = "app.getascension.mobile.vpn"
                proto.serverAddress = "Ascension DNS Filter"
                manager.protocolConfiguration = proto
                manager.localizedDescription = "Ascension"
                manager.isEnabled = true

                manager.saveToPreferences { error in
                    if let error = error {
                        completion(nil, error)
                        return
                    }
                    // Reload after save to get the updated reference
                    manager.loadFromPreferences { error in
                        self?.tunnelManager = manager
                        completion(manager, error)
                    }
                }
            }
        }
    }

    /// Start the VPN tunnel. Resolves true on success, false on failure.
    @objc func startVPN(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        loadManager { manager, error in
            if let error = error {
                reject("VPN_LOAD_ERROR", "Failed to load VPN configuration", error)
                return
            }

            guard let manager = manager else {
                reject("VPN_LOAD_ERROR", "No VPN manager available", nil)
                return
            }

            do {
                try manager.connection.startVPNTunnel()
                resolve(true)
            } catch {
                reject("VPN_START_ERROR", "Failed to start VPN tunnel", error)
            }
        }
    }

    /// Stop the VPN tunnel.
    @objc func stopVPN(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        loadManager { manager, error in
            if let error = error {
                reject("VPN_LOAD_ERROR", "Failed to load VPN configuration", error)
                return
            }

            manager?.connection.stopVPNTunnel()
            resolve(nil)
        }
    }

    /// Get the current VPN connection status.
    @objc func getVPNStatus(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        loadManager { manager, error in
            if let error = error {
                reject("VPN_LOAD_ERROR", "Failed to load VPN configuration", error)
                return
            }

            guard let manager = manager else {
                resolve("disconnected")
                return
            }

            switch manager.connection.status {
            case .connected:
                resolve("connected")
            case .connecting, .reasserting:
                resolve("connecting")
            case .disconnected, .invalid:
                resolve("disconnected")
            case .disconnecting:
                resolve("disconnected")
            @unknown default:
                resolve("error")
            }
        }
    }

    /// Get the total number of blocked attempts.
    @objc func getBlockedCount(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let count = BlocklistManager.shared.getBlockedCount()
        resolve(count)
    }

    /// Get recent blocked attempts as an array of { domain, timestamp }.
    @objc func getRecentBlocked(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let entries = BlocklistManager.shared.getRecentBlocked()
        let mapped = entries.map { entry -> [String: Any] in
            return [
                "domain": entry["domain"] as? String ?? "",
                "timestamp": entry["timestamp"] as? Double ?? 0,
            ]
        }
        resolve(mapped)
    }
}
