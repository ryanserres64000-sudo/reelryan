import AVFoundation
import ExpoModulesCore

// Decodes MP3, M4A, AAC and WAV with AVAudioFile (the real content, not the extension), mixed down to mono
// Float32 at the analysis rate. The tempo and beats are then found in JS (core/music.ts), the same code
// as the tests. Not compiled yet: it needs Xcode on Ryan's Mac (lot 2, native part).
public class MadaAudioModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MadaAudio")

    AsyncFunction("decodeMono") { (uri: URL, rate: Double) throws -> [String: Any] in
      let file = try AVAudioFile(forReading: uri)
      let input = file.processingFormat
      let duration = Double(file.length) / input.sampleRate
      guard duration > 0, duration <= 600 else { throw UnreadableSound() }
      guard let output = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: rate, channels: 1, interleaved: false),
            let converter = AVAudioConverter(from: input, to: output),
            let chunk = AVAudioPCMBuffer(pcmFormat: input, frameCapacity: 8192) else { throw UnreadableSound() }
      converter.downmix = true

      var data = Data(capacity: Int(duration * rate) * 4 + 4096)
      var ended = false
      let outCapacity = AVAudioFrameCount(Double(chunk.frameCapacity) * rate / input.sampleRate) + 1024
      while true {
        guard let out = AVAudioPCMBuffer(pcmFormat: output, frameCapacity: outCapacity) else { throw UnreadableSound() }
        var error: NSError?
        let status = converter.convert(to: out, error: &error) { _, inputStatus in
          if ended { inputStatus.pointee = .endOfStream; return nil }
          do { try file.read(into: chunk) } catch { ended = true }
          if ended || chunk.frameLength == 0 { ended = true; inputStatus.pointee = .endOfStream; return nil }
          inputStatus.pointee = .haveData
          return chunk
        }
        if let error { throw error }
        if out.frameLength > 0, let channel = out.floatChannelData?[0] {
          data.append(UnsafeBufferPointer(start: channel, count: Int(out.frameLength)))
        }
        if status == .endOfStream || status == .error || (ended && out.frameLength == 0) { break }
      }
      return ["samples": data, "rate": rate, "duration": duration]
    }
  }
}

struct UnreadableSound: Error {}
