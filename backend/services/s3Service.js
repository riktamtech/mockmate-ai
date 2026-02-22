const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");

// Initialize S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "mockmate-interviews";
const FOLDER_PREFIX = "mockmate/";

/**
 * Upload audio file to S3
 * @param {Buffer} fileBuffer - The audio file buffer
 * @param {string} mimeType - MIME type of the audio (e.g., 'audio/webm', 'audio/mp4')
 * @param {string} interviewId - The interview ID for organizing files
 * @param {string|number} questionIndex - Question number/index for the recording
 * @returns {Promise<{key: string, url: string}>} - S3 key and signed URL
 */
const uploadAudio = async (
  fileBuffer,
  mimeType,
  interviewId,
  questionIndex,
) => {
  const extension = getExtensionFromMime(mimeType);
  const key = `${FOLDER_PREFIX}interviews/${interviewId}/audio_q${questionIndex}_${uuidv4()}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
    Metadata: {
      interviewId: String(interviewId),
      questionIndex: String(questionIndex),
      uploadedAt: new Date().toISOString(),
    },
  });

  await s3Client.send(command);

  return { key };
};

// ─── Get Signed URL (On-Demand) ──────────────────────────────────────
/**
 * Generate a fresh signed URL for an existing S3 object.
 * @param {string} key - The S3 object key
 * @param {number} expiresIn - URL expiration in seconds (default 1 hour)
 * @returns {Promise<string>}
 */
const getAudioUrl = async (key, expiresIn = 3600) => {
  if (!key) return null;

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
};

/**
 * Delete audio file from S3
 * @param {string} key - The S3 object key
 */
const deleteAudio = async (key) => {
  if (!key) return;

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
};

/**
 * Upload a generic file to S3 with a custom key
 * @param {Buffer} fileBuffer - The file buffer
 * @param {string} key - The S3 object key (full path)
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<string>} - The S3 object URL (not signed)
 */
const uploadFile = async (fileBuffer, key, contentType) => {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
    Metadata: {
      uploadedAt: new Date().toISOString(),
    },
  });

  await s3Client.send(command);

  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${key}`;
};

/**
 * Upload user response audio and return metadata
 * @param {Buffer} fileBuffer - Audio buffer
 * @param {string} mimeType - MIME type
 * @param {string} interviewId - Interview ID
 * @param {number} questionIndex - Question number
 * @param {number} durationSeconds - Recording duration
 * @returns {Promise<Object>} - Audio recording metadata
 */
const uploadResponseAudio = async (
  fileBuffer,
  mimeType,
  interviewId,
  questionIndex,
  durationSeconds = 0,
) => {
  const { key } = await uploadAudio(
    fileBuffer,
    mimeType,
    interviewId,
    questionIndex,
  );

  return {
    s3Key: key,
    mimeType,
    questionIndex,
    durationSeconds,
    uploadedAt: new Date(),
  };
};

// ─── AI Response Audio Upload ────────────────────────────────────────
/**
 * Upload AI-generated audio to S3 (stored under mockmate/ai_responses/).
 * Returns only s3Key — signed URLs generated on demand.
 * @param {Buffer} fileBuffer - Audio buffer
 * @param {string} interviewId - Interview ID
 * @param {number|string} questionIndex - Index or sequence number
 * @param {string} mimeType - MIME type of the audio (default: "audio/mp3")
 * @returns {Promise<{s3Key: string}>}
 */
const uploadAIResponseAudio = async (
  fileBuffer,
  interviewId,
  questionIndex,
  mimeType = "audio/mp3",
  customKey = null,
) => {
  let key;

  if (customKey) {
    key = customKey;
  } else {
    const extension = getExtensionFromMime(mimeType);
    const fileName = `ai_response_${questionIndex}_${uuidv4()}.${extension}`;
    key = `${FOLDER_PREFIX}ai_responses/${interviewId}/${fileName}`;
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
    Metadata: {
      interviewId: String(interviewId),
      type: "ai_response",
      uploadedAt: new Date().toISOString(),
    },
  });

  await s3Client.send(command);

  return { s3Key: key };
};

// ─── Stream Audio to HTTP Response ───────────────────────────────────
/**
 * Pipe an S3 audio object directly to an Express response (proxy streaming).
 * @param {string} key - The S3 object key
 * @param {import('express').Response} res - Express response object
 */
const streamAudioToResponse = async (key, res) => {
  if (!key) {
    res.status(404).json({ message: "No audio key provided" });
    return;
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const s3Response = await s3Client.send(command);

  // Set headers for audio streaming
  if (s3Response.ContentType) {
    res.setHeader("Content-Type", s3Response.ContentType);
  }
  if (s3Response.ContentLength) {
    res.setHeader("Content-Length", s3Response.ContentLength);
  }
  res.setHeader("Accept-Ranges", "bytes");

  // Pipe the S3 stream directly to the response
  s3Response.Body.pipe(res);
};

// ─── Helpers ─────────────────────────────────────────────────────────
/**
 * Derive file extension from MIME type.
 * @param {string} mimeType
 * @returns {string}
 */
const getExtensionFromMime = (mimeType) => {
  const mimeMap = {
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/mp4": "mp4",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
  };
  return mimeMap[mimeType] || "webm";
};

// ─── Get Audio Buffer (For Backend Processing) ───────────────────────
/**
 * Download S3 object as a buffer.
 * @param {string} key - The S3 object key
 * @returns {Promise<Buffer>}
 */
const getAudioBuffer = async (key) => {
  if (!key) return null;

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);

  // Convert stream to buffer
  const streamToBuffer = (stream) =>
    new Promise((resolve, reject) => {
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks)));
    });

  return streamToBuffer(response.Body);
};

// ─── Exports ─────────────────────────────────────────────────────────
module.exports = {
  uploadAudio,
  uploadFile,
  getAudioUrl,
  getAudioBuffer,
  deleteAudio,
  uploadResponseAudio,
  uploadAIResponseAudio,
  streamAudioToResponse,
  getExtensionFromMime,
  BUCKET_NAME,
  FOLDER_PREFIX,
};
