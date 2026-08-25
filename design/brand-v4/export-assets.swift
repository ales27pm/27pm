#!/usr/bin/env swift

import CoreGraphics
import CoreText
import Foundation
import ImageIO
import UniformTypeIdentifiers

private struct RGBAImage {
    let width: Int
    let height: Int
    var pixels: [UInt8]

    init(width: Int, height: Int, fill: RGBA = .transparent) {
        self.width = width
        self.height = height
        self.pixels = [UInt8](repeating: 0, count: width * height * 4)

        if fill != .transparent {
            let premultiplied = fill.premultiplied
            for index in stride(from: 0, to: pixels.count, by: 4) {
                pixels[index] = premultiplied.red
                pixels[index + 1] = premultiplied.green
                pixels[index + 2] = premultiplied.blue
                pixels[index + 3] = premultiplied.alpha
            }
        }
    }
}

private struct RGBA: Equatable {
    let red: UInt8
    let green: UInt8
    let blue: UInt8
    let alpha: UInt8

    static let transparent = RGBA(red: 0, green: 0, blue: 0, alpha: 0)

    var premultiplied: RGBA {
        guard alpha < 255 else { return self }
        let scale = Int(alpha)
        return RGBA(
            red: UInt8((Int(red) * scale + 127) / 255),
            green: UInt8((Int(green) * scale + 127) / 255),
            blue: UInt8((Int(blue) * scale + 127) / 255),
            alpha: alpha
        )
    }
}

private enum Brand {
    static let ivory = RGBA(red: 0xF4, green: 0xF0, blue: 0xE7, alpha: 255)
    static let carbon = RGBA(red: 0x17, green: 0x17, blue: 0x14, alpha: 255)
    static let cobalt = RGBA(red: 0x28, green: 0x46, blue: 0xB8, alpha: 255)
    static let sourceKey = RGBA(red: 0xFC, green: 0xF8, blue: 0xF3, alpha: 255)
}

private enum ExportError: Error, CustomStringConvertible {
    case invalidArguments(String)
    case missingSource(URL)
    case unreadableImage(URL)
    case unexpectedSourceSize(width: Int, height: Int)
    case contextCreationFailed
    case imageCreationFailed
    case outputCreationFailed(URL)
    case outputFinalizationFailed(URL)
    case invalidCrop
    case missingWebPEncoder
    case webPEncodingFailed(String)

    var description: String {
        switch self {
        case .invalidArguments(let message):
            return message
        case .missingSource(let url):
            return "Source image not found: \(url.path)"
        case .unreadableImage(let url):
            return "Could not decode image: \(url.path)"
        case .unexpectedSourceSize(let width, let height):
            return "Expected a 1254 x 1254 source, got \(width) x \(height)."
        case .contextCreationFailed:
            return "Could not create an sRGB bitmap context."
        case .imageCreationFailed:
            return "Could not create a CGImage from the pixel buffer."
        case .outputCreationFailed(let url):
            return "Could not create output: \(url.path)"
        case .outputFinalizationFailed(let url):
            return "Could not finalize output: \(url.path)"
        case .invalidCrop:
            return "Requested crop is outside the source image."
        case .missingWebPEncoder:
            return "cwebp is required at /usr/local/bin/cwebp."
        case .webPEncodingFailed(let message):
            return "cwebp failed: \(message)"
        }
    }
}

private let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
private let premultipliedLast = CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue)

private func repositoryRoot() throws -> URL {
    let arguments = Array(CommandLine.arguments.dropFirst())
    if arguments.isEmpty {
        return URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true)
    }
    guard arguments.count == 2, arguments[0] == "--root" else {
        throw ExportError.invalidArguments("Usage: xcrun swift design/brand-v4/export-assets.swift [--root /path/to/repository]")
    }
    return URL(fileURLWithPath: arguments[1], isDirectory: true).standardizedFileURL
}

private func loadPNG(at url: URL) throws -> RGBAImage {
    guard FileManager.default.fileExists(atPath: url.path) else {
        throw ExportError.missingSource(url)
    }
    guard
        let source = CGImageSourceCreateWithURL(url as CFURL, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, [
            kCGImageSourceShouldCache: true,
            kCGImageSourceShouldAllowFloat: false,
        ] as CFDictionary)
    else {
        throw ExportError.unreadableImage(url)
    }

    var output = RGBAImage(width: image.width, height: image.height)
    let drewImage = output.pixels.withUnsafeMutableBytes { bytes -> Bool in
        guard let context = CGContext(
            data: bytes.baseAddress,
            width: image.width,
            height: image.height,
            bitsPerComponent: 8,
            bytesPerRow: image.width * 4,
            space: colorSpace,
            bitmapInfo: premultipliedLast.rawValue
        ) else {
            return false
        }
        context.setBlendMode(.copy)
        context.interpolationQuality = .none
        context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        return true
    }
    guard drewImage else { throw ExportError.contextCreationFailed }
    return output
}

private func cgImage(from image: RGBAImage, interpolate: Bool = true) throws -> CGImage {
    let data = Data(image.pixels) as CFData
    guard let provider = CGDataProvider(data: data) else {
        throw ExportError.imageCreationFailed
    }
    guard let result = CGImage(
        width: image.width,
        height: image.height,
        bitsPerComponent: 8,
        bitsPerPixel: 32,
        bytesPerRow: image.width * 4,
        space: colorSpace,
        bitmapInfo: premultipliedLast,
        provider: provider,
        decode: nil,
        shouldInterpolate: interpolate,
        intent: .defaultIntent
    ) else {
        throw ExportError.imageCreationFailed
    }
    return result
}

private func opaqueCGImage(from image: RGBAImage) throws -> CGImage {
    var rgb = [UInt8](repeating: 0, count: image.width * image.height * 3)
    for pixel in 0 ..< image.width * image.height {
        rgb[pixel * 3] = image.pixels[pixel * 4]
        rgb[pixel * 3 + 1] = image.pixels[pixel * 4 + 1]
        rgb[pixel * 3 + 2] = image.pixels[pixel * 4 + 2]
    }
    guard let provider = CGDataProvider(data: Data(rgb) as CFData) else {
        throw ExportError.imageCreationFailed
    }
    guard let result = CGImage(
        width: image.width,
        height: image.height,
        bitsPerComponent: 8,
        bitsPerPixel: 24,
        bytesPerRow: image.width * 3,
        space: colorSpace,
        bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.none.rawValue),
        provider: provider,
        decode: nil,
        shouldInterpolate: true,
        intent: .defaultIntent
    ) else {
        throw ExportError.imageCreationFailed
    }
    return result
}

private func writePNG(_ image: RGBAImage, to url: URL, opaque: Bool = false) throws {
    try FileManager.default.createDirectory(
        at: url.deletingLastPathComponent(),
        withIntermediateDirectories: true
    )
    guard let destination = CGImageDestinationCreateWithURL(
        url as CFURL,
        UTType.png.identifier as CFString,
        1,
        nil
    ) else {
        throw ExportError.outputCreationFailed(url)
    }

    let properties = [
        kCGImagePropertyPNGDictionary: [
            kCGImagePropertyPNGsRGBIntent: 0,
        ],
    ] as CFDictionary
    let outputImage = try opaque ? opaqueCGImage(from: image) : cgImage(from: image)
    CGImageDestinationAddImage(destination, outputImage, properties)
    guard CGImageDestinationFinalize(destination) else {
        throw ExportError.outputFinalizationFailed(url)
    }
}

private func transparentMaster(from source: RGBAImage) -> RGBAImage {
    let transparentDistance = 8
    let opaqueDistance = 215
    let distanceRange = opaqueDistance - transparentDistance
    var output = RGBAImage(width: source.width, height: source.height)

    for index in stride(from: 0, to: source.pixels.count, by: 4) {
        let red = Int(source.pixels[index])
        let green = Int(source.pixels[index + 1])
        let blue = Int(source.pixels[index + 2])
        let distance = max(
            abs(red - Int(Brand.sourceKey.red)),
            abs(green - Int(Brand.sourceKey.green)),
            abs(blue - Int(Brand.sourceKey.blue))
        )

        var alpha: Int
        if distance <= transparentDistance {
            alpha = 0
        } else if distance >= opaqueDistance {
            alpha = 255
        } else {
            alpha = ((distance - transparentDistance) * 255 + distanceRange / 2) / distanceRange
        }
        if alpha <= 4 {
            alpha = 0
        } else if alpha >= 250 {
            alpha = 255
        }

        if alpha == 0 {
            continue
        }
        output.pixels[index] = UInt8((Int(Brand.carbon.red) * alpha + 127) / 255)
        output.pixels[index + 1] = UInt8((Int(Brand.carbon.green) * alpha + 127) / 255)
        output.pixels[index + 2] = UInt8((Int(Brand.carbon.blue) * alpha + 127) / 255)
        output.pixels[index + 3] = UInt8(alpha)
    }
    return output
}

private func crop(_ source: RGBAImage, x: Int, y: Int, width: Int, height: Int) throws -> RGBAImage {
    guard x >= 0, y >= 0, width > 0, height > 0, x + width <= source.width, y + height <= source.height else {
        throw ExportError.invalidCrop
    }
    var output = RGBAImage(width: width, height: height)
    let sourceRowBytes = source.width * 4
    let outputRowBytes = width * 4
    for row in 0 ..< height {
        let sourceStart = (y + row) * sourceRowBytes + x * 4
        let outputStart = row * outputRowBytes
        output.pixels.replaceSubrange(
            outputStart ..< outputStart + outputRowBytes,
            with: source.pixels[sourceStart ..< sourceStart + outputRowBytes]
        )
    }
    return output
}

private func resized(_ source: RGBAImage, width: Int, height: Int) throws -> RGBAImage {
    var output = RGBAImage(width: width, height: height)
    let sourceImage = try cgImage(from: source)
    let rendered = output.pixels.withUnsafeMutableBytes { bytes -> Bool in
        guard let context = CGContext(
            data: bytes.baseAddress,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: colorSpace,
            bitmapInfo: premultipliedLast.rawValue
        ) else {
            return false
        }
        context.setBlendMode(.copy)
        context.interpolationQuality = .high
        context.draw(sourceImage, in: CGRect(x: 0, y: 0, width: width, height: height))
        return true
    }
    guard rendered else { throw ExportError.contextCreationFailed }
    return output
}

private func opticallyEroded(_ source: RGBAImage, radius: Int = 1) -> RGBAImage {
    guard radius > 0 else { return source }
    var output = RGBAImage(width: source.width, height: source.height)

    for y in 0 ..< source.height {
        for x in 0 ..< source.width {
            var alpha = 255
            for sampleY in max(0, y - radius) ... min(source.height - 1, y + radius) {
                for sampleX in max(0, x - radius) ... min(source.width - 1, x + radius) {
                    alpha = min(alpha, Int(source.pixels[(sampleY * source.width + sampleX) * 4 + 3]))
                }
            }
            let index = (y * source.width + x) * 4
            output.pixels[index] = UInt8((Int(Brand.ivory.red) * alpha + 127) / 255)
            output.pixels[index + 1] = UInt8((Int(Brand.ivory.green) * alpha + 127) / 255)
            output.pixels[index + 2] = UInt8((Int(Brand.ivory.blue) * alpha + 127) / 255)
            output.pixels[index + 3] = UInt8(alpha)
        }
    }
    return output
}

private func composited(_ mark: RGBAImage, foreground: RGBA, background: RGBA) -> RGBAImage {
    var output = RGBAImage(width: mark.width, height: mark.height, fill: background)
    for index in stride(from: 0, to: mark.pixels.count, by: 4) {
        let alpha = Int(mark.pixels[index + 3])
        let inverse = 255 - alpha
        output.pixels[index] = UInt8((Int(foreground.red) * alpha + Int(background.red) * inverse + 127) / 255)
        output.pixels[index + 1] = UInt8((Int(foreground.green) * alpha + Int(background.green) * inverse + 127) / 255)
        output.pixels[index + 2] = UInt8((Int(foreground.blue) * alpha + Int(background.blue) * inverse + 127) / 255)
        output.pixels[index + 3] = 255
    }
    return output
}

private func tinted(_ mark: RGBAImage, color: RGBA) -> RGBAImage {
    var output = RGBAImage(width: mark.width, height: mark.height)
    for index in stride(from: 0, to: mark.pixels.count, by: 4) {
        let alpha = Int(mark.pixels[index + 3])
        output.pixels[index] = UInt8((Int(color.red) * alpha + 127) / 255)
        output.pixels[index + 1] = UInt8((Int(color.green) * alpha + 127) / 255)
        output.pixels[index + 2] = UInt8((Int(color.blue) * alpha + 127) / 255)
        output.pixels[index + 3] = UInt8(alpha)
    }
    return output
}

private func drawMark(
    _ mark: RGBAImage,
    in context: CGContext,
    rect: CGRect,
    foreground: RGBA
) throws {
    let markImage = try cgImage(from: tinted(mark, color: foreground))
    context.saveGState()
    context.interpolationQuality = .high
    context.setBlendMode(.normal)
    context.draw(markImage, in: rect)
    context.restoreGState()
}

private func canvas(width: Int, height: Int, background: RGBA, drawing: (CGContext) throws -> Void) throws -> RGBAImage {
    var output = RGBAImage(width: width, height: height, fill: background)
    let rendered = try output.pixels.withUnsafeMutableBytes { bytes -> Bool in
        guard let context = CGContext(
            data: bytes.baseAddress,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: colorSpace,
            bitmapInfo: premultipliedLast.rawValue
        ) else {
            return false
        }
        try drawing(context)
        return true
    }
    guard rendered else { throw ExportError.contextCreationFailed }
    return output
}

private func setFill(_ color: RGBA, in context: CGContext) {
    context.setFillColor(
        red: CGFloat(color.red) / 255,
        green: CGFloat(color.green) / 255,
        blue: CGFloat(color.blue) / 255,
        alpha: CGFloat(color.alpha) / 255
    )
}

private func drawText(
    _ string: String,
    in context: CGContext,
    x: CGFloat,
    baseline: CGFloat,
    size: CGFloat,
    weight: CFString,
    color: RGBA,
    tracking: CGFloat = 0
) {
    let font = CTFontCreateWithName(weight, size, nil)
    let attributes: [NSAttributedString.Key: Any] = [
        NSAttributedString.Key(kCTFontAttributeName as String): font,
        NSAttributedString.Key(kCTForegroundColorAttributeName as String): CGColor(
            colorSpace: colorSpace,
            components: [
                CGFloat(color.red) / 255,
                CGFloat(color.green) / 255,
                CGFloat(color.blue) / 255,
                CGFloat(color.alpha) / 255,
            ]
        )!,
        NSAttributedString.Key(kCTKernAttributeName as String): tracking,
    ]
    let line = CTLineCreateWithAttributedString(NSAttributedString(string: string, attributes: attributes))
    context.textPosition = CGPoint(x: x, y: baseline)
    CTLineDraw(line, context)
}

private func socialSquare(mark: RGBAImage) throws -> RGBAImage {
    try canvas(width: 1254, height: 1254, background: Brand.cobalt) { context in
        setFill(Brand.carbon, in: context)
        context.fill(CGRect(x: 0, y: 0, width: 1254, height: 28))
        try drawMark(
            mark,
            in: context,
            rect: CGRect(x: 0, y: 0, width: 1254, height: 1254),
            foreground: Brand.ivory
        )
    }
}

private func openGraph(mark: RGBAImage) throws -> RGBAImage {
    try canvas(width: 1200, height: 630, background: Brand.ivory) { context in
        setFill(Brand.cobalt, in: context)
        context.fill(CGRect(x: 0, y: 0, width: 430, height: 630))

        let paddedMark = try crop(mark, x: 77, y: 77, width: 1100, height: 1100)
        try drawMark(
            paddedMark,
            in: context,
            rect: CGRect(x: 36, y: 74, width: 358, height: 482),
            foreground: Brand.ivory
        )

        setFill(Brand.cobalt, in: context)
        context.fill(CGRect(x: 505, y: 433, width: 72, height: 8))

        context.saveGState()
        context.textMatrix = .identity
        drawText(
            "27PM",
            in: context,
            x: 505,
            baseline: 316,
            size: 136,
            weight: "HelveticaNeue-Bold" as CFString,
            color: Brand.carbon,
            tracking: -4
        )
        drawText(
            "Sites web + applications",
            in: context,
            x: 509,
            baseline: 244,
            size: 31,
            weight: "HelveticaNeue-Medium" as CFString,
            color: Brand.carbon,
            tracking: -0.3
        )
        drawText(
            "sur mesure.",
            in: context,
            x: 509,
            baseline: 202,
            size: 31,
            weight: "HelveticaNeue-Medium" as CFString,
            color: Brand.carbon,
            tracking: -0.3
        )
        context.restoreGState()
    }
}

private func encodeWebP(input: URL, output: URL) throws {
    let encoder = URL(fileURLWithPath: "/usr/local/bin/cwebp")
    guard FileManager.default.isExecutableFile(atPath: encoder.path) else {
        throw ExportError.missingWebPEncoder
    }
    let process = Process()
    process.executableURL = encoder
    process.arguments = [
        "-preset", "icon",
        "-lossless",
        "-z", "9",
        "-alpha_q", "100",
        "-exact",
        input.path,
        "-o", output.path,
    ]
    let errorPipe = Pipe()
    process.standardOutput = Pipe()
    process.standardError = errorPipe
    try process.run()
    process.waitUntilExit()
    guard process.terminationStatus == 0 else {
        let message = String(data: errorPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? "unknown error"
        throw ExportError.webPEncodingFailed(message)
    }
}

private func writeManifest(to url: URL, startURL: String, iconPrefix: String) throws {
    let manifest = """
    {
      "name": "27PM",
      "short_name": "27PM",
      "description": "Sites web et applications sur mesure.",
      "start_url": "\(startURL)",
      "display": "standalone",
      "background_color": "#F4F0E7",
      "theme_color": "#2846B8",
      "icons": [
        {
          "src": "\(iconPrefix)icon-192.png",
          "sizes": "192x192",
          "type": "image/png",
          "purpose": "any"
        },
        {
          "src": "\(iconPrefix)icon-512.png",
          "sizes": "512x512",
          "type": "image/png",
          "purpose": "any"
        },
        {
          "src": "\(iconPrefix)icon-maskable-512.png",
          "sizes": "512x512",
          "type": "image/png",
          "purpose": "maskable"
        }
      ]
    }

    """
    try FileManager.default.createDirectory(
        at: url.deletingLastPathComponent(),
        withIntermediateDirectories: true
    )
    try manifest.write(to: url, atomically: true, encoding: .utf8)
}

private func atomicCopy(from source: URL, to destination: URL) throws {
    let data = try Data(contentsOf: source)
    try FileManager.default.createDirectory(
        at: destination.deletingLastPathComponent(),
        withIntermediateDirectories: true
    )
    try data.write(to: destination, options: .atomic)
}

private func archiveIfNeeded(source: URL, destination: URL) throws {
    guard
        FileManager.default.fileExists(atPath: source.path),
        !FileManager.default.fileExists(atPath: destination.path)
    else {
        return
    }
    try atomicCopy(from: source, to: destination)
}

private func exportAssets() throws {
    let root = try repositoryRoot()
    let sourceURL = root.appendingPathComponent("design/brand-v4/source/27pm-selected-mark.png")
    let masterDirectory = root.appendingPathComponent("design/brand-v4/master", isDirectory: true)
    let publicDirectory = root.appendingPathComponent("public/assets/brand-v4", isDirectory: true)

    let source = try loadPNG(at: sourceURL)
    guard source.width == 1254, source.height == 1254 else {
        throw ExportError.unexpectedSourceSize(width: source.width, height: source.height)
    }

    let master = transparentMaster(from: source)
    let masterURL = masterDirectory.appendingPathComponent("27pm-mark-transparent-1254.png")
    try writePNG(master, to: masterURL)

    let normalCrop = try crop(master, x: 115, y: 115, width: 1024, height: 1024)
    let runtimeMarkURL = publicDirectory.appendingPathComponent("27pm-mark-1024.png")
    try writePNG(normalCrop, to: runtimeMarkURL)

    let faviconMask = opticallyEroded(try resized(normalCrop, width: 64, height: 64))
    try writePNG(
        composited(faviconMask, foreground: Brand.ivory, background: Brand.cobalt),
        to: publicDirectory.appendingPathComponent("favicon-64.png"),
        opaque: true
    )

    let safeCrop = try crop(master, x: 77, y: 77, width: 1100, height: 1100)
    for size in [180, 192, 512] {
        let icon = try resized(safeCrop, width: size, height: size)
        let filename = size == 180 ? "apple-touch-icon-180.png" : "icon-\(size).png"
        try writePNG(
            composited(icon, foreground: Brand.ivory, background: Brand.cobalt),
            to: publicDirectory.appendingPathComponent(filename),
            opaque: true
        )
    }

    let maskable = try resized(master, width: 512, height: 512)
    try writePNG(
        composited(maskable, foreground: Brand.ivory, background: Brand.cobalt),
        to: publicDirectory.appendingPathComponent("icon-maskable-512.png"),
        opaque: true
    )
    let manifestURL = publicDirectory.appendingPathComponent("site.webmanifest")
    try writeManifest(to: manifestURL, startURL: "../../", iconPrefix: "")

    let socialURL = publicDirectory.appendingPathComponent("social-27pm-square-1254.png")
    try writePNG(try socialSquare(mark: master), to: socialURL, opaque: true)

    let openGraphURL = publicDirectory.appendingPathComponent("og-27pm-1200x630.png")
    try writePNG(try openGraph(mark: master), to: openGraphURL, opaque: true)

    let runtimeMarkWebPURL = publicDirectory.appendingPathComponent("27pm-mark-1024.webp")
    try encodeWebP(
        input: runtimeMarkURL,
        output: runtimeMarkWebPURL
    )
    try encodeWebP(
        input: socialURL,
        output: publicDirectory.appendingPathComponent("social-27pm-square-1254.webp")
    )

    // Keep the descriptive aliases generated during the asset-development pass.
    try atomicCopy(
        from: runtimeMarkURL,
        to: publicDirectory.appendingPathComponent("27pm-mark-transparent-1024.png")
    )
    try atomicCopy(
        from: runtimeMarkWebPURL,
        to: publicDirectory.appendingPathComponent("27pm-mark-transparent-1024.webp")
    )

    // Preserve the pre-v4 canonical files once, then cut over each public path atomically.
    let legacyDirectory = root.appendingPathComponent("public/assets/legacy-v3", isDirectory: true)
    let cutovers: [(versioned: URL, canonical: URL, legacy: URL)] = [
        (
            publicDirectory.appendingPathComponent("favicon-64.png"),
            root.appendingPathComponent("public/favicon-64.png"),
            legacyDirectory.appendingPathComponent("favicon-64.png")
        ),
        (
            publicDirectory.appendingPathComponent("apple-touch-icon-180.png"),
            root.appendingPathComponent("public/apple-touch-icon.png"),
            legacyDirectory.appendingPathComponent("apple-touch-icon.png")
        ),
        (
            publicDirectory.appendingPathComponent("icon-512.png"),
            root.appendingPathComponent("public/icon-512.png"),
            legacyDirectory.appendingPathComponent("icon-512.png")
        ),
        (
            openGraphURL,
            root.appendingPathComponent("public/assets/og-27pm-1200x630.png"),
            legacyDirectory.appendingPathComponent("og-27pm-1200x630.png")
        ),
    ]
    for cutover in cutovers {
        try archiveIfNeeded(source: cutover.canonical, destination: cutover.legacy)
        try atomicCopy(from: cutover.versioned, to: cutover.canonical)
    }

    let rootManifestURL = root.appendingPathComponent("public/site.webmanifest")
    try archiveIfNeeded(
        source: rootManifestURL,
        destination: legacyDirectory.appendingPathComponent("site.webmanifest")
    )
    try writeManifest(
        to: rootManifestURL,
        startURL: ".",
        iconPrefix: "assets/brand-v4/"
    )

    print("Exported 27PM v4 assets from \(sourceURL.path)")
}

do {
    try exportAssets()
} catch {
    fputs("error: \(error)\n", stderr)
    exit(1)
}
