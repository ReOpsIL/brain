// Renders the app icon (an ivory tile with a brass spark on green felt) into an .iconset directory.
import AppKit
let out = CommandLine.arguments[1]
try? FileManager.default.createDirectory(atPath: out, withIntermediateDirectories: true)
func rgb(_ hex: Int) -> NSColor {
    NSColor(red: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: 1)
}
for (name, px) in [("16x16",16),("16x16@2x",32),("32x32",32),("32x32@2x",64),("128x128",128),("128x128@2x",256),("256x256",256),("256x256@2x",512),("512x512",512),("512x512@2x",1024)] {
    let s = CGFloat(px)
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)

    // Felt background.
    let inset = s * 0.1
    let rect = NSRect(x: inset, y: inset, width: s - 2 * inset, height: s - 2 * inset)
    let felt = NSBezierPath(roundedRect: rect, xRadius: s * 0.18, yRadius: s * 0.18)
    NSGradient(starting: rgb(0x1C5B52), ending: rgb(0x0F3B36))!.draw(in: felt, angle: -90)

    // Ivory tile, slightly turned, with a darker lower edge.
    let ctx = NSGraphicsContext.current!.cgContext
    ctx.saveGState()
    ctx.translateBy(x: s / 2, y: s / 2)
    ctx.rotate(by: -0.14)
    let side = s * 0.5
    let shadow = NSShadow()
    shadow.shadowBlurRadius = s * 0.04
    shadow.shadowOffset = NSSize(width: 0, height: -s * 0.02)
    shadow.shadowColor = NSColor(white: 0, alpha: 0.45)
    shadow.set()
    rgb(0xD9CBAA).setFill()
    NSBezierPath(roundedRect: NSRect(x: -side / 2, y: -side / 2 - s * 0.03, width: side, height: side), xRadius: s * 0.07, yRadius: s * 0.07).fill()
    NSShadow().set()
    rgb(0xF6EEDC).setFill()
    NSBezierPath(roundedRect: NSRect(x: -side / 2, y: -side / 2, width: side, height: side), xRadius: s * 0.07, yRadius: s * 0.07).fill()

    // Brass four-point spark.
    let r = side * 0.38, w = r * 0.26
    let spark = NSBezierPath()
    spark.move(to: NSPoint(x: 0, y: r))
    for (x, y) in [(w, w), (r, 0), (w, -w), (0, -r), (-w, -w), (-r, 0), (-w, w)] as [(CGFloat, CGFloat)] { spark.line(to: NSPoint(x: x, y: y)) }
    spark.close()
    rgb(0xE2B04A).setFill()
    spark.fill()
    rgb(0x9A6F1F).setStroke()
    spark.lineWidth = max(0.5, s * 0.008)
    spark.lineJoinStyle = .round
    spark.stroke()
    ctx.restoreGState()

    NSGraphicsContext.restoreGraphicsState()
    try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(out)/icon_\(name).png"))
}
