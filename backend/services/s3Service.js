const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');

// Initialize S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'mockmate-interviews';
const FOLDER_PREFIX = 'mockmate/';

/**
 * Upload audio file to S3
 * @param {Buffer} fileBuffer - The audio file buffer
 * @param {string} mimeType - MIME type of the audio (e.g., 'audio/webm', 'audio/mp4')
 * @param {string} interviewId - The interview ID for organizing files
 * @param {string} questionIndex - Question number/index for the recording
 * @returns {Promise<{key: string, url: string}>} - S3 key and signed URL
 */
const uploadAudio = async (fileBuffer, mimeType, interviewId, questionIndex) => {
  const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const key = `${FOLDER_PREFIX}interviews/${interviewId}/audio_q${questionIndex}_${uuidv4()}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
    Metadata: {
      interviewId,
      questionIndex: String(questionIndex),
      uploadedAt: new Date().toISOString()
    }
  });

  await s3Client.send(command);

  // Generate a signed URL for immediate access (valid for 7 days)
  const signedUrl = await getSignedUrl(s3Client, new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  }), { expiresIn: 604800 }); // 7 days

  return { key, url: signedUrl };
};

/**
 * Get signed URL for an existing audio file
 * @param {string} key - The S3 object key
 * @param {number} expiresIn - URL expiration in seconds (default 1 hour)
 * @returns {Promise<string>} - Signed URL
 */
const getAudioUrl = async (key, expiresIn = 3600) => {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  });

  return getSignedUrl(s3Client, command, { expiresIn });
};

/**
 * Delete audio file from S3
 * @param {string} key - The S3 object key
 */
const deleteAudio = async (key) => {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
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
      uploadedAt: new Date().toISOString()
    }
  });

  await s3Client.send(command);

  // Return the base S3 URL (not signed)
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
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
const uploadResponseAudio = async (fileBuffer, mimeType, interviewId, questionIndex, durationSeconds = 0) => {
  const { key, url } = await uploadAudio(fileBuffer, mimeType, interviewId, questionIndex);

  return {
    s3Key: key,
    url,
    mimeType,
    questionIndex,
    durationSeconds,
    uploadedAt: new Date()
  };
};

module.exports = {
  uploadAudio,
  uploadFile,
  getAudioUrl,
  deleteAudio,
  uploadResponseAudio,
  BUCKET_NAME,
  FOLDER_PREFIX
};
