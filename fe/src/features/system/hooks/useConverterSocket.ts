/**
 * @fileoverview useConverterSocket — real-time converter status updates via WebSocket.
 *
 * Listens for `converter:file:status` and `converter:job:status` events
 * from the backend Socket.IO server. Calls provided callbacks to trigger
 * data refetch in the consuming component.
 *
 * @module features/system/hooks/useConverterSocket
 */
import { useEffect, useRef } from "react";
import { getSocket, connectSocket } from "@/lib/socket";

// ============================================================================
// Types
// ============================================================================

/** Payload for per-file status change events */
export interface FileStatusEvent {
  /** Parent version job ID */
  jobId: string;
  /** File tracking record ID */
  fileId: string;
  /** Original file name */
  fileName: string;
  /** New status */
  status: "finished" | "failed";
}

/** Payload for version job status change events */
export interface JobStatusEvent {
  /** Version job ID */
  jobId: string;
  /** Version ID */
  versionId: string;
  /** New overall job status */
  status: "finished" | "failed";
  /** Total number of files */
  fileCount: number;
  /** Successfully finished files */
  finishedCount: number;
  /** Failed files */
  failedCount: number;
}

/** Hook options */
export interface UseConverterSocketOptions {
  /** If true, the hook is active and listens for events */
  enabled?: boolean;
  /** Called when any file status changes */
  onFileUpdate?: (data: FileStatusEvent) => void;
  /** Called when a job status changes */
  onJobUpdate?: (data: JobStatusEvent) => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * React hook for real-time converter status updates via Socket.IO.
 *
 * @param options - Configuration and callbacks
 * @description Subscribes to converter WebSocket events. Automatically
 *   connects the socket if not already connected. Cleans up on unmount.
 *
 * @example
 * ```tsx
 * useConverterSocket({
 *   enabled: open,
 *   onJobUpdate: () => fetchJobs(true),
 *   onFileUpdate: () => fetchJobs(true),
 * })
 * ```
 */
export function useConverterSocket(options: UseConverterSocketOptions): void {
  const { enabled = true, onFileUpdate, onJobUpdate } = options;

  // Use refs to avoid re-subscribing when callbacks change
  const onFileRef = useRef(onFileUpdate);
  const onJobRef = useRef(onJobUpdate);
  onFileRef.current = onFileUpdate;
  onJobRef.current = onJobUpdate;

  useEffect(() => {
    if (!enabled) {
      console.warn("[ConverterSocket] Hook disabled, skipping socket setup");
      return;
    }

    // Ensure socket is connected
    let socket = getSocket();
    if (!socket) {
      console.log(
        "[ConverterSocket] No existing socket, creating new connection...",
      );
      socket = connectSocket();
    }

    // Log socket connection state
    console.log("[ConverterSocket] Socket state:", {
      id: socket.id,
      connected: socket.connected,
      disconnected: socket.disconnected,
    });

    // Monitor connection events for diagnostics
    const handleConnect = () => {
      console.log("[ConverterSocket] ✅ Socket connected, id:", socket?.id);
    };
    const handleDisconnect = (reason: string) => {
      console.warn("[ConverterSocket] ❌ Socket disconnected, reason:", reason);
    };
    const handleConnectError = (err: Error) => {
      console.error("[ConverterSocket] ❌ Connection error:", err.message);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    // Handler for per-file status events
    const handleFileStatus = (data: FileStatusEvent) => {
      console.log("[ConverterSocket] 📄 file:status received:", data);
      onFileRef.current?.(data);
    };

    // Handler for job-level status events
    const handleJobStatus = (data: JobStatusEvent) => {
      console.log("[ConverterSocket] 📦 job:status received:", data);
      onJobRef.current?.(data);
    };

    socket.on("converter:file:status", handleFileStatus);
    socket.on("converter:job:status", handleJobStatus);

    console.log(
      "[ConverterSocket] ✅ Event listeners registered (file:status, job:status)",
    );

    return () => {
      console.log("[ConverterSocket] Cleaning up event listeners");
      socket?.off("connect", handleConnect);
      socket?.off("disconnect", handleDisconnect);
      socket?.off("connect_error", handleConnectError);
      socket?.off("converter:file:status", handleFileStatus);
      socket?.off("converter:job:status", handleJobStatus);
    };
  }, [enabled]);
}

export default useConverterSocket;
