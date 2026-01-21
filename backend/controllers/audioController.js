const Interview = require('../models/Interview');
const { uploadResponseAudio, getAudioUrl, deleteAudio } = require('../services/s3Service');

/**
 * Upload audio recording for an interview response
 * POST /api/audio/upload
 */
exports.uploadAudioRecording = async (req, res) => {
  try {
    const { interviewId, questionIndex, durationSeconds } = req.body;
    const audioFile = req.file;

    if (!audioFile) {
      return res.status(400).json({ message: 'No audio file provided' });
    }

    if (!interviewId) {
      return res.status(400).json({ message: 'Interview ID is required' });
    }

    // Verify interview belongs to user
    const interview = await Interview.findOne({
      _id: interviewId,
      user: req.user._id
    });

    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    // Upload to S3
    const audioData = await uploadResponseAudio(
      audioFile.buffer,
      audioFile.mimetype,
      interviewId,
      questionIndex || interview.audioRecordings.length + 1,
      durationSeconds || 0
    );

    // Save reference to interview
    interview.audioRecordings.push({
      s3Key: audioData.s3Key,
      mimeType: audioData.mimeType,
      questionIndex: audioData.questionIndex,
      durationSeconds: audioData.durationSeconds,
      uploadedAt: audioData.uploadedAt
    });

    await interview.save();

    res.status(201).json({
      message: 'Audio uploaded successfully',
      audioRecording: {
        ...audioData,
        id: interview.audioRecordings[interview.audioRecordings.length - 1]._id
      }
    });
  } catch (error) {
    console.error('Audio upload error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get signed URL for an audio recording
 * GET /api/audio/:interviewId/:recordingId
 */
exports.getAudioPlaybackUrl = async (req, res) => {
  try {
    const { interviewId, recordingId } = req.params;

    const interview = await Interview.findById(interviewId);
    
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    const recording = interview.audioRecordings.id(recordingId);
    
    if (!recording) {
      return res.status(404).json({ message: 'Recording not found' });
    }

    // Generate fresh signed URL
    const url = await getAudioUrl(recording.s3Key, 3600); // 1 hour

    res.json({ url, recording });
  } catch (error) {
    console.error('Get audio URL error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get all audio recordings for an interview (Admin)
 * GET /api/audio/interview/:interviewId
 */
exports.getInterviewAudioRecordings = async (req, res) => {
  try {
    const { interviewId } = req.params;

    const interview = await Interview.findById(interviewId)
      .populate('user', 'name email');
    
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    // Generate signed URLs for all recordings
    const recordingsWithUrls = await Promise.all(
      interview.audioRecordings.map(async (recording) => {
        const url = await getAudioUrl(recording.s3Key, 3600);
        return {
          id: recording._id,
          questionIndex: recording.questionIndex,
          durationSeconds: recording.durationSeconds,
          mimeType: recording.mimeType,
          uploadedAt: recording.uploadedAt,
          url
        };
      })
    );

    res.json({
      interviewId: interview._id,
      user: interview.user,
      role: interview.role,
      status: interview.status,
      recordings: recordingsWithUrls
    });
  } catch (error) {
    console.error('Get interview recordings error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete an audio recording
 * DELETE /api/audio/:interviewId/:recordingId
 */
exports.deleteAudioRecording = async (req, res) => {
  try {
    const { interviewId, recordingId } = req.params;

    const interview = await Interview.findById(interviewId);
    
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    const recording = interview.audioRecordings.id(recordingId);
    
    if (!recording) {
      return res.status(404).json({ message: 'Recording not found' });
    }

    // Delete from S3
    await deleteAudio(recording.s3Key);

    // Remove from interview document
    interview.audioRecordings.pull(recordingId);
    await interview.save();

    res.json({ message: 'Recording deleted successfully' });
  } catch (error) {
    console.error('Delete audio error:', error);
    res.status(500).json({ message: error.message });
  }
};
