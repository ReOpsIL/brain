import AppKit
import ServiceManagement
import WebKit

/// Menu bar shell: a status item, a drop-down panel and a web view that runs the game in Resources/web.
@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate {
    static let version = "1.0.0"
    static let baseSize = NSSize(width: 480, height: 700)

    private let defaults = UserDefaults.standard
    private var statusItem: NSStatusItem?
    private var panel: GamePanel!
    private var webView: GameWebView!

    /// Size the player asked for (1, 1.15 or 1.3). The size actually used may be smaller to fit the screen.
    private var requestedScale: CGFloat = 1
    private var pageReady = false
    private var pendingScripts: [String] = []
    private var dragStart: (mouse: NSPoint, origin: NSPoint)?
    /// Debugging aids: `--js "<script>"` runs a script once the game has loaded, `--snapshot out.png` then saves a picture and quits.
    private var debugScript: String?
    private var snapshotPath: String?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let args = CommandLine.arguments
        // e.g. BrainSpark --snapshot out.png --js "BS.nav.play('sudoku', 150)"
        if let i = args.firstIndex(of: "--js"), i + 1 < args.count { debugScript = args[i + 1] }
        if let i = args.firstIndex(of: "--snapshot"), i + 1 < args.count { snapshotPath = args[i + 1] }
        if let s = defaults.object(forKey: "scale") as? Double { requestedScale = CGFloat(min(max(s, 1), 1.3)) }

        let frame = NSRect(origin: .zero, size: Self.baseSize)
        let container = RoundedContainer(frame: frame, radius: 16, color: NSColor(red: 0.06, green: 0.23, blue: 0.21, alpha: 1))
        webView = makeWebView(frame: frame)
        container.addSubview(webView)
        panel = GamePanel(contentView: container)
        loadGame()

        if snapshotPath != nil {
            panel.setFrameOrigin(NSPoint(x: -5000, y: -5000))
            panel.orderFrontRegardless()
            return
        }

        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = item.button {
            let image = NSImage(systemSymbolName: "puzzlepiece.extension.fill", accessibilityDescription: "Brain Spark")
            image?.isTemplate = true
            button.image = image
            button.toolTip = "Brain Spark: click to play, right-click for options"
            button.target = self
            button.action = #selector(statusItemClicked(_:))
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        }
        statusItem = item

        // Open the game by itself the first time, so a new player sees where it lives.
        let firstLaunch = !defaults.bool(forKey: "launchedBefore")
        defaults.set(true, forKey: "launchedBefore")
        if firstLaunch || args.contains("--show") {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { self.showPanel() }
        }
    }

    // MARK: Web view

    private func makeWebView(frame: NSRect) -> GameWebView {
        let content = WKUserContentController()
        content.add(self, name: "bs")
        // Saved progress is handed to the page before any of its scripts run.
        let boot = "window.BS_NATIVE = {state: \(loadStateJSON() ?? "null"), login: \(loginEnabled), version: \"\(Self.version)\"};"
        content.addUserScript(WKUserScript(source: boot, injectionTime: .atDocumentStart, forMainFrameOnly: true))

        let config = WKWebViewConfiguration()
        config.userContentController = content
        config.websiteDataStore = .nonPersistent()
        config.mediaTypesRequiringUserActionForPlayback = []

        let view = GameWebView(frame: frame, configuration: config)
        view.autoresizingMask = [.width, .height]
        view.navigationDelegate = self
        view.allowsMagnification = false
        view.allowsBackForwardNavigationGestures = false
        view.setValue(false, forKey: "drawsBackground")
        return view
    }

    /// The folder holding index.html: inside the app bundle, or the source tree when run with `swift run`.
    private var webDirectory: URL? {
        let fm = FileManager.default
        var candidates: [URL] = []
        if let resources = Bundle.main.resourceURL { candidates.append(resources.appendingPathComponent("web")) }
        candidates.append(URL(fileURLWithPath: fm.currentDirectoryPath).appendingPathComponent("Resources/web"))
        return candidates.first { fm.fileExists(atPath: $0.appendingPathComponent("index.html").path) }
    }

    private func loadGame() {
        guard let dir = webDirectory else {
            webView.loadHTMLString("<body style='background:#0F3B36;color:#F6EEDC;font:18px -apple-system;padding:40px'>Brain Spark could not find its game files. Please reinstall the app.</body>", baseURL: nil)
            return
        }
        webView.loadFileURL(dir.appendingPathComponent("index.html"), allowingReadAccessTo: dir)
    }

    private func run(_ script: String) {
        if pageReady { webView.evaluateJavaScript(script, completionHandler: nil) } else { pendingScripts.append(script) }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        pageReady = true
        pendingScripts.forEach { webView.evaluateJavaScript($0, completionHandler: nil) }
        pendingScripts = []
        if debugScript != nil || snapshotPath != nil { runDebugSteps() }
    }

    /// The game is fully local: never follow a link anywhere else.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
        let url = navigationAction.request.url
        decisionHandler(url?.isFileURL == true || url?.scheme == "about" ? .allow : .cancel)
    }

    // MARK: Messages from the game

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "save":
            if let state = body["state"] as? String { saveState(state) }
        case "close":
            closePanel()
        case "quit":
            NSApp.terminate(nil)
        case "dragStart":
            dragStart = (NSEvent.mouseLocation, panel.frame.origin)
        case "drag":
            guard let s = dragStart else { return }
            let mouse = NSEvent.mouseLocation
            panel.setFrameOrigin(NSPoint(x: s.origin.x + mouse.x - s.mouse.x, y: s.origin.y + mouse.y - s.mouse.y))
        case "dragEnd":
            guard dragStart != nil else { return }
            dragStart = nil
            defaults.set(panel.frame.minX, forKey: "panel.left")
            defaults.set(panel.frame.maxY, forKey: "panel.top")
        case "scale":
            if let value = (body["value"] as? NSNumber)?.doubleValue { setScale(CGFloat(value)) }
        case "loginItem":
            if let on = body["on"] as? Bool { setLoginItem(on) }
        default:
            break
        }
    }

    // MARK: Saved state

    private var stateURL: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("BrainSpark/state.json")
    }

    /// The saved state as JSON text that is safe to paste into a script, or nil if there is none (or it is damaged).
    private func loadStateJSON() -> String? {
        guard let data = try? Data(contentsOf: stateURL), data.count < 2_000_000 else { return nil }
        return Self.cleanJSON(data)
    }

    /// Parses and re-encodes JSON so only a well-formed object ever reaches the page or the disk.
    private static func cleanJSON(_ data: Data) -> String? {
        guard let object = try? JSONSerialization.jsonObject(with: data), object is [String: Any],
              let clean = try? JSONSerialization.data(withJSONObject: object),
              let text = String(data: clean, encoding: .utf8) else { return nil }
        // Legal in JSON but line breaks to older JavaScript parsers.
        return text.replacingOccurrences(of: "\u{2028}", with: "\\u2028").replacingOccurrences(of: "\u{2029}", with: "\\u2029")
    }

    private func saveState(_ json: String) {
        guard snapshotPath == nil, json.utf8.count < 2_000_000, let clean = Self.cleanJSON(Data(json.utf8)) else { return }
        do {
            try FileManager.default.createDirectory(at: stateURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try Data(clean.utf8).write(to: stateURL, options: .atomic)
        } catch {
            NSLog("Brain Spark: could not save progress: \(error.localizedDescription)")
        }
    }

    // MARK: Status item

    @objc private func statusItemClicked(_ sender: NSStatusBarButton) {
        let event = NSApp.currentEvent
        if event?.type == .rightMouseUp || event?.modifierFlags.contains(.control) == true {
            showMenu()
        } else if panel.isVisible {
            closePanel()
        } else {
            showPanel()
        }
    }

    private func showMenu() {
        guard let statusItem else { return }
        let menu = NSMenu()
        menu.addItem(withTitle: "Open Brain Spark", action: #selector(menuOpen), keyEquivalent: "").target = self
        menu.addItem(withTitle: "Today\u{2019}s Five", action: #selector(menuDaily), keyEquivalent: "").target = self
        menu.addItem(.separator())
        if savedTopLeft != nil {
            menu.addItem(withTitle: "Move Back Under Icon", action: #selector(menuResetPosition), keyEquivalent: "").target = self
        }
        let login = NSMenuItem(title: "Open at Login", action: #selector(menuLogin), keyEquivalent: "")
        login.target = self
        login.state = loginEnabled ? .on : .off
        menu.addItem(login)
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit Brain Spark", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        statusItem.menu = menu
        statusItem.button?.performClick(nil)
        statusItem.menu = nil
    }

    @objc private func menuOpen() { showPanel() }
    @objc private func menuDaily() { showPanel(script: "BS.openDaily()") }
    @objc private func menuResetPosition() { resetPosition() }
    @objc private func menuLogin() { setLoginItem(!loginEnabled) }

    // MARK: Panel

    /// Shows the panel. `script` tells the game what to do as it appears (by default, deal Today's five again).
    func showPanel(script: String = "BS.onShow()") {
        NSApp.activate(ignoringOtherApps: true)
        if !panel.isVisible {
            placePanel()
            panel.alphaValue = 0
            panel.orderFrontRegardless()
            NSAnimationContext.runAnimationGroup({ ctx in
                ctx.duration = 0.16
                panel.animator().alphaValue = 1
            }, completionHandler: { [weak self] in
                Task { @MainActor in self?.panel.alphaValue = 1 }
            })
        }
        run("window.BS && \(script)")
        panel.makeKey()
        panel.makeFirstResponder(webView)
    }

    func closePanel() {
        guard panel.isVisible else { return }
        NSAnimationContext.runAnimationGroup({ ctx in
            ctx.duration = 0.12
            panel.animator().alphaValue = 0
        }, completionHandler: { [weak self] in
            Task { @MainActor in self?.panel.orderOut(nil) }
        })
    }

    // MARK: Position and size

    private var iconAnchor: NSRect? {
        guard let button = statusItem?.button, let w = button.window else { return nil }
        return w.convertToScreen(button.convert(button.bounds, to: nil))
    }

    /// Top-left corner the player dragged the panel to, if it is still on a connected screen.
    private var savedTopLeft: NSPoint? {
        guard defaults.object(forKey: "panel.left") != nil else { return nil }
        let p = NSPoint(x: defaults.double(forKey: "panel.left"), y: defaults.double(forKey: "panel.top"))
        let probe = NSPoint(x: p.x + 40, y: p.y - 20)
        return NSScreen.screens.contains { $0.visibleFrame.contains(probe) } ? p : nil
    }

    private func screen(containing point: NSPoint) -> NSScreen? {
        NSScreen.screens.first { $0.frame.contains(point) } ?? NSScreen.main
    }

    /// Sets the page zoom for `screen` (never larger than fits) and returns the matching panel size.
    private func fitScale(to screen: NSScreen?) -> NSSize {
        var scale = requestedScale
        if let visible = screen?.visibleFrame {
            let fit = min((visible.width - 16) / Self.baseSize.width, (visible.height - 12) / Self.baseSize.height)
            scale = max(0.6, min(scale, fit))
        }
        webView.pageZoom = scale
        return NSSize(width: (Self.baseSize.width * scale).rounded(), height: (Self.baseSize.height * scale).rounded())
    }

    private func placePanel() {
        let saved = savedTopLeft, anchor = iconAnchor
        let probe = saved.map { NSPoint(x: $0.x + 40, y: $0.y - 20) } ?? anchor.map { NSPoint(x: $0.midX, y: $0.minY - 20) }
        let screen = probe.flatMap { self.screen(containing: $0) } ?? NSScreen.main
        let size = fitScale(to: screen)
        var frame: NSRect
        if let p = saved {
            frame = NSRect(x: p.x, y: p.y - size.height, width: size.width, height: size.height)
        } else if let anchor {
            frame = panel.frameBelow(anchor, size: size)
        } else {
            let visible = screen?.visibleFrame ?? .zero
            frame = NSRect(x: visible.midX - size.width / 2, y: visible.maxY - size.height - 6, width: size.width, height: size.height)
        }
        frame = GamePanel.clamp(frame, to: screen)
        panel.setFrame(frame, display: true)
        panel.invalidateShadow()
    }

    private func setScale(_ value: CGFloat) {
        guard snapshotPath == nil else { return }
        requestedScale = min(max(value, 1), 1.3)
        defaults.set(Double(requestedScale), forKey: "scale")
        // Resize around the top-left corner, then make sure the panel is still fully on screen.
        let screen = panel.isVisible ? panel.screen : self.screen(containing: NSPoint(x: panel.frame.midX, y: panel.frame.midY))
        let size = fitScale(to: screen)
        guard size != panel.frame.size else { return }
        let frame = NSRect(x: panel.frame.minX, y: panel.frame.maxY - size.height, width: size.width, height: size.height)
        panel.setFrame(GamePanel.clamp(frame, to: screen), display: true)
        panel.invalidateShadow()
    }

    private func resetPosition() {
        defaults.removeObject(forKey: "panel.left")
        defaults.removeObject(forKey: "panel.top")
        guard panel.isVisible, let anchor = iconAnchor else { return }
        let target = GamePanel.clamp(panel.frameBelow(anchor, size: panel.frame.size), to: screen(containing: NSPoint(x: anchor.midX, y: anchor.minY - 20)))
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.2
            panel.animator().setFrame(target, display: true)
        }
    }

    // MARK: Open at login

    private var loginEnabled: Bool { SMAppService.mainApp.status == .enabled }

    private func setLoginItem(_ on: Bool) {
        do {
            if on { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
        } catch {
            NSLog("Brain Spark: could not change the login item: \(error.localizedDescription)")
        }
        run("window.BS && BS.setLogin(\(loginEnabled))")
    }

    // MARK: Debugging

    private func runDebugSteps() {
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(1.6))
            if let debugScript {
                _ = try? await webView.evaluateJavaScript(debugScript)
                try? await Task.sleep(for: .seconds(2.2))
            }
            guard let snapshotPath else { return }
            let config = WKSnapshotConfiguration()
            config.afterScreenUpdates = true
            if let image = try? await webView.takeSnapshot(configuration: config), let tiff = image.tiffRepresentation,
               let png = NSBitmapImageRep(data: tiff)?.representation(using: .png, properties: [:]) {
                try? png.write(to: URL(fileURLWithPath: snapshotPath))
                print("snapshot: \(snapshotPath)")
            } else {
                print("snapshot failed")
            }
            NSApp.terminate(nil)
        }
    }
}
