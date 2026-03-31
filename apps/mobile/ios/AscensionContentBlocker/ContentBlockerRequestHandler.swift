import UIKit
import MobileCoreServices

/// Safari Content Blocker extension that loads the bundled blockerList.json
/// containing rules to block adult content domains in Safari.
class ContentBlockerRequestHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        guard let attachment = NSItemProvider(
            contentsOf: Bundle.main.url(forResource: "blockerList", withExtension: "json")
        ) else {
            context.cancelRequest(withError: NSError(
                domain: "app.getascension.contentblocker",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Could not load blockerList.json"]
            ))
            return
        }

        let item = NSExtensionItem()
        item.attachments = [attachment]
        context.completeRequest(returningItems: [item], completionHandler: nil)
    }
}
