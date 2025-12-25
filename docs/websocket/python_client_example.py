#!/usr/bin/env python3
"""
Socket.IO Python Client Example for RAGFlow Simple UI

This script demonstrates how to connect to the WebSocket server
and receive real-time notification events from Python.

Requirements:
    pip install python-socketio

Usage:
    python python_client_example.py

Environment Variables:
    SOCKET_URL: WebSocket server URL (default: http://localhost:3001)
    WEBSOCKET_API_KEY: API key for authentication (required for external clients)
    USER_EMAIL: User email for identification (optional)
"""

import os
import socketio
from datetime import datetime

# Configuration
SOCKET_URL = os.getenv('SOCKET_URL', 'http://localhost:3001')
API_KEY = os.getenv('WEBSOCKET_API_KEY', '')
USER_EMAIL = os.getenv('USER_EMAIL', 'python-client@example.com')

# Create Socket.IO client
sio = socketio.Client(
    reconnection=True,
    reconnection_attempts=5,
    reconnection_delay=1,
    reconnection_delay_max=5,
)


@sio.event
def connect():
    """Called when connected to the server."""
    print(f'[{datetime.now().isoformat()}] Connected to server with SID: {sio.sid}')
    
    # Subscribe to a custom room (optional)
    sio.emit('subscribe', 'python-clients')
    print(f'[{datetime.now().isoformat()}] Subscribed to room: python-clients')


@sio.event
def disconnect():
    """Called when disconnected from the server."""
    print(f'[{datetime.now().isoformat()}] Disconnected from server')


@sio.event
def connect_error(data):
    """Called when connection fails."""
    print(f'[{datetime.now().isoformat()}] Connection failed: {data}')


@sio.on('auth:error')
def on_auth_error(data):
    """Called when authentication fails (invalid API key)."""
    print(f'[{datetime.now().isoformat()}] Authentication failed: {data.get("message", "Unknown error")}')
    print('Please check your WEBSOCKET_API_KEY environment variable.')


@sio.on('notification')
def on_notification(data):
    """
    Handle notification events from the server.
    
    Args:
        data: Notification payload containing:
            - type: Notification type string
            - title: Optional notification title
            - message: Notification message
            - data: Optional additional data
            - timestamp: ISO timestamp
    """
    print(f'\n[{datetime.now().isoformat()}] === NOTIFICATION RECEIVED ===')
    print(f'  Type: {data.get("type", "unknown")}')
    if data.get('title'):
        print(f'  Title: {data["title"]}')
    print(f'  Message: {data.get("message", "")}')
    if data.get('data'):
        print(f'  Data: {data["data"]}')
    print(f'  Timestamp: {data.get("timestamp", "N/A")}')
    print('=' * 50)


@sio.on('pong')
def on_pong(data):
    """Handle pong response from server."""
    print(f'[{datetime.now().isoformat()}] Pong received: {data}')


@sio.on('server:shutdown')
def on_server_shutdown(data):
    """Handle server shutdown notification."""
    print(f'[{datetime.now().isoformat()}] Server is shutting down: {data}')


def send_ping():
    """Send a ping to check connection health."""
    sio.emit('ping')
    print(f'[{datetime.now().isoformat()}] Ping sent')


def main():
    """Main entry point."""
    print(f'RAGFlow Socket.IO Python Client')
    print(f'=' * 40)
    print(f'Server URL: {SOCKET_URL}')
    print(f'API Key: {"*" * len(API_KEY) if API_KEY else "(not set)"}')
    print(f'User Email: {USER_EMAIL}')
    print(f'=' * 40)
    print()
    
    if not API_KEY:
        print('WARNING: No API key set. Connection may be rejected if server requires authentication.')
        print('Set WEBSOCKET_API_KEY environment variable to authenticate.')
        print()
    
    try:
        # Build auth payload
        auth_payload = {'email': USER_EMAIL}
        if API_KEY:
            auth_payload['apiKey'] = API_KEY
        
        # Connect to server with authentication
        print(f'[{datetime.now().isoformat()}] Connecting to {SOCKET_URL}...')
        sio.connect(
            SOCKET_URL,
            auth=auth_payload,
            transports=['websocket', 'polling'],
        )
        
        print(f'[{datetime.now().isoformat()}] Waiting for notifications (Ctrl+C to exit)...')
        print()
        
        # Keep the connection alive
        sio.wait()
        
    except socketio.exceptions.ConnectionError as e:
        print(f'[{datetime.now().isoformat()}] Failed to connect: {e}')
    except KeyboardInterrupt:
        print(f'\n[{datetime.now().isoformat()}] Interrupted by user')
    finally:
        if sio.connected:
            # Unsubscribe from room before disconnecting
            sio.emit('unsubscribe', 'python-clients')
            sio.disconnect()
            print(f'[{datetime.now().isoformat()}] Disconnected gracefully')


if __name__ == '__main__':
    main()
