// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "BrainSpark",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(name: "BrainSpark", path: "Sources/BrainSpark"),
    ],
    swiftLanguageModes: [.v5]
)
