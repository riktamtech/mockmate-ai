import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  AlertCircle,
} from "lucide-react";
import { formatDurationHMS } from "../adminHelpers";
import "./VideoPlayer.css";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * CombinedVideoPlayer — A robust video player that seamlessly handles:
 *   - Single video playback (bot or chime)
 *   - Combined playback (bot → chime) as a single continuous session
 *
 * Props:
 *   - botUrl: string — URL for the bot recording
 *   - chimeUrl: string — URL for the chime recording
 *   - type: 'bot'|'chime'|'combined' — recording type
 *   - onDurationResolved: (seconds) => void — callback when total duration is determined
 */
const CombinedVideoPlayer = ({
  botUrl = "",
  chimeUrl = "",
  type = "bot",
  onDurationResolved,
}) => {
  const playerRef = useRef(null);
  const wrapperRef = useRef(null);
  const progressRef = useRef(null);
  const controlsTimerRef = useRef(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [errorOccurred, setErrorOccurred] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [showControls, setShowControls] = useState(true);

  // Duration tracking
  const [totalDuration, setTotalDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const durationsRef = useRef({ bot: 0, chime: 0 });
  const currentVideoRef = useRef(0); // 0 = first video (bot), 1 = second (chime)

  // Get video sources based on type
  const videoA = type === "chime" ? chimeUrl : botUrl;
  const videoB = type === "combined" ? chimeUrl : "";

  // Load metadata for a video source
  const loadMetadata = useCallback((src) => {
    return new Promise((resolve, reject) => {
      const temp = document.createElement("video");
      temp.preload = "metadata";

      const cleanup = () => {
        temp.onloadedmetadata = null;
        temp.onerror = null;
        temp.src = "";
        temp.remove();
      };

      temp.onloadedmetadata = () => {
        const d = temp.duration;
        cleanup();
        resolve(isFinite(d) ? d : 0);
      };

      temp.onerror = () => {
        cleanup();
        reject(new Error(`Failed to load metadata for ${src}`));
      };

      temp.src = src;
    });
  }, []);

  // Preload video metadata
  useEffect(() => {
    let cancelled = false;

    const preload = async () => {
      setIsLoading(true);
      setErrorOccurred(false);
      setErrorMessage("");
      setHasStarted(false);
      setCurrentTime(0);
      currentVideoRef.current = 0;

      if (!videoA && !videoB) {
        setErrorOccurred(true);
        setErrorMessage("No video sources provided.");
        setIsLoading(false);
        return;
      }

      try {
        if (videoA && videoB) {
          // Combined mode
          const [resA, resB] = await Promise.allSettled([
            loadMetadata(videoA),
            loadMetadata(videoB),
          ]);

          if (cancelled) return;

          if (resA.status === "rejected" && resB.status === "rejected") {
            setErrorOccurred(true);
            setErrorMessage("Both video sources failed to load.");
            setIsLoading(false);
            return;
          }

          const dA = resA.status === "fulfilled" ? resA.value : 0;
          const dB = resB.status === "fulfilled" ? resB.value : 0;

          durationsRef.current = { bot: dA, chime: dB };
          const total = dA + dB;
          setTotalDuration(total);
          onDurationResolved?.(total);

          if (dA > 0) {
            currentVideoRef.current = 0;
            setupPlayer(videoA, 0, false);
          } else {
            currentVideoRef.current = 1;
            setupPlayer(videoB, 0, false);
          }
        } else {
          // Single video mode
          const src = videoA || videoB;
          try {
            const d = await loadMetadata(src);
            if (cancelled) return;
            durationsRef.current = videoA
              ? { bot: d, chime: 0 }
              : { bot: 0, chime: d };
            setTotalDuration(d);
            onDurationResolved?.(d);
            currentVideoRef.current = videoA ? 0 : 1;
            setupPlayer(src, 0, false);
          } catch {
            if (cancelled) return;
            setErrorOccurred(true);
            setErrorMessage("Failed to load video.");
            setIsLoading(false);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setErrorOccurred(true);
          setErrorMessage(err.message || "An error occurred loading the video.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    preload();
    return () => {
      cancelled = true;
    };
  }, [videoA, videoB, loadMetadata, onDurationResolved]);

  const setupPlayer = useCallback(
    (src, seekTime, autoPlay) => {
      const vid = playerRef.current;
      if (!vid) return;

      try {
        vid.src = src;
        vid.currentTime = seekTime;
        vid.muted = isMuted;
        vid.volume = volume;
        vid.playbackRate = speed;
        vid.load();

        if (autoPlay) {
          vid
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        }
      } catch (err) {
        console.error("setupPlayer error:", err);
        setErrorOccurred(true);
        setErrorMessage("Failed to set up video playback.");
      }
    },
    [isMuted, volume, speed],
  );

  // Compute global time from current video position
  const getGlobalTime = useCallback(() => {
    const vid = playerRef.current;
    if (!vid) return 0;
    const raw = vid.currentTime || 0;
    return currentVideoRef.current === 0
      ? raw
      : durationsRef.current.bot + raw;
  }, []);

  // Time update handler
  const handleTimeUpdate = useCallback(() => {
    setCurrentTime(getGlobalTime());
  }, [getGlobalTime]);

  // Video ended handler
  const handleEnded = useCallback(() => {
    if (type !== "combined") {
      setIsPlaying(false);
      return;
    }

    // If first video ended, switch to second
    if (currentVideoRef.current === 0 && videoB && durationsRef.current.chime > 0) {
      currentVideoRef.current = 1;
      setupPlayer(videoB, 0, true);
    } else {
      // All done
      setIsPlaying(false);
      currentVideoRef.current = 0;
      setupPlayer(videoA, 0, false);
    }
  }, [type, videoA, videoB, setupPlayer]);

  // Play/Pause toggle
  const togglePlayPause = useCallback(() => {
    const vid = playerRef.current;
    if (!vid || isLoading) return;

    if (vid.paused) {
      vid
        .play()
        .then(() => {
          setIsPlaying(true);
          if (!hasStarted) setHasStarted(true);
        })
        .catch(() => setIsPlaying(false));
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  }, [isLoading, hasStarted]);

  // Seek to a specific global time
  const seekTo = useCallback(
    (globalTime) => {
      const clamped = Math.max(0, Math.min(globalTime, totalDuration));

      if (type !== "combined" || !videoB) {
        const src = videoA || videoB;
        playerRef.current && (playerRef.current.currentTime = clamped);
        setCurrentTime(clamped);
        return;
      }

      const { bot: dA } = durationsRef.current;
      if (clamped < dA) {
        if (currentVideoRef.current !== 0) {
          currentVideoRef.current = 0;
          setupPlayer(videoA, clamped, isPlaying);
        } else {
          playerRef.current && (playerRef.current.currentTime = clamped);
        }
      } else {
        const localTime = clamped - dA;
        if (currentVideoRef.current !== 1) {
          currentVideoRef.current = 1;
          setupPlayer(videoB, localTime, isPlaying);
        } else {
          playerRef.current && (playerRef.current.currentTime = localTime);
        }
      }
      setCurrentTime(clamped);
    },
    [totalDuration, type, videoA, videoB, isPlaying, setupPlayer],
  );

  // Skip forward/backward
  const skip = useCallback(
    (offset) => {
      seekTo(getGlobalTime() + offset);
    },
    [seekTo, getGlobalTime],
  );

  // Progress bar click handler
  const handleProgressClick = useCallback(
    (e) => {
      const rect = progressRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seekTo(ratio * totalDuration);
    },
    [totalDuration, seekTo],
  );

  // Volume change
  const handleVolumeChange = useCallback((e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (playerRef.current) {
      playerRef.current.volume = val;
      playerRef.current.muted = val === 0;
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (playerRef.current) {
      playerRef.current.muted = newMuted;
    }
  }, [isMuted]);

  // Cycle speed
  const cycleSpeed = useCallback(() => {
    const idx = SPEEDS.indexOf(speed);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    setSpeed(next);
    if (playerRef.current) {
      playerRef.current.playbackRate = next;
    }
  }, [speed]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!wrapperRef.current) return;
    if (!document.fullscreenElement) {
      wrapperRef.current
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlayPause();
          break;
        case "ArrowRight":
          e.preventDefault();
          skip(5);
          break;
        case "ArrowLeft":
          e.preventDefault();
          skip(-5);
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [togglePlayPause, skip, toggleFullscreen, toggleMute]);

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    if (isPlaying) {
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) setShowControls(true);
    else resetControlsTimer();
    return () => clearTimeout(controlsTimerRef.current);
  }, [isPlaying, resetControlsTimer]);

  // Progress percentage
  const progressPct = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  // Determine which segment is active
  const botPct =
    type === "combined" && totalDuration > 0
      ? (durationsRef.current.bot / totalDuration) * 100
      : 0;

  // Error state
  if (errorOccurred) {
    return (
      <div className="video-player-wrapper">
        <div className="video-container">
          <div className="video-overlay">
            <div className="video-error">
              <AlertCircle size={48} />
              <p>{errorMessage || "This video can't be played."}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Recording type label
  const typeLabel =
    type === "combined"
      ? "Combined Recording"
      : type === "bot"
        ? "Bot Recording"
        : "Chime Recording";
  const typeBadgeClass =
    type === "combined" ? "combined" : type === "bot" ? "bot" : "chime";

  return (
    <div
      ref={wrapperRef}
      className={`video-player-wrapper ${isFullscreen ? "fullscreen" : ""} ${showControls ? "show-controls" : ""}`}
      onMouseMove={resetControlsTimer}
    >
      {/* Recording type badge */}
      <div className={`recording-badge ${typeBadgeClass}`}>{typeLabel}</div>

      {/* Video container */}
      <div className="video-container" onClick={togglePlayPause}>
        <video
          ref={playerRef}
          muted={isMuted}
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onLoadStart={() => setIsLoading(true)}
          onCanPlay={() => setIsLoading(false)}
          onError={() => {
            setErrorOccurred(true);
            setErrorMessage("Failed to play the recording.");
          }}
        />

        {/* Loading overlay */}
        {isLoading && (
          <div className="video-overlay">
            <div className="video-loading">
              <div className="spinner" />
              <span style={{ fontSize: 13, opacity: 0.8 }}>
                Loading recording...
              </span>
            </div>
          </div>
        )}

        {/* Play button overlay (before first play) */}
        {!hasStarted && !isLoading && (
          <div
            className="video-overlay clickable"
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
          >
            <div className="video-play-btn">
              <Play size={32} fill="white" />
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="video-controls">
        {/* Segment indicator for combined recordings */}
        {type === "combined" && totalDuration > 0 && (
          <div className="segment-indicator">
            <div
              className="segment bot"
              style={{ width: `${botPct}%` }}
            >
              <span className="segment-label">Bot</span>
            </div>
            <div
              className="segment chime"
              style={{ width: `${100 - botPct}%` }}
            >
              <span className="segment-label">Chime</span>
            </div>
          </div>
        )}

        {/* Progress bar */}
        <div
          ref={progressRef}
          className="progress-bar-container"
          onClick={handleProgressClick}
        >
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div
            className="progress-bar-thumb"
            style={{ left: `${progressPct}%` }}
          />
        </div>

        {/* Control buttons */}
        <div className="controls-row">
          <div className="controls-left">
            <button
              className="ctrl-btn"
              onClick={(e) => {
                e.stopPropagation();
                skip(-10);
              }}
              title="Rewind 10s"
              disabled={isLoading}
            >
              <SkipBack size={18} />
            </button>

            <button
              className="ctrl-btn play-btn"
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              disabled={isLoading}
            >
              {isPlaying ? (
                <Pause size={20} fill="white" />
              ) : (
                <Play size={20} fill="white" />
              )}
            </button>

            <button
              className="ctrl-btn"
              onClick={(e) => {
                e.stopPropagation();
                skip(10);
              }}
              title="Forward 10s"
              disabled={isLoading}
            >
              <SkipForward size={18} />
            </button>
          </div>

          <div className="controls-center">
            <span className="time-display">
              {formatDurationHMS(currentTime)} / {formatDurationHMS(totalDuration)}
            </span>
          </div>

          <div className="controls-right">
            {/* Volume */}
            <div className="volume-control">
              <button
                className="ctrl-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX size={18} />
                ) : (
                  <Volume2 size={18} />
                )}
              </button>
              <input
                type="range"
                className="volume-slider"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Speed */}
            <button
              className="speed-btn"
              onClick={(e) => {
                e.stopPropagation();
                cycleSpeed();
              }}
              title="Playback speed"
            >
              {speed}x
            </button>

            {/* Fullscreen */}
            <button
              className="ctrl-btn"
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
            >
              {isFullscreen ? (
                <Minimize size={18} />
              ) : (
                <Maximize size={18} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CombinedVideoPlayer;
