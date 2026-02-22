/**
 * Convert raw PCM buffer to WAV buffer.
 * @param {Buffer} pcmBuffer
 * @param {number} sampleRate
 * @param {number} numChannels
 * @param {number} bitsPerSample
 * @returns {Buffer} WAV audio buffer
 */
function pcmToWav(
  pcmBuffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16,
) {
  const headerLength = 44;
  const dataLength = pcmBuffer.length;
  const buffer = Buffer.alloc(headerLength + dataLength);

  // RIFF identifier
  buffer.write("RIFF", 0);
  // File length
  buffer.writeUInt32LE(36 + dataLength, 4);
  // RIFF type
  buffer.write("WAVE", 8);
  // Format chunk identifier
  buffer.write("fmt ", 12);
  // Format chunk length
  buffer.writeUInt32LE(16, 16);
  // Sample format (1 is PCM)
  buffer.writeUInt16LE(1, 20);
  // Channels
  buffer.writeUInt16LE(numChannels, 22);
  // Sample rate
  buffer.writeUInt32LE(sampleRate, 24);
  // Byte rate
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  // Block align
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  // Bits per sample
  buffer.writeUInt16LE(bitsPerSample, 34);
  // Data chunk identifier
  buffer.write("data", 36);
  // Data chunk length
  buffer.writeUInt32LE(dataLength, 40);

  // Copy PCM data
  pcmBuffer.copy(buffer, 44);

  return buffer;
}

module.exports = { pcmToWav };
