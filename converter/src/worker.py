"""
Converter Worker — polls Redis for version-level jobs, converts all files per version.

This worker processes VERSION-LEVEL jobs (not per-file). Each version job
contains a set of files to convert. The worker reads the file list from Redis,
converts each file, and updates per-file status directly in Redis.

Lifecycle:
1. Connect to Redis
2. Check schedule (10PM–5AM) or manual trigger flag
3. Dequeue pending version job (FIFO by timestamp)
4. Read all pending files for the job from Redis
5. Convert each file (Office→PDF) and update file status in Redis
6. After all files processed, mark version job as completed/failed
7. Sleep and repeat

Redis Key Layout (must match backend converter-queue.service.ts):
  converter:vjob:{jobId}                 — Hash: version job metadata
  converter:vjob:pending                 — Sorted Set: pending job IDs
  converter:vjob:status:{status}         — Set: job IDs by status
  converter:version:active_job:{verId}   — String: active job ID
  converter:files:{jobId}                — Set: file tracking IDs
  converter:file:{fileId}                — Hash: per-file tracking record
  converter:manual_trigger               — String: "1" if active
  converter:schedule:config              — Hash: schedule settings

Environment variables:
- REDIS_HOST: Redis hostname (default: redis)
- REDIS_PORT: Redis port (default: 6379)
- REDIS_URL: Full Redis URL (overrides host/port)
- POLL_INTERVAL: Seconds between queue checks (default: 30)
- CONVERTER_OUTPUT_DIR: Directory for converted PDFs (default: /app/.data/converted)
"""
import os
import sys
import time
import signal
from datetime import datetime

import redis

# Load .env file from converter root (parent of src/)
from pathlib import Path
try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).resolve().parent.parent / '.env'
    load_dotenv(_env_path)
except ImportError:
    pass  # python-dotenv not installed, rely on system env vars

from src.logger import logger, setup_logger
from src.converter import convert_to_pdf, is_office_file, is_pdf_file
from src.config import load_config_from_job, get_doc_type, should_trim_whitespace, get_pdf_suffix
from src.pdf_processor import process_pdf

# ============================================================================
# Configuration
# ============================================================================

# Initialize loguru with colored console + rotating file logs
setup_logger(level='DEBUG')

# Redis connection
REDIS_URL = os.environ.get('REDIS_URL', '')
REDIS_HOST = os.environ.get('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.environ.get('REDIS_PORT', '6379'))
REDIS_PASSWORD = os.environ.get('REDIS_PASSWORD', '')
REDIS_DB = int(os.environ.get('REDIS_DB', '0'))

# Poll interval (seconds)
POLL_INTERVAL = int(os.environ.get('POLL_INTERVAL', '30'))

# Output directory for converted PDFs (on shared volume)
_CONVERTER_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.environ.get('CONVERTER_OUTPUT_DIR', os.path.join(_CONVERTER_ROOT, '.data', 'converted'))

# Upload directory — must point to the same physical directory as the backend's UPLOAD_DIR
UPLOAD_DIR = os.environ.get('UPLOAD_DIR', os.path.join(_CONVERTER_ROOT, '..', 'be', 'uploads'))

# Redis key constants (must match backend converter-queue.service.ts)
VJOB_KEY_PREFIX = 'converter:vjob:'
PENDING_QUEUE_KEY = 'converter:vjob:pending'
STATUS_SET_PREFIX = 'converter:vjob:status:'
ACTIVE_JOB_PREFIX = 'converter:version:active_job:'
FILES_SET_PREFIX = 'converter:files:'
FILE_KEY_PREFIX = 'converter:file:'
MANUAL_TRIGGER_KEY = 'converter:manual_trigger'
SCHEDULE_CONFIG_KEY = 'converter:schedule:config'

# Graceful shutdown flag
_shutdown = False


def _signal_handler(signum, frame):
    """Handle shutdown signals gracefully."""
    global _shutdown
    logger.info(f'Received signal {signum}, shutting down...')
    _shutdown = True


signal.signal(signal.SIGTERM, _signal_handler)
signal.signal(signal.SIGINT, _signal_handler)


# ============================================================================
# Redis Helpers
# ============================================================================

def get_redis_client() -> redis.Redis:
    """
    Create and return a Redis client.
    @returns: Connected Redis client.
    """
    if REDIS_URL:
        return redis.from_url(REDIS_URL, decode_responses=True)
    return redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        password=REDIS_PASSWORD or None,
        db=REDIS_DB,
        decode_responses=True,
    )


def is_within_schedule(r: redis.Redis) -> bool:
    """
    Check if current time is within the conversion schedule window.
    @param r: Redis client.
    @returns: True if processing should be active.
    """
    config = r.hgetall(SCHEDULE_CONFIG_KEY)

    start_hour = int(config.get('startHour', '22'))
    end_hour = int(config.get('endHour', '5'))
    enabled = config.get('enabled', 'true') == 'true'
    timezone_str = config.get('timezone', 'Asia/Ho_Chi_Minh')

    if not enabled:
        return False

    # Get current hour in configured timezone
    try:
        from zoneinfo import ZoneInfo
        now = datetime.now(tz=ZoneInfo(timezone_str))
        current_hour = now.hour
    except Exception:
        current_hour = datetime.utcnow().hour

    # Handle overnight window (e.g., 22:00 → 05:00)
    if start_hour > end_hour:
        return current_hour >= start_hour or current_hour < end_hour
    return current_hour >= start_hour and current_hour < end_hour


def is_manual_trigger_active(r: redis.Redis) -> bool:
    """Check if the manual trigger flag is set."""
    return r.get(MANUAL_TRIGGER_KEY) == '1'


# ============================================================================
# Version Job Helpers
# ============================================================================

def dequeue_version_job(r: redis.Redis) -> dict | None:
    """
    Find the next version job that is ready for conversion.
    The Node.js backend sets job status to 'converting' when it dequeues
    from the waiting queue. This worker looks for jobs in 'converting' status
    that still have pending files to process.

    @param r: Redis client.
    @returns: Version job dict or None if no jobs need processing.
    """
    # Find jobs that the Node.js backend has marked as 'converting'
    converting_ids = r.smembers(f'{STATUS_SET_PREFIX}converting')
    if not converting_ids:
        return None

    # Find first job with pending files
    for job_id in converting_ids:
        job_key = f'{VJOB_KEY_PREFIX}{job_id}'
        job_data = r.hgetall(job_key)

        if not job_data or not job_data.get('id'):
            continue

        # Check if this job has any pending files to process
        file_ids = r.smembers(f'{FILES_SET_PREFIX}{job_id}')
        has_pending = False
        for fid in file_ids:
            fstatus = r.hget(f'{FILE_KEY_PREFIX}{fid}', 'status')
            if fstatus == 'pending':
                has_pending = True
                break

        if has_pending:
            logger.info(f'Found converting job {job_id} with pending files')
            return job_data

    return None


def get_job_files(r: redis.Redis, job_id: str) -> list[dict]:
    """
    Get all file tracking records for a version job.
    Only returns files with status 'pending' (not yet processed).

    @param r: Redis client.
    @param job_id: Version job UUID.
    @returns: List of pending file tracking dicts.
    """
    file_ids = r.smembers(f'{FILES_SET_PREFIX}{job_id}')
    if not file_ids:
        return []

    files = []
    for file_id in file_ids:
        file_data = r.hgetall(f'{FILE_KEY_PREFIX}{file_id}')
        if file_data and file_data.get('id'):
            # Only include pending files
            if file_data.get('status') == 'pending':
                files.append(file_data)

    return files


def update_file_status(r: redis.Redis, file_id: str, job_id: str,
                       status: str, pdf_path: str = '', error: str = '') -> None:
    """
    Update a file tracking record's status in Redis.
    Also updates the parent version job's completed/failed counters.

    @param r: Redis client.
    @param file_id: File tracking UUID.
    @param job_id: Parent version job UUID.
    @param status: New status ('completed' or 'failed').
    @param pdf_path: Path to the converted PDF (on success).
    @param error: Error message (on failure).
    """
    file_key = f'{FILE_KEY_PREFIX}{file_id}'
    job_key = f'{VJOB_KEY_PREFIX}{job_id}'
    now = datetime.utcnow().isoformat() + 'Z'

    # Update file hash
    updates = {
        'status': status,
        'updatedAt': now,
    }
    if pdf_path:
        updates['pdfPath'] = pdf_path
    if error:
        updates['error'] = error

    pipe = r.pipeline()
    pipe.hset(file_key, mapping=updates)

    # Update job counters
    if status == 'completed':
        pipe.hincrby(job_key, 'completedCount', 1)
    elif status == 'failed':
        pipe.hincrby(job_key, 'failedCount', 1)

    # Update job's updatedAt
    pipe.hset(job_key, 'updatedAt', now)
    pipe.execute()


def complete_version_job(r: redis.Redis, job_data: dict) -> None:
    """
    Mark a version job as completed or failed based on file results.
    Clears the active job pointer for the version.

    @param r: Redis client.
    @param job_data: Version job dict.
    """
    job_id = job_data['id']
    version_id = job_data.get('versionId', '')
    job_key = f'{VJOB_KEY_PREFIX}{job_id}'
    now = datetime.utcnow().isoformat() + 'Z'

    # Read final counters
    failed_count = int(r.hget(job_key, 'failedCount') or '0')
    completed_count = int(r.hget(job_key, 'completedCount') or '0')
    file_count = int(r.hget(job_key, 'fileCount') or '0')

    # Determine overall status: failed if any file failed, else completed
    if failed_count > 0 and completed_count == 0:
        overall_status = 'failed'
    elif failed_count > 0:
        overall_status = 'completed'  # Partial success — still mark completed
    else:
        overall_status = 'completed'

    # Update job status
    pipe = r.pipeline()
    pipe.srem(f'{STATUS_SET_PREFIX}processing', job_id)
    pipe.sadd(f'{STATUS_SET_PREFIX}{overall_status}', job_id)
    pipe.hset(job_key, mapping={
        'status': overall_status,
        'updatedAt': now,
    })

    # Clear active job pointer for this version
    if version_id:
        active_key = f'{ACTIVE_JOB_PREFIX}{version_id}'
        active_job = r.get(active_key)
        if active_job == job_id:
            pipe.delete(active_key)

    pipe.execute()

    logger.info(
        f'Version job {job_id} completed: '
        f'{completed_count}/{file_count} succeeded, {failed_count} failed'
    )


# ============================================================================
# File Processing
# ============================================================================

def process_file(r: redis.Redis, file_data: dict, job_data: dict) -> None:
    """
    Process a single file from a version job.

    1. Load per-job config from Redis (category/version settings)
    2. Convert Office files to PDF (or copy PDFs directly)
    3. Apply PDF suffix (e.g., _d for Word, _x for Excel)
    4. Run post-processing: remove empty pages, trim whitespace
    5. Update file status in Redis

    @param r: Redis client.
    @param file_data: File tracking dict from Redis.
    @param job_data: Parent version job dict from Redis.
    """
    file_id = file_data['id']
    job_id = file_data['jobId']
    file_name = file_data['fileName']
    project_id = job_data.get('projectId', '')
    category_id = job_data.get('categoryId', '')
    version_id = job_data.get('versionId', '')

    # Construct path from UPLOAD_DIR + components (cross-platform safe)
    # This avoids relying on filePath from Redis which may be a Windows absolute path
    file_path = os.path.join(UPLOAD_DIR, project_id, category_id, version_id, file_name)

    logger.info(f'▶ Processing file {file_id}: {file_name}')
    logger.debug(f'  constructed path from UPLOAD_DIR: {file_path}')
    logger.debug(f'  UPLOAD_DIR={UPLOAD_DIR}')
    logger.debug(f'  job={job_id}, project={project_id}, category={category_id}, version={version_id}')

    # Check if source file exists
    abs_file_path = os.path.abspath(file_path)
    logger.debug(f'  resolved absolute path: {abs_file_path}')

    if not os.path.exists(abs_file_path):
        # Debug: check parent directory
        parent_dir = os.path.dirname(abs_file_path)
        parent_exists = os.path.exists(parent_dir)
        logger.error(f'Source file not found: {abs_file_path}')
        logger.error(f'  parent dir exists: {parent_exists} -> {parent_dir}')

        if parent_exists:
            try:
                dir_contents = os.listdir(parent_dir)
                logger.error(f'  parent dir contents ({len(dir_contents)} items): {dir_contents}')
            except Exception as list_err:
                logger.error(f'  failed to list parent dir: {list_err}')
        else:
            # Walk up to find where the path diverges
            check_path = abs_file_path
            while check_path and check_path != os.path.dirname(check_path):
                check_path = os.path.dirname(check_path)
                if os.path.exists(check_path):
                    try:
                        contents = os.listdir(check_path)
                        logger.error(f'  nearest existing ancestor: {check_path}')
                        logger.error(f'  ancestor contents: {contents}')
                    except Exception:
                        pass
                    break

        error_msg = f'Source file not found: {abs_file_path}'
        update_file_status(r, file_id, job_id, 'failed', error=error_msg)
        return

    source_size = os.path.getsize(file_path)
    logger.debug(f'  source file size: {source_size:,} bytes')

    # Mark file as processing
    r.hset(f'{FILE_KEY_PREFIX}{file_id}', mapping={
        'status': 'processing',
        'updatedAt': datetime.utcnow().isoformat() + 'Z',
    })
    logger.debug(f'  status -> processing')

    try:
        # 1. Load per-job converter config
        config = load_config_from_job(job_data)
        doc_type = get_doc_type(file_name)
        logger.debug(f'  doc_type={doc_type}')

        # 2. Build output directory — pdf/ subfolder under the same upload dir as source
        output_dir = os.path.join(UPLOAD_DIR, project_id, category_id, version_id, 'pdf')
        os.makedirs(output_dir, exist_ok=True)
        logger.debug(f'  output_dir={output_dir}')

        pdf_path = None

        if is_office_file(file_name):
            # Convert Office file to PDF
            logger.info(f'  Converting Office -> PDF: {file_name}')
            pdf_path = convert_to_pdf(file_path, output_dir)
            pdf_size = os.path.getsize(pdf_path) if pdf_path and os.path.exists(pdf_path) else 0
            logger.success(f'  Converted: {file_name} -> {os.path.basename(pdf_path)} ({pdf_size:,} bytes)')

        elif is_pdf_file(file_name):
            # Copy PDF to output dir as-is
            import shutil
            pdf_path = os.path.join(output_dir, file_name)
            shutil.copy2(file_path, pdf_path)
            logger.info(f'  Copied PDF: {file_name} -> {pdf_path}')

        else:
            update_file_status(
                r, file_id, job_id, 'failed',
                error=f'Unsupported file type: {file_name}'
            )
            logger.warning(f'  Unsupported file type: {file_name}')
            return

        # 3. Apply PDF suffix if configured
        suffix = get_pdf_suffix(config, doc_type)
        if suffix and pdf_path:
            from pathlib import Path as P
            p = P(pdf_path)
            new_name = p.stem + suffix + p.suffix
            new_path = str(p.parent / new_name)
            if new_path != pdf_path:
                os.rename(pdf_path, new_path)
                logger.debug(f'  Applied suffix: {pdf_path} -> {new_name}')
                pdf_path = new_path

        # 4. Post-processing: remove empty pages + trim whitespace
        if pdf_path and os.path.exists(pdf_path):
            do_trim = should_trim_whitespace(config, doc_type)
            do_remove_empty = config.post_processing.remove_empty_pages
            trim_margin = config.post_processing.trim_whitespace.margin

            logger.debug(f'  post-processing: remove_empty={do_remove_empty}, trim={do_trim}, margin={trim_margin}')

            if do_remove_empty or do_trim:
                logger.info(f'  Running post-processing...')
                pdf_path = process_pdf(
                    pdf_path,
                    remove_empty=do_remove_empty,
                    trim=do_trim,
                    trim_margin=trim_margin,
                )
                final_size = os.path.getsize(pdf_path) if pdf_path and os.path.exists(pdf_path) else 0
                logger.debug(f'  post-processed PDF size: {final_size:,} bytes')

        # 5. Verify output exists
        if pdf_path and os.path.exists(pdf_path):
            final_size = os.path.getsize(pdf_path)
            logger.debug(f'  final PDF: {pdf_path} ({final_size:,} bytes)')
        else:
            logger.warning(f'  PDF output missing or empty: {pdf_path}')

        # 6. Build relative pdfPath for Redis (so backend resolves with its own UPLOAD_DIR)
        relative_pdf_path = ''
        if pdf_path:
            pdf_basename = os.path.basename(pdf_path)
            relative_pdf_path = os.path.join(project_id, category_id, version_id, 'pdf', pdf_basename)

        # 7. Update file status to completed
        update_file_status(r, file_id, job_id, 'completed', pdf_path=relative_pdf_path)
        logger.success(f'✓ File {file_id} completed: {file_name} -> {os.path.basename(pdf_path) if pdf_path else "(none)"}')

    except Exception as e:
        error_msg = str(e)
        logger.error(f'✗ File {file_id} failed: {error_msg}')
        update_file_status(r, file_id, job_id, 'failed', error=error_msg)


# ============================================================================
# Version Job Processing
# ============================================================================

def process_version_job(r: redis.Redis, job_data: dict) -> None:
    """
    Process all pending files in a version job.
    Converts each file to PDF and updates per-file status in Redis.
    The Node.js backend (waitForConversion) detects when all files are
    done and handles job completion + RAGFlow upload.

    1. Read all pending files from Redis
    2. Process each file sequentially (Office→PDF)
    3. File statuses are updated individually (completed/failed)

    @param r: Redis client.
    @param job_data: Version job dict from Redis.
    """
    job_id = job_data['id']
    version_id = job_data.get('versionId', '')

    logger.info(f'━━━ Version Job {job_id} (v={version_id}) ━━━')
    logger.debug(f'  serverId={job_data.get("serverId", "")}, datasetId={job_data.get("datasetId", "")}')
    logger.debug(f'  projectId={job_data.get("projectId", "")}, categoryId={job_data.get("categoryId", "")}')

    # Get all pending files for this job
    pending_files = get_job_files(r, job_id)

    if not pending_files:
        logger.info(f'  No pending files for job {job_id}')
        return

    logger.info(f'  {len(pending_files)} pending file(s) to process:')
    for i, f in enumerate(pending_files, 1):
        logger.debug(f'    [{i}] {f.get("fileName", "?")} (id={f.get("id", "?")})')

    # Process each file
    for idx, file_data in enumerate(pending_files, 1):
        if _shutdown:
            logger.info('Shutdown requested, stopping file processing')
            break
        logger.info(f'  ── File {idx}/{len(pending_files)} ──')
        process_file(r, file_data, job_data)

        # Small delay between files to avoid overloading LibreOffice
        time.sleep(2)

    logger.info(f'━━━ Version Job {job_id} — file conversion done ━━━')


# ============================================================================
# Main Loop
# ============================================================================

def main():
    """
    Main worker loop.
    Polls Redis for pending version jobs, processes them when within
    the schedule window or manual trigger is active.
    """
    logger.info('Converter worker starting...')
    logger.info(f'Redis: {REDIS_URL or f"{REDIS_HOST}:{REDIS_PORT}"}')
    logger.info(f'Output dir: {OUTPUT_DIR}')
    logger.info(f'Poll interval: {POLL_INTERVAL}s')

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Connect to Redis with retry
    r = None
    while not _shutdown:
        try:
            r = get_redis_client()
            r.ping()
            logger.info('Connected to Redis')
            break
        except Exception as e:
            logger.warning(f'Redis not ready, retrying in 5s: {e}')
            time.sleep(5)

    if _shutdown or r is None:
        return

    # Main polling loop
    while not _shutdown:
        try:
            within_schedule = is_within_schedule(r)
            manual_trigger = is_manual_trigger_active(r)
            should_process = within_schedule or manual_trigger

            if not should_process:
                logger.debug('Outside schedule window, sleeping...')
                time.sleep(POLL_INTERVAL)
                continue

            # If woken by manual trigger (outside schedule window), clear it
            # immediately so it acts as a one-shot trigger and the worker
            # returns to sleeping once the current batch is done.
            if manual_trigger and not within_schedule:
                r.delete(MANUAL_TRIGGER_KEY)
                logger.info('Manual trigger activated — cleared after pickup')

            # Find converting jobs with pending files
            job_data = dequeue_version_job(r)
            if job_data is None:
                # No converting jobs with pending files — sleep
                time.sleep(POLL_INTERVAL)
                continue

            # Process the entire version job (all pending files)
            process_version_job(r, job_data)

            # Small delay between version jobs
            time.sleep(2)

        except redis.ConnectionError as e:
            logger.error(f'Redis connection lost: {e}')
            time.sleep(10)
            try:
                r = get_redis_client()
                r.ping()
                logger.info('Reconnected to Redis')
            except Exception:
                pass
        except Exception as e:
            logger.error(f'Unexpected error in worker loop: {e}')
            time.sleep(5)

    logger.info('Converter worker stopped.')


if __name__ == '__main__':
    main()
