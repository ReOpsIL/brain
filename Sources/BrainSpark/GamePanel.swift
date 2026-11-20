import AppKit
import WebKit

/// Borderless, rounded, shadowed panel that drops down from the menu-bar icon.
final class GamePanel: NSPanel {
    init(contentView view: NSView) {
        super.init(contentRect: view.frame,
                   styleMask: [.borderless, .nonactivatingPanel],
                   backing: .buffered, defer: false)
        isFloatingPanel = true
        level = .statusBar
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .transient]
        backgroundColor = .clear
        isOpaque = false
        hasShadow = true
        hidesOnDeactivate = false
        isReleasedWhenClosed = false
        appearance = NSAppearance(named: .darkAqua)
        contentView = view
    }

    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }

    /// Frame of `size` just below `anchor` (a screen rect, e.g. the menu-bar icon).
    func frameBelow(_ anchor: NSRect, size: NSSize) -> NSRect {
        NSRect(x: anchor.midX - size.width / 2, y: anchor.minY - 6 - size.height, width: size.width, height: size.height)
    }

    /// `frame` nudged so the whole panel stays inside the screen's visible area.
    static func clamp(_ frame: NSRect, to screen: NSScreen?) -> NSRect {
        guard let visible = screen?.visibleFrame else { return frame }
        var f = frame
        f.origin.x = max(visible.minX + 8, min(f.minX, visible.maxX - f.width - 8))
        f.origin.y = max(visible.minY + 6, min(f.minY, visible.maxY - f.height))
        return f
    }
}

/// The web view that draws the whole game.
final class GameWebView: WKWebView {
    /// Let the first click act (press a tile, drag the header) even when another app is active.
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}

/// Layer-backed container that clips the web view to rounded corners.
final class RoundedContainer: NSView {
    init(frame: NSRect, radius: CGFloat, color: NSColor) {
        super.init(frame: frame)
        wantsLayer = true
        layer?.cornerRadius = radius
        layer?.cornerCurve = .continuous
        layer?.masksToBounds = true
        layer?.backgroundColor = color.cgColor
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("not used") }
}
